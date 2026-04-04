"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { FormattedMeal } from "@/lib/db/helpers";

interface RecipeCardProps {
  meal: FormattedMeal;
  onView?: (meal: FormattedMeal) => void;
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
        shadow-sm hover:shadow-md transition-all duration-200
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
        className="flex-1 min-w-0 flex flex-col pt-0.5 cursor-pointer"
        onClick={() => onView?.(meal)}
      >
        <h4 className="font-semibold text-sm text-card-foreground leading-tight truncate">
          {meal.name}
        </h4>
        {meal.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {meal.description}
          </p>
        )}
      </div>
    </div>
  );
}
