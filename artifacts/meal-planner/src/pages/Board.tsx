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
import { Plus, ChevronLeft, ChevronRight, Inbox, Sun, Moon, Egg, Salad, UtensilsCrossed } from "lucide-react";
import { useListMeals, useListDays, useMoveMeal, Meal, MealType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import { MealCard } from "@/components/MealCard";
import { MealFormDialog } from "@/components/MealFormDialog";
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

  const { data: serverMeals = [], isLoading } = useListMeals();
  const moveMutation = useMoveMeal();

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

  // --- DND HANDLERS ---
  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const meal = displayMeals.find(m => `meal-${m.id}` === active.id);
    if (meal) {
      setActiveMeal(meal);
      // Initialize optimistic state if not already
      if (!optimisticMeals) setOptimisticMeals(serverMeals);
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // We can handle visual shifting here if we want items to move while dragging over other items
    // But since our columns are small and we snap on Drop, we'll keep the core mutation in DragEnd.
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveMeal(null);
    const { active, over } = event;
    
    if (!over) {
      setOptimisticMeals(null); // revert
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the dragged meal
    const activeMealObj = displayMeals.find(m => `meal-${m.id}` === activeId);
    if (!activeMealObj) return;

    // Determine target container and new position
    let targetContainerId = "";
    let newPosition = 0;

    const isOverContainer = overId.includes("::") || overId === "unscheduled";
    
    if (isOverContainer) {
      // Dropped directly on a container area
      targetContainerId = overId;
      // Get items in that container to put it at the end
      if (targetContainerId === "unscheduled") {
        newPosition = unscheduledMeals.length;
      } else {
        const [dateStr, type] = targetContainerId.split("::");
        newPosition = getMealsForSlot(dateStr, type as MealType).length;
      }
    } else {
      // Dropped over another item
      const overMeal = displayMeals.find(m => `meal-${m.id}` === overId);
      if (overMeal) {
        if (!overMeal.scheduledDate) {
          targetContainerId = "unscheduled";
          const overIndex = unscheduledMeals.findIndex(m => m.id === overMeal.id);
          newPosition = overIndex;
        } else {
          targetContainerId = `${overMeal.scheduledDate}::${overMeal.mealType}`;
          const slotMeals = getMealsForSlot(overMeal.scheduledDate, overMeal.mealType as MealType);
          const overIndex = slotMeals.findIndex(m => m.id === overMeal.id);
          newPosition = overIndex; // Insert at that index
        }
      } else {
        setOptimisticMeals(null);
        return;
      }
    }

    let newDate: string | null = null;
    let newType: MealType | null = null;

    if (targetContainerId !== "unscheduled") {
      const [d, t] = targetContainerId.split("::");
      newDate = d;
      newType = t as MealType;
    }

    // Apply optimistic update
    const newMeals = [...displayMeals];
    const mealIndex = newMeals.findIndex(m => m.id === activeMealObj.id);
    
    // Remove from old pos
    newMeals.splice(mealIndex, 1);
    
    // Create updated meal
    const updatedMeal = {
      ...activeMealObj,
      scheduledDate: newDate,
      mealType: newType,
      position: newPosition
    };

    // We also need to re-adjust positions for other items in the target container
    const itemsInTarget = newMeals
      .filter(m => m.scheduledDate === newDate && m.mealType === newType)
      .sort((a, b) => a.position - b.position);
    
    // Insert updated meal into sorted array
    itemsInTarget.splice(newPosition, 0, updatedMeal);
    
    // Reassign strict sequential positions
    itemsInTarget.forEach((m, idx) => { m.position = idx; });

    // Update the main array
    const finalMeals = newMeals
      .filter(m => !(m.scheduledDate === newDate && m.mealType === newType)) // remove old target items
      .concat(itemsInTarget); // add adjusted target items

    setOptimisticMeals(finalMeals);

    // Fire mutation
    moveMutation.mutate({
      id: activeMealObj.id,
      data: {
        scheduledDate: newDate,
        mealType: newType,
        position: newPosition
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
        // Let React Query sync it, then clear optimistic
        setTimeout(() => setOptimisticMeals(null), 300);
      },
      onError: () => {
        setOptimisticMeals(null); // revert on fail
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
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Inbox className="text-white w-5 h-5" />
          </div>
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
                                  <MealCard key={meal.id} meal={meal} onEdit={openEditDialog} />
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

          {/* UNSCHEDULED POOL DRAWER (Bottom) */}
          <div className="bg-secondary/30 border-t border-border/50 p-6 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
            <div className="max-w-7xl mx-auto">
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
                        <MealCard meal={meal} onEdit={openEditDialog} />
                      </div>
                    ))}
                  </div>
                </DroppableSlot>
              </SortableContext>
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
    </div>
  );
}
