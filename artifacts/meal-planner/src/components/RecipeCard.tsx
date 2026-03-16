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
        className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer pt-0.5"
        onClick={() => onView(meal)}
      >
        <UtensilsCrossed className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <h4 className="font-semibold text-sm text-card-foreground leading-tight truncate">
          {meal.name}
        </h4>
      </div>
    </div>
  );
}
