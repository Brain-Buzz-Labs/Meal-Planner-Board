"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCreateMeal, useUpdateMeal } from "@/hooks/use-meals";
import { createIngredientDirect } from "@/hooks/use-ingredients";
import { format, parseISO } from "date-fns";
import type { FormattedMeal } from "@/lib/db/helpers";

interface PendingIngredient {
  name: string;
  measurement: string | null;
}

interface MealFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: FormattedMeal | null;
  defaultDate?: string;
  defaultMealType?: string;
}

export function MealFormDialog({ isOpen, onClose, initialData, defaultDate, defaultMealType }: MealFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingIngredients, setPendingIngredients] = useState<PendingIngredient[]>([]);
  const [newIngName, setNewIngName] = useState("");
  const [newIngMeasurement, setNewIngMeasurement] = useState("");
  const [isSavingIngredients, setIsSavingIngredients] = useState(false);

  const createMutation = useCreateMeal();
  const updateMutation = useUpdateMeal();

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || "");
        setSelectedDate(initialData.scheduledDate ? parseISO(initialData.scheduledDate) : undefined);
      } else {
        setName("");
        setDescription("");
        setSelectedDate(defaultDate ? parseISO(defaultDate) : undefined);
        setPendingIngredients([]);
        setNewIngName("");
        setNewIngMeasurement("");
      }
    }
  }, [isOpen, initialData, defaultDate, defaultMealType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const dateValue = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
    const mealTypeValue = "dinner";

    if (initialData) {
      updateMutation.mutate(
        {
          id: initialData.id,
          data: {
            name,
            description: description || null,
            scheduledDate: dateValue,
            mealType: mealTypeValue,
            position: initialData.position,
          },
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to update meal");
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          name,
          description: description || null,
          scheduledDate: dateValue,
          mealType: mealTypeValue,
        },
        {
          onSuccess: async (meal) => {
            if (pendingIngredients.length > 0) {
              setIsSavingIngredients(true);
              await Promise.all(
                pendingIngredients.map((ing) =>
                  createIngredientDirect(meal.id, { name: ing.name, measurement: ing.measurement })
                )
              );
              setIsSavingIngredients(false);
            }
            onClose();
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to create meal");
          },
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || isSavingIngredients;

  const handleAddIngredient = () => {
    const trimmed = newIngName.trim();
    if (!trimmed) return;
    setPendingIngredients((prev) => [...prev, { name: trimmed, measurement: newIngMeasurement.trim() || null }]);
    setNewIngName("");
    setNewIngMeasurement("");
  };

  const handleIngredientKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddIngredient();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[425px] rounded-2xl shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader className="pt-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {initialData ? "Edit Meal" : "Add New Meal"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the details of this meal"
              : "Add a meal to your board"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">Meal Name</Label>
            <Input
              id="name"
              placeholder="e.g. Spicy Basil Pasta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="bg-secondary/50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary text-base py-3 sm:py-6 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold">Description / Notes (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Recipe link, ingredients, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary/50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary resize-none h-24 rounded-xl"
            />
          </div>

          <div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal rounded-xl bg-secondary/50 border-transparent hover:bg-secondary"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedDate ? format(selectedDate, "MMM d, yyyy") : <span className="text-muted-foreground">Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date ?? undefined);
                      setCalendarOpen(false);
                    }}
                    autoFocus
                  />
                  {selectedDate && (
                    <div className="p-2 border-t border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={() => {
                          setSelectedDate(undefined);
                          setCalendarOpen(false);
                        }}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {!initialData && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Ingredients</Label>

              {pendingIngredients.length > 0 && (
                <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {pendingIngredients.map((ing, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/50 rounded-lg group">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-foreground">{ing.name}</span>
                        {ing.measurement && (
                          <span className="text-xs text-muted-foreground ml-2">({ing.measurement})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingIngredients((prev) => prev.filter((_, i) => i !== idx))}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        aria-label={`Remove ${ing.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ingredient</label>
                  <Input
                    placeholder="e.g. Chicken breast"
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    onKeyDown={handleIngredientKeyDown}
                    className="h-9 bg-secondary/50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl"
                  />
                </div>
                <div className="w-full sm:w-28">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Measurement</label>
                  <Input
                    placeholder="e.g. 2 cups"
                    value={newIngMeasurement}
                    onChange={(e) => setNewIngMeasurement(e.target.value)}
                    onKeyDown={handleIngredientKeyDown}
                    className="h-9 bg-secondary/50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddIngredient}
                  disabled={!newIngName.trim()}
                  className="h-9 px-3 rounded-xl w-full sm:w-auto"
                  aria-label="Add ingredient"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-medium">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              className="rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
            >
              {isPending ? "Saving..." : initialData ? "Save Changes" : "Add Meal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
