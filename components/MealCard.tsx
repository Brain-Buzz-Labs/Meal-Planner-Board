"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Edit2, Trash2, GripVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteMeal } from "@/hooks/use-meals";
import type { FormattedMeal } from "@/lib/db/helpers";

interface MealCardProps {
  meal: FormattedMeal;
  onEdit: (meal: FormattedMeal) => void;
  onView?: (meal: FormattedMeal) => void;
  dragIdPrefix?: string;
}

export function MealCard({ meal, onEdit, onView, dragIdPrefix = "meal-" }: MealCardProps) {
  const deleteMutation = useDeleteMeal();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${dragIdPrefix}${meal.id}`,
    data: {
      type: "Meal",
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
        className="mt-1 p-1 -m-1 sm:p-0 sm:m-0 sm:mt-1 touch-none cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors"
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="sm:opacity-0 sm:group-hover:opacity-100 p-2 sm:p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-xl">
          <DropdownMenuItem onClick={() => onEdit(meal)} className="cursor-pointer gap-2 rounded-lg">
            <Edit2 className="w-4 h-4 text-primary" />
            <span>Edit meal</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => deleteMutation.mutate(meal.id)}
            className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
