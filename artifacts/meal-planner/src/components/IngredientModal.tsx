import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Plus, UtensilsCrossed } from "lucide-react";
import {
  Meal,
  Ingredient,
  useListIngredients,
  useCreateIngredient,
  useDeleteIngredient,
  getListIngredientsQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface IngredientModalProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
}

export function IngredientModal({ meal, isOpen, onClose }: IngredientModalProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newMeasurement, setNewMeasurement] = useState("");

  const mealId = meal?.id ?? 0;
  const queryKey = getListIngredientsQueryKey(mealId);

  const { data: ingredients = [], isLoading } = useListIngredients(mealId, {
    query: { enabled: isOpen && mealId > 0 },
  });

  const createMutation = useCreateIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
        setNewName("");
        setNewMeasurement("");
      },
    },
  });

  const deleteMutation = useDeleteIngredient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    },
  });

  const handleAdd = () => {
    const trimmedName = newName.trim();
    if (!trimmedName || !mealId) return;
    createMutation.mutate({
      id: mealId,
      data: {
        name: trimmedName,
        measurement: newMeasurement.trim() || null,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            {meal?.name ?? "Meal"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading ingredients...</p>
          ) : ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No ingredients yet. Add some below!</p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {ingredients.map((ing: Ingredient) => (
                <li key={ing.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/50 rounded-lg group">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-foreground">{ing.name}</span>
                    {ing.measurement && (
                      <span className="text-xs text-muted-foreground ml-2">({ing.measurement})</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate({ id: mealId, ingredientId: ing.id })}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    aria-label={`Remove ${ing.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 items-end border-t border-border pt-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ingredient</label>
              <Input
                placeholder="e.g. Chicken breast"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-9"
              />
            </div>
            <div className="w-32">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Measurement</label>
              <Input
                placeholder="e.g. 2 cups"
                value={newMeasurement}
                onChange={(e) => setNewMeasurement(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newName.trim() || createMutation.isPending}
              className="h-9 px-3"
              aria-label="Add ingredient"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
