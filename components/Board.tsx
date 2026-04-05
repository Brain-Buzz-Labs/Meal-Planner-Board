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
import { Plus, ChevronLeft, ChevronRight, CookingPot, Inbox, History, Sun, Moon } from "lucide-react";
import { UserButton, AuthUIContext } from "@neondatabase/auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { useListMeals, useListPastMeals, useListDays, useMoveMeal, useCreateMeal } from "@/hooks/use-meals";
import { MealCard } from "@/components/MealCard";
import { MealFormDialog } from "@/components/MealFormDialog";
import { IngredientModal } from "@/components/IngredientModal";
import { RecipeCard } from "@/components/RecipeCard";
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
  const { data: pastMeals = [] } = useListPastMeals();
  const moveMutation = useMoveMeal();
  const createMutation = useCreateMeal();

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

  const unscheduledMeals = displayMeals
    .filter((m) => !m.scheduledDate)
    .sort((a, b) => a.position - b.position);

  const resolveTarget = (overId: string): { targetContainerId: string; newPosition: number } | null => {
    const isOverContainer = overId.includes("::") || overId === "unscheduled" || overId === "previous-meals";
    if (isOverContainer) {
      const targetContainerId = overId;
      let newPosition = 0;
      if (targetContainerId === "unscheduled") {
        newPosition = unscheduledMeals.length;
      } else if (targetContainerId === "previous-meals") {
        return null;
      } else {
        const [dateStr] = targetContainerId.split("::");
        newPosition = getMealsForSlot(dateStr).length;
      }
      return { targetContainerId, newPosition };
    }

    if (overId.startsWith("recipe-")) {
      return { targetContainerId: "previous-meals", newPosition: 0 };
    }

    const overMeal = displayMeals.find((m) => `meal-${m.id}` === overId);
    if (overMeal) {
      if (!overMeal.scheduledDate) {
        const overIndex = unscheduledMeals.findIndex((m) => m.id === overMeal.id);
        return { targetContainerId: "unscheduled", newPosition: Math.max(0, overIndex) };
      }
      const targetContainerId = `${overMeal.scheduledDate}::${MEAL_TYPE_DINNER}`;
      const slotMeals = getMealsForSlot(overMeal.scheduledDate);
      const overIndex = slotMeals.findIndex((m) => m.id === overMeal.id);
      return { targetContainerId, newPosition: Math.max(0, overIndex) };
    }
    return null;
  };

  const parseTarget = (targetContainerId: string) => {
    if (targetContainerId === "unscheduled") return { newDate: null as string | null, newType: null as string | null };
    const [d] = targetContainerId.split("::");
    return { newDate: d, newType: MEAL_TYPE_DINNER as string };
  };

  const onDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;

    if (activeId.startsWith("meal-")) {
      const meal = displayMeals.find((m) => `meal-${m.id}` === activeId);
      if (meal) {
        setActiveMeal(meal);
        if (!optimisticMeals) setOptimisticMeals(serverMeals);
      }
    } else if (activeId.startsWith("recipe-")) {
      const recipeId = parseInt(activeId.replace("recipe-", ""), 10);
      const recipe = pastMeals.find((m) => m.id === recipeId);
      if (recipe) {
        setActiveMeal(recipe);
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
    const isRecipeDrag = activeId.startsWith("recipe-");

    if (isRecipeDrag) {
      const recipeId = parseInt(activeId.replace("recipe-", ""), 10);
      const recipe = pastMeals.find((m) => m.id === recipeId);
      if (!recipe) return;

      if (overId === "previous-meals" || overId.startsWith("recipe-")) return;

      const target = resolveTarget(overId);
      if (!target) return;
      const { newDate, newType } = parseTarget(target.targetContainerId);

      createMutation.mutate(
        {
          name: recipe.name,
          description: recipe.description ?? undefined,
          scheduledDate: newDate,
          mealType: newType,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
            toast.success(`Scheduled "${recipe.name}"`);
          },
          onError: () => {
            toast.error("Couldn't schedule recipe - please try again");
          },
        }
      );
      return;
    }

    const activeMealObj = displayMeals.find((m) => `meal-${m.id}` === activeId);
    if (!activeMealObj) {
      setOptimisticMeals(null);
      return;
    }

    const target = resolveTarget(overId);
    if (!target) {
      setOptimisticMeals(null);
      return;
    }

    let { targetContainerId, newPosition } = target;
    if (targetContainerId === "previous-meals") {
      targetContainerId = "unscheduled";
      newPosition = unscheduledMeals.length;
    }
    const { newDate, newType } = parseTarget(targetContainerId);

    // Optimistic update
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
          await queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
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
                  <Inbox className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Unscheduled Ideas</h3>
                  <span className="bg-background px-2 py-0.5 rounded-full text-xs font-bold text-muted-foreground border border-border">
                    {unscheduledMeals.length}
                  </span>
                </div>

                <SortableContext
                  id="unscheduled"
                  items={unscheduledMeals.map((m) => `meal-${m.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  <DroppableSlot id="unscheduled">
                    <div className="flex flex-wrap gap-2 sm:gap-3 min-h-[50px]">
                      {unscheduledMeals.length === 0 && (
                        <div className="w-full flex flex-col items-center justify-center text-muted-foreground/50 py-3">
                          <p className="text-xs sm:text-sm font-medium">No loose ideas right now.</p>
                          <p className="text-[10px] sm:text-xs mt-1">Create a new meal without a date to save it here.</p>
                        </div>
                      )}
                      {unscheduledMeals.map((meal) => (
                        <div key={meal.id} className="w-full sm:w-[260px]">
                          <MealCard meal={meal} onEdit={openEditDialog} onView={openViewDialog} />
                        </div>
                      ))}
                    </div>
                  </DroppableSlot>
                </SortableContext>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <History className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Previously Made</h3>
                  <span className="bg-background px-2 py-0.5 rounded-full text-xs font-bold text-muted-foreground border border-border">
                    {pastMeals.length}
                  </span>
                </div>
                <SortableContext
                  id="previous-meals"
                  items={pastMeals.map((m) => `recipe-${m.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  <DroppableSlot id="previous-meals">
                    <div className="flex flex-wrap gap-2 sm:gap-3 min-h-[50px]">
                      {pastMeals.length === 0 ? (
                        <div className="w-full flex flex-col items-center justify-center text-muted-foreground/50 py-3">
                          <p className="text-xs sm:text-sm font-medium">No past recipes yet.</p>
                          <p className="text-[10px] sm:text-xs mt-1">Meals from previous days will show up here.</p>
                        </div>
                      ) : (
                        pastMeals.map((meal) => (
                          <div key={meal.id} className="w-full sm:w-[260px]">
                            <RecipeCard meal={meal} onView={openViewDialog} />
                          </div>
                        ))
                      )}
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
