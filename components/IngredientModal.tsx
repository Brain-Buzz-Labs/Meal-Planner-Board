"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, UtensilsCrossed, Pencil } from "lucide-react";
import { useListIngredients, useCreateIngredient, useDeleteIngredient } from "@/hooks/use-ingredients";
import { useUpdateMeal } from "@/hooks/use-meals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormattedMeal } from "@/lib/db/helpers";

interface IngredientModalProps {
  meal: FormattedMeal | null;
  isOpen: boolean;
  onClose: () => void;
}

export function IngredientModal({ meal, isOpen, onClose }: IngredientModalProps) {
  const [newName, setNewName] = useState("");
  const [newMeasurement, setNewMeasurement] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const mealId = meal?.id ?? 0;

  useEffect(() => {
    if (meal) setDisplayName(meal.name);
  }, [meal]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (!isOpen) setIsEditingName(false);
  }, [isOpen]);

  const updateMealMutation = useUpdateMeal();
  const { data: ingredients = [], isLoading } = useListIngredients(mealId, isOpen && mealId > 0);
  const createMutation = useCreateIngredient(mealId);
  const deleteMutation = useDeleteIngredient(mealId);

  const startEditingName = () => {
    setEditedName(displayName);
    setIsEditingName(true);
  };

  const saveName = () => {
    const trimmed = editedName.trim();
    if (!trimmed || !meal || trimmed === displayName) {
      setIsEditingName(false);
      return;
    }
    updateMealMutation.mutate(
      { id: meal.id, data: { name: trimmed } },
      {
        onSuccess: () => {
          setDisplayName(trimmed);
          setIsEditingName(false);
        },
      }
    );
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveName();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
    }
  };

  const handleAdd = () => {
    const trimmedName = newName.trim();
    if (!trimmedName || !mealId) return;
    createMutation.mutate(
      { name: trimmedName, measurement: newMeasurement.trim() || null },
      {
        onSuccess: () => {
          setNewName("");
          setNewMeasurement("");
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary flex-shrink-0" />
            {isEditingName ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input
                  ref={nameInputRef}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={saveName}
                  className="h-8 text-lg font-semibold"
                />
              </div>
            ) : (
              <button
                onClick={startEditingName}
                className="flex items-center gap-1.5 group/name hover:text-primary transition-colors text-left min-w-0"
              >
                <span className="truncate">{displayName || "Meal"}</span>
                <Pencil className="w-3.5 h-3.5 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground" />
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading ingredients...</p>
          ) : ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No ingredients yet. Add some below!</p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/50 rounded-lg group">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-foreground">{ing.name}</span>
                    {ing.measurement && (
                      <span className="text-xs text-muted-foreground ml-2">({ing.measurement})</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(ing.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    aria-label={`Remove ${ing.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end border-t border-border pt-3">
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
            <div className="w-full sm:w-32">
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
              className="h-9 px-3 w-full sm:w-auto"
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
