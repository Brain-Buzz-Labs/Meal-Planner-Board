import { format, parseISO } from "date-fns";
import { UtensilsCrossed, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MealWithIngredients } from "@workspace/api-client-react";

interface RecipeCardProps {
  meal: MealWithIngredients;
  onView: (meal: MealWithIngredients) => void;
}

export function RecipeCard({ meal, onView }: RecipeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `recipe-${meal.id}`,
    data: {
      type: "Recipe",
      meal,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative flex items-start gap-2 p-3 bg-card rounded-xl border border-border/50
        shadow-sm hover:shadow-md transition-all duration-200 w-[280px]
        ${isDragging ? "opacity-50 ring-2 ring-primary scale-[1.02] shadow-xl z-50" : ""}
      `}
    >
      <div
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onView(meal)}
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
    </div>
  );
}
