import { useState, useMemo } from "react";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  useDroppable,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from "@dnd-kit/core";
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from "@dnd-kit/sortable";
import { format, addDays, startOfDay, isSameDay, subDays } from "date-fns";
import { Plus, ChevronLeft, ChevronRight, Cat, Inbox, History, Sun, Moon, Egg, Salad, UtensilsCrossed } from "lucide-react";
import { useListMeals, useListDays, useMoveMeal, useCreateMeal, useListPastMeals, Meal, MealType, MealWithIngredients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { MealCard } from "@/components/MealCard";
import { MealFormDialog } from "@/components/MealFormDialog";
import { IngredientModal } from "@/components/IngredientModal";
import { RecipeCard } from "@/components/RecipeCard";
import { useTheme } from "@/hooks/use-theme";

const MEAL_TYPES = [MealType.breakfast, MealType.lunch, MealType.dinner] as const;

function DroppableSlot({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] bg-background/50 rounded-2xl p-2 border border-dashed flex flex-col gap-2 transition-colors group ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border/30"
      }`}
    >
      {children}
    </div>
  );
}

export default function Board() {
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultMealType, setDefaultMealType] = useState<MealType | undefined>();

  // Ingredient Modal State
  const [viewingMeal, setViewingMeal] = useState<Meal | null>(null);
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);

  const { data: serverMeals = [], isLoading } = useListMeals();
  const { data: pastMeals = [] } = useListPastMeals();
  const moveMutation = useMoveMeal();
  const createMutation = useCreateMeal();

  // Optimistic local state for smooth DND
  const [optimisticMeals, setOptimisticMeals] = useState<Meal[] | null>(null);
  
  // Sync server meals to local state when query updates, unless we are dragging
  const displayMeals = optimisticMeals || serverMeals;

  const { data: serverDays = [] } = useListDays({
    startDate: format(startDate, "yyyy-MM-dd"),
    count: 7,
  });

  const days = useMemo(() => {
    if (serverDays.length > 0) {
      return serverDays.map(d => new Date(d.date + "T00:00:00"));
    }
    return Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  }, [serverDays, startDate]);

  const openAddDialog = (date?: Date, type?: MealType) => {
    setEditingMeal(null);
    setDefaultDate(date ? format(date, "yyyy-MM-dd") : undefined);
    setDefaultMealType(type);
    setIsDialogOpen(true);
  };

  const openEditDialog = (meal: Meal) => {
    setEditingMeal(meal);
    setDefaultDate(undefined);
    setDefaultMealType(undefined);
    setIsDialogOpen(true);
  };

  const openViewDialog = (meal: Meal) => {
    setViewingMeal(meal);
    setIsIngredientModalOpen(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px tolerance before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getMealsForSlot = (dateStr: string, type: MealType) => {
    return displayMeals
      .filter(m => m.scheduledDate === dateStr && m.mealType === type)
      .sort((a, b) => a.position - b.position);
  };

  const unscheduledMeals = displayMeals
    .filter(m => !m.scheduledDate)
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
        const [dateStr, type] = targetContainerId.split("::");
        newPosition = getMealsForSlot(dateStr, type as MealType).length;
      }
      return { targetContainerId, newPosition };
    }

    if (overId.startsWith("recipe-")) {
      return { targetContainerId: "previous-meals", newPosition: 0 };
    }

    const overMeal = displayMeals.find(m => `meal-${m.id}` === overId);
    if (overMeal) {
      if (!overMeal.scheduledDate) {
        const overIndex = unscheduledMeals.findIndex(m => m.id === overMeal.id);
        return { targetContainerId: "unscheduled", newPosition: Math.max(0, overIndex) };
      }
      const targetContainerId = `${overMeal.scheduledDate}::${overMeal.mealType}`;
      const slotMeals = getMealsForSlot(overMeal.scheduledDate, overMeal.mealType as MealType);
      const overIndex = slotMeals.findIndex(m => m.id === overMeal.id);
      return { targetContainerId, newPosition: Math.max(0, overIndex) };
    }
    return null;
  };

  const parseTarget = (targetContainerId: string) => {
    if (targetContainerId === "unscheduled") return { newDate: null as string | null, newType: null as MealType | null };
    const [d, t] = targetContainerId.split("::");
    return { newDate: d, newType: t as MealType };
  };

  // --- DND HANDLERS ---
  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    if (activeId.startsWith("meal-")) {
      const meal = displayMeals.find(m => `meal-${m.id}` === activeId);
      if (meal) {
        setActiveMeal(meal);
        if (!optimisticMeals) setOptimisticMeals(serverMeals);
      }
    } else if (activeId.startsWith("recipe-")) {
      const recipeId = parseInt(activeId.replace("recipe-", ""), 10);
      const recipe = pastMeals.find(m => m.id === recipeId);
      if (recipe) {
        setActiveMeal(recipe as Meal);
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
      const recipe = pastMeals.find(m => m.id === recipeId);
      if (!recipe) return;

      if (overId === "previous-meals" || overId.startsWith("recipe-")) return;

      const target = resolveTarget(overId);
      if (!target) return;
      const { newDate, newType } = parseTarget(target.targetContainerId);

      createMutation.mutate({
        data: {
          name: recipe.name,
          description: recipe.description ?? undefined,
          scheduledDate: newDate,
          mealType: newType,
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
          queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
          toast.success(`Scheduled "${recipe.name}"`);
        },
        onError: () => {
          toast.error("Couldn't schedule recipe — please try again");
        }
      });
      return;
    }

    const activeMealObj = displayMeals.find(m => `meal-${m.id}` === activeId);
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

    const newMeals = [...displayMeals];
    const mealIndex = newMeals.findIndex(m => m.id === activeMealObj.id);
    if (mealIndex >= 0) newMeals.splice(mealIndex, 1);

    const updatedMeal = {
      ...activeMealObj,
      scheduledDate: newDate,
      mealType: newType,
      position: newPosition
    };

    const itemsInTarget = newMeals
      .filter(m => m.scheduledDate === newDate && m.mealType === newType)
      .sort((a, b) => a.position - b.position);

    itemsInTarget.splice(newPosition, 0, updatedMeal);
    itemsInTarget.forEach((m, idx) => { m.position = idx; });

    const finalMeals = newMeals
      .filter(m => !(m.scheduledDate === newDate && m.mealType === newType))
      .concat(itemsInTarget);

    setOptimisticMeals(finalMeals);

    moveMutation.mutate({
      id: activeMealObj.id,
      data: {
        scheduledDate: newDate,
        mealType: newType,
        position: newPosition
      }
    }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
        setOptimisticMeals(null);
      },
      onError: () => {
        setOptimisticMeals(null);
        toast.error("Couldn't move meal — please try again");
      }
    });
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
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Cat className="w-10 h-10 text-primary" />
          <h1 className="text-2xl font-bold text-foreground hidden sm:block">Cat Food</h1>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border/50 p-1 rounded-xl shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setStartDate(subDays(startDate, 7))} className="rounded-lg h-9 w-9">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm px-3 w-40 text-center">
            {format(startDate, "MMM d")} - {format(addDays(startDate, 6), "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setStartDate(addDays(startDate, 7))} className="rounded-lg h-9 w-9">
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setStartDate(startOfDay(new Date()))}
            className="ml-2 rounded-lg font-medium border-border/50 hidden md:flex"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === "dark" ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-foreground/70" />}
          </Button>
          <Button 
            onClick={() => openAddDialog()} 
            className="rounded-xl font-medium bg-foreground text-background hover:bg-foreground/90 shadow-md transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Meal
          </Button>
        </div>
      </header>
      {/* MAIN BOARD */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          {/* HORIZONTAL DAYS AREA */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
            <div className="flex gap-6 min-w-max h-full">
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                const dateStr = format(day, "yyyy-MM-dd");

                return (
                  <div 
                    key={dateStr}
                    className={`
                      w-[320px] flex-shrink-0 flex flex-col rounded-3xl overflow-hidden
                      ${isToday ? 'bg-primary/5 border border-primary/20 shadow-sm' : 'bg-secondary/40 border border-border/40'}
                    `}
                  >
                    <div className={`p-4 text-center border-b ${isToday ? 'border-primary/20 bg-primary/10' : 'border-border/50 bg-secondary/60'}`}>
                      <h3 className={`font-semibold text-lg ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {format(day, "EEEE")}
                      </h3>
                      <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mt-1">
                        {format(day, "MMM d")}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                      {MEAL_TYPES.map((type) => {
                        const slotId = `${dateStr}::${type}`;
                        const mealsInSlot = getMealsForSlot(dateStr, type);

                        return (
                          <div key={slotId} className="flex flex-col">
                            <div className="flex items-center justify-between mb-3 px-1">
                              <h4 className="text-sm font-bold text-foreground/80 capitalize tracking-wide flex items-center gap-2">
                                {type === "breakfast" && <Egg className="w-4 h-4 text-muted-foreground" />}
                                {type === "lunch" && <Salad className="w-4 h-4 text-muted-foreground" />}
                                {type === "dinner" && <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />}
                                {type}
                              </h4>
                              <button 
                                onClick={() => openAddDialog(day, type)}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-background hover:text-primary hover:shadow-sm transition-all"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <SortableContext 
                              id={slotId}
                              items={mealsInSlot.map(m => `meal-${m.id}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              <DroppableSlot id={slotId}>
                                {mealsInSlot.length === 0 && (
                                  <div className="flex-1 flex items-center justify-center text-muted-foreground/40 text-xs font-medium uppercase tracking-wider h-full">
                                    Drop here
                                  </div>
                                )}
                                {mealsInSlot.map(meal => (
                                  <MealCard key={meal.id} meal={meal} onEdit={openEditDialog} onView={openViewDialog} />
                                ))}
                              </DroppableSlot>
                            </SortableContext>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOTTOM PANEL — Two columns */}
          <div className="bg-secondary/30 border-t border-border/50 p-6 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
              {/* Left: Unscheduled Ideas */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <Inbox className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Unscheduled Ideas</h3>
                  <span className="bg-background px-2 py-0.5 rounded-full text-xs font-bold text-muted-foreground border border-border">
                    {unscheduledMeals.length}
                  </span>
                </div>
                
                <SortableContext 
                  id="unscheduled"
                  items={unscheduledMeals.map(m => `meal-${m.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  <DroppableSlot id="unscheduled">
                    <div className="flex flex-wrap gap-3 min-h-[60px]">
                      {unscheduledMeals.length === 0 && (
                        <div className="w-full flex flex-col items-center justify-center text-muted-foreground/50 py-4">
                          <p className="text-sm font-medium">No loose ideas right now.</p>
                          <p className="text-xs mt-1">Create a new meal without a date to save it here.</p>
                        </div>
                      )}
                      {unscheduledMeals.map(meal => (
                        <div key={meal.id} className="w-[280px]">
                          <MealCard meal={meal} onEdit={openEditDialog} onView={openViewDialog} />
                        </div>
                      ))}
                    </div>
                  </DroppableSlot>
                </SortableContext>
              </div>

              {/* Right: Previously Made */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Previously Made</h3>
                  <span className="bg-background px-2 py-0.5 rounded-full text-xs font-bold text-muted-foreground border border-border">
                    {pastMeals.length}
                  </span>
                </div>
                <SortableContext
                  id="previous-meals"
                  items={pastMeals.map(m => `recipe-${m.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  <DroppableSlot id="previous-meals">
                    <div className="flex flex-wrap gap-3 min-h-[60px]">
                      {pastMeals.length === 0 ? (
                        <div className="w-full flex flex-col items-center justify-center text-muted-foreground/50 py-4">
                          <p className="text-sm font-medium">No past recipes yet.</p>
                          <p className="text-xs mt-1">Meals from previous days will show up here.</p>
                        </div>
                      ) : (
                        pastMeals.map(meal => (
                          <RecipeCard key={meal.id} meal={meal} onView={openViewDialog} />
                        ))
                      )}
                    </div>
                  </DroppableSlot>
                </SortableContext>
              </div>
            </div>
          </div>

          {/* DRAG OVERLAY */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeMeal ? (
              <div className="opacity-90 rotate-2 scale-105 shadow-2xl z-50 rounded-xl cursor-grabbing">
                <MealCard meal={activeMeal} onEdit={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
      {/* DIALOGS */}
      <MealFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingMeal}
        defaultDate={defaultDate}
        defaultMealType={defaultMealType}
      />
      <IngredientModal
        meal={viewingMeal}
        isOpen={isIngredientModalOpen}
        onClose={() => { setIsIngredientModalOpen(false); setViewingMeal(null); }}
      />
    </div>
  );
}
