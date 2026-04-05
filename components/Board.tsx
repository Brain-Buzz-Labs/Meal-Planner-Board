"use client";

import { useState, useMemo, useContext } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { format, addDays, startOfDay, isSameDay, subDays } from "date-fns";
import { Plus, ChevronLeft, ChevronRight, CookingPot, BookOpen, Sun, Moon } from "lucide-react";
import { UserButton, AuthUIContext } from "@neondatabase/auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { useListMeals, useListDays, useMoveMeal, useCopyMeal, useDeleteMeal } from "@/hooks/use-meals";
import { MealCard } from "@/components/MealCard";
import { MealFormDialog } from "@/components/MealFormDialog";
import { IngredientModal } from "@/components/IngredientModal";
import { DroppableSlot } from "@/components/DroppableSlot";
import { IngredientList } from "@/components/IngredientList";
import { useWeeklyIngredients } from "@/hooks/use-ingredients";
import { aggregateIngredients } from "@/lib/aggregate-ingredients";
import type { FormattedMeal } from "@/lib/db/helpers";

const MEAL_TYPE_DINNER = "dinner";

export default function Board() {
  const authContext = useContext(AuthUIContext);
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [activeMeal, setActiveMeal] = useState<FormattedMeal | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<FormattedMeal | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  const [viewingMeal, setViewingMeal] = useState<FormattedMeal | null>(null);
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);

  const { data: serverMeals = [], isLoading } = useListMeals();
  const moveMutation = useMoveMeal();
  const copyMutation = useCopyMeal();
  const deleteMutation = useDeleteMeal();

  const [optimisticMeals, setOptimisticMeals] = useState<FormattedMeal[] | null>(null);
  const displayMeals = optimisticMeals || serverMeals;

  const { data: serverDays = [] } = useListDays(format(startDate, "yyyy-MM-dd"), 7);

  const days = useMemo(() => {
    if (serverDays.length > 0) {
      return serverDays.map((d) => new Date(d.date + "T00:00:00"));
    }
    return Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  }, [serverDays, startDate]);

  const weekStart = useMemo(() => format(days[0] ?? startDate, "yyyy-MM-dd"), [days, startDate]);
  const weekEnd = useMemo(() => format(days[6] ?? addDays(startDate, 6), "yyyy-MM-dd"), [days, startDate]);
  const { data: weeklyIngredients = [], isLoading: ingredientsLoading } = useWeeklyIngredients(weekStart, weekEnd);
  const aggregatedIngredients = useMemo(() => aggregateIngredients(weeklyIngredients), [weeklyIngredients]);

  const openAddDialog = (date?: Date) => {
    setEditingMeal(null);
    setDefaultDate(date ? format(date, "yyyy-MM-dd") : undefined);
    setIsDialogOpen(true);
  };

  const openEditDialog = (meal: FormattedMeal) => {
    setEditingMeal(meal);
    setDefaultDate(undefined);
    setIsDialogOpen(true);
  };

  const openViewDialog = (meal: FormattedMeal) => {
    setViewingMeal(meal);
    setIsIngredientModalOpen(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getMealsForSlot = (dateStr: string) => {
    return displayMeals
      .filter((m) => m.scheduledDate === dateStr)
      .sort((a, b) => a.position - b.position);
  };

  const libraryMeals = useMemo(() => {
    const byName = new Map<string, FormattedMeal>();
    for (const meal of displayMeals) {
      const key = meal.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, meal);
        continue;
      }
      // Prefer the template (scheduledDate = null); otherwise the lowest id.
      const existingIsTemplate = existing.scheduledDate === null;
      const candidateIsTemplate = meal.scheduledDate === null;
      if (candidateIsTemplate && !existingIsTemplate) {
        byName.set(key, meal);
      } else if (candidateIsTemplate === existingIsTemplate && meal.id < existing.id) {
        byName.set(key, meal);
      }
    }
    return Array.from(byName.values()).sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  }, [displayMeals]);

  const resolveDayTarget = (overId: string): { targetContainerId: string; newPosition: number } | null => {
    if (overId.includes("::")) {
      const [dateStr] = overId.split("::");
      return { targetContainerId: overId, newPosition: getMealsForSlot(dateStr).length };
    }
    const overMeal = displayMeals.find((m) => `meal-${m.id}` === overId);
    if (overMeal && overMeal.scheduledDate) {
      const targetContainerId = `${overMeal.scheduledDate}::${MEAL_TYPE_DINNER}`;
      const slotMeals = getMealsForSlot(overMeal.scheduledDate);
      const overIndex = slotMeals.findIndex((m) => m.id === overMeal.id);
      return { targetContainerId, newPosition: Math.max(0, overIndex) };
    }
    return null;
  };

  const parseDayTarget = (targetContainerId: string) => {
    const [d] = targetContainerId.split("::");
    return { newDate: d, newType: MEAL_TYPE_DINNER as string };
  };

  const onDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;

    if (activeId.startsWith("library-")) {
      const libraryId = parseInt(activeId.replace("library-", ""), 10);
      const meal = libraryMeals.find((m) => m.id === libraryId);
      if (meal) setActiveMeal(meal);
      return;
    }

    if (activeId.startsWith("meal-")) {
      const meal = displayMeals.find((m) => `meal-${m.id}` === activeId);
      if (meal) {
        setActiveMeal(meal);
        if (!optimisticMeals) setOptimisticMeals(serverMeals);
      }
    }
  };

  const onDragOver = (_event: DragOverEvent) => {};

  const onDragEnd = (event: DragEndEvent) => {
    setActiveMeal(null);
    const { active, over } = event;

    if (!over) {
      setOptimisticMeals(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const isOverLibrary = overId === "library" || overId.startsWith("library-");

    // Library drag → copy to day (or no-op if dropped back on library)
    if (activeId.startsWith("library-")) {
      if (isOverLibrary) return;

      const libraryId = parseInt(activeId.replace("library-", ""), 10);
      const source = libraryMeals.find((m) => m.id === libraryId);
      if (!source) return;

      const target = resolveDayTarget(overId);
      if (!target) return;
      const { newDate, newType } = parseDayTarget(target.targetContainerId);

      copyMutation.mutate(
        { id: source.id, data: { scheduledDate: newDate, mealType: newType } },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/ingredients/weekly"] });
            toast.success(`Added "${source.name}" to ${format(new Date(newDate + "T00:00:00"), "EEE, MMM d")}`);
          },
          onError: () => {
            toast.error("Couldn't add meal - please try again");
          },
        }
      );
      return;
    }

    // Day card drag
    const activeMealObj = displayMeals.find((m) => `meal-${m.id}` === activeId);
    if (!activeMealObj) {
      setOptimisticMeals(null);
      return;
    }

    // Day → Meals library: remove the scheduled copy from the week.
    // If this is the last row for this meal name, unschedule instead of deleting
    // so the meal stays in the library.
    if (isOverLibrary) {
      const nameKey = activeMealObj.name.trim().toLowerCase();
      const sameNameCount = displayMeals.filter(
        (m) => m.name.trim().toLowerCase() === nameKey
      ).length;
      const isLastInstance = sameNameCount <= 1;

      if (isLastInstance) {
        setOptimisticMeals(
          displayMeals.map((m) =>
            m.id === activeMealObj.id
              ? { ...m, scheduledDate: null, mealType: null, position: 0 }
              : m
          )
        );
        moveMutation.mutate(
          {
            id: activeMealObj.id,
            data: { scheduledDate: null, mealType: null, position: 0 },
          },
          {
            onSuccess: async () => {
              await queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
              await queryClient.invalidateQueries({ queryKey: ["/api/ingredients/weekly"] });
              setOptimisticMeals(null);
            },
            onError: () => {
              setOptimisticMeals(null);
              toast.error("Couldn't remove meal from week - please try again");
            },
          }
        );
      } else {
        setOptimisticMeals(displayMeals.filter((m) => m.id !== activeMealObj.id));
        deleteMutation.mutate(activeMealObj.id, {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/ingredients/weekly"] });
            setOptimisticMeals(null);
          },
          onError: () => {
            setOptimisticMeals(null);
            toast.error("Couldn't remove meal - please try again");
          },
        });
      }
      return;
    }

    // Day → day: move
    const target = resolveDayTarget(overId);
    if (!target) {
      setOptimisticMeals(null);
      return;
    }

    const { targetContainerId, newPosition } = target;
    const { newDate, newType } = parseDayTarget(targetContainerId);

    const newMeals = [...displayMeals];
    const mealIndex = newMeals.findIndex((m) => m.id === activeMealObj.id);
    if (mealIndex >= 0) newMeals.splice(mealIndex, 1);

    const updatedMeal: FormattedMeal = {
      ...activeMealObj,
      scheduledDate: newDate,
      mealType: newType as FormattedMeal["mealType"],
      position: newPosition,
    };

    const itemsInTarget = newMeals
      .filter((m) => m.scheduledDate === newDate && m.mealType === newType)
      .sort((a, b) => a.position - b.position);

    itemsInTarget.splice(newPosition, 0, updatedMeal);
    itemsInTarget.forEach((m, idx) => {
      m.position = idx;
    });

    const finalMeals = newMeals
      .filter((m) => !(m.scheduledDate === newDate && m.mealType === newType))
      .concat(itemsInTarget);

    setOptimisticMeals(finalMeals);

    moveMutation.mutate(
      {
        id: activeMealObj.id,
        data: {
          scheduledDate: newDate,
          mealType: newType,
          position: newPosition,
        },
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/ingredients/weekly"] });
          setOptimisticMeals(null);
        },
        onError: () => {
          setOptimisticMeals(null);
          toast.error("Couldn't move meal - please try again");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground font-medium">Setting the table...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-3 sm:px-6 py-3 sm:py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 sm:order-1">
            <CookingPot className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-lg sm:text-2xl font-bold text-foreground hidden sm:block">Meal Planner</h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 ml-auto sm:ml-0 sm:order-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full h-8 w-8 sm:h-9 sm:w-9">
              {theme === "dark" ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/70" />}
            </Button>
            <Button
              onClick={() => openAddDialog()}
              size="sm"
              className="rounded-xl font-medium bg-foreground text-background hover:bg-foreground/90 shadow-md transition-transform active:scale-95 text-xs sm:text-sm px-2 sm:px-4"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Meal</span>
            </Button>
            {authContext && <UserButton size="icon" />}
          </div>

          <div className="w-full flex justify-center order-last sm:w-auto sm:order-2 sm:flex-1 sm:justify-center sm:min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 bg-card border border-border/50 p-1 rounded-xl shadow-sm min-w-0 max-w-full">
              <Button variant="ghost" size="icon" onClick={() => setStartDate(subDays(startDate, 7))} className="rounded-lg h-8 w-8 sm:h-9 sm:w-9">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <span className="font-semibold text-xs sm:text-sm px-1 sm:px-3 text-center whitespace-nowrap truncate min-w-0">
                {format(startDate, "MMM d")} - {format(addDays(startDate, 6), "MMM d")}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setStartDate(addDays(startDate, 7))} className="rounded-lg h-8 w-8 sm:h-9 sm:w-9">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStartDate(startOfDay(new Date()))}
                className="ml-1 rounded-lg font-medium border-border/50 hidden md:flex text-xs"
              >
                Today
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex-1 overflow-auto p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                const dateStr = format(day, "yyyy-MM-dd");
                const slotId = `${dateStr}::${MEAL_TYPE_DINNER}`;
                const mealsInSlot = getMealsForSlot(dateStr);

                return (
                  <div
                    key={dateStr}
                    className={`
                      flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden
                      ${isToday ? "bg-primary/5 border border-primary/20 shadow-sm" : "bg-secondary/40 border border-border/40"}
                    `}
                  >
                    <div className={`p-2 sm:p-3 text-center border-b ${isToday ? "border-primary/20 bg-primary/10" : "border-border/50 bg-secondary/60"}`}>
                      <h3 className={`font-semibold text-sm sm:text-base ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "EEE")}
                      </h3>
                      <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground tracking-wider uppercase mt-0.5">
                        {format(day, "MMM d")}
                      </p>
                    </div>

                    <div className="flex-1 p-2 sm:p-3">
                      <SortableContext
                        id={slotId}
                        items={mealsInSlot.map((m) => `meal-${m.id}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <DroppableSlot id={slotId}>
                          {mealsInSlot.length === 0 && (
                            <div className="flex items-center justify-center text-muted-foreground/40 text-[10px] sm:text-xs font-medium uppercase tracking-wider py-2">
                              Drop here
                            </div>
                          )}
                          {mealsInSlot.map((meal) => (
                            <MealCard key={meal.id} meal={meal} onEdit={openEditDialog} onView={openViewDialog} />
                          ))}
                        </DroppableSlot>
                      </SortableContext>

                      <button
                        onClick={() => openAddDialog(day)}
                        className="w-full mt-2 py-1.5 rounded-xl text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-all text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span className="hidden sm:inline">Add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-secondary/30 border-t border-border/50 p-3 sm:p-6 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)] min-h-[50vh]">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 sm:gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Meals</h3>
                  <span className="bg-background px-2 py-0.5 rounded-full text-xs font-bold text-muted-foreground border border-border">
                    {libraryMeals.length}
                  </span>
                </div>

                <SortableContext
                  id="library"
                  items={libraryMeals.map((m) => `library-${m.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  <DroppableSlot id="library">
                    <div className="flex flex-wrap gap-2 sm:gap-3 min-h-[50px]">
                      {libraryMeals.length === 0 && (
                        <div className="w-full flex flex-col items-center justify-center text-muted-foreground/50 py-3">
                          <p className="text-xs sm:text-sm font-medium">No meals yet.</p>
                          <p className="text-[10px] sm:text-xs mt-1">Create a meal to add it to your library, then drag it to a day.</p>
                        </div>
                      )}
                      {libraryMeals.map((meal) => (
                        <div key={meal.id} className="w-full sm:w-[260px]">
                          <MealCard meal={meal} onEdit={openEditDialog} onView={openViewDialog} dragIdPrefix="library-" />
                        </div>
                      ))}
                    </div>
                  </DroppableSlot>
                </SortableContext>
              </div>

              <IngredientList ingredients={aggregatedIngredients} isLoading={ingredientsLoading} />
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
            {activeMeal ? (
              <div className="opacity-90 rotate-2 scale-105 shadow-2xl z-50 rounded-xl cursor-grabbing w-[85vw] max-w-[280px]">
                <MealCard meal={activeMeal} onEdit={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <MealFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingMeal}
        defaultDate={defaultDate}
        defaultMealType={MEAL_TYPE_DINNER}
      />
      <IngredientModal
        meal={viewingMeal}
        isOpen={isIngredientModalOpen}
        onClose={() => {
          setIsIngredientModalOpen(false);
          setViewingMeal(null);
        }}
      />
    </div>
  );
}
