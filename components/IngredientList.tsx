"use client";

import { ShoppingCart } from "lucide-react";
import type { AggregatedIngredient } from "@/lib/aggregate-ingredients";

interface IngredientListProps {
  ingredients: AggregatedIngredient[];
  isLoading: boolean;
}

export function IngredientList({ ingredients, isLoading }: IngredientListProps) {
  const totalCount = ingredients.length;

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        <h3 className="font-semibold text-sm sm:text-base text-foreground">Ingredient List</h3>
        <span className="bg-background px-2 py-0.5 rounded-full text-xs font-bold text-muted-foreground border border-border">
          {totalCount}
        </span>
      </div>

      <div className="flex-1 overflow-auto min-h-[50px] rounded-2xl border border-border/40 bg-secondary/40 p-3 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-pulse text-muted-foreground/50 text-xs sm:text-sm font-medium">
              Loading ingredients...
            </div>
          </div>
        ) : ingredients.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50 py-3">
            <p className="text-xs sm:text-sm font-medium">No ingredients yet.</p>
            <p className="text-[10px] sm:text-xs mt-1">Add ingredients to your scheduled meals to see them here.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {ingredients.map((item) => (
              <li
                key={item.name}
                className="flex items-baseline justify-between gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-background/60 border border-border/30"
              >
                <span className="font-medium text-xs sm:text-sm text-foreground truncate">
                  {item.name}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {item.entries.map((e) => e.display).filter(Boolean).join(", ") || ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
