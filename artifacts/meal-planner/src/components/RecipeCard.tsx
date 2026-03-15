import { format, parseISO } from "date-fns";
import { UtensilsCrossed } from "lucide-react";
import type { MealWithIngredients, Meal } from "@workspace/api-client-react";

interface RecipeCardProps {
  meal: MealWithIngredients;
  onView: (meal: Meal) => void;
}

export function RecipeCard({ meal, onView }: RecipeCardProps) {
  return (
    <div
      onClick={() => onView(meal as Meal)}
      className="p-3 bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer w-[280px]"
    >
      <div className="flex items-center gap-2 mb-2">
        <UtensilsCrossed className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <h4 className="font-semibold text-sm text-card-foreground leading-tight truncate">
          {meal.name}
        </h4>
      </div>

      {meal.scheduledDate && (
        <p className="text-xs text-muted-foreground mb-2">
          Last made: {format(parseISO(meal.scheduledDate), "MMM d, yyyy")}
        </p>
      )}

      {meal.ingredients.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {meal.ingredients.map((ing) => (
            <li key={ing.id} className="text-xs text-foreground/70 flex items-baseline gap-1">
              <span className="w-1 h-1 rounded-full bg-primary/40 flex-shrink-0 mt-1.5" />
              <span>{ing.name}</span>
              {ing.measurement && (
                <span className="text-muted-foreground">— {ing.measurement}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground/50 italic">No ingredients listed</p>
      )}
    </div>
  );
}
