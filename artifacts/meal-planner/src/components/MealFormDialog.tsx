import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Meal, MealType, useCreateMeal, useUpdateMeal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface MealFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Meal | null;
  defaultDate?: string;
  defaultMealType?: MealType;
}

export function MealFormDialog({ isOpen, onClose, initialData, defaultDate, defaultMealType }: MealFormDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const createMutation = useCreateMeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
        onClose();
      }
    }
  });

  const updateMutation = useUpdateMeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
        onClose();
      }
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || "");
      } else {
        setName("");
        setDescription("");
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (initialData) {
      updateMutation.mutate({
        id: initialData.id,
        data: {
          name,
          description: description || null,
          scheduledDate: initialData.scheduledDate,
          mealType: initialData.mealType,
          position: initialData.position,
        }
      });
    } else {
      createMutation.mutate({
        data: {
          name,
          description: description || null,
          scheduledDate: defaultDate || null,
          mealType: defaultMealType || null,
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl overflow-hidden shadow-2xl">
        <DialogHeader className="pt-2">
          <DialogTitle className="text-2xl font-display text-foreground">
            {initialData ? "Edit Meal" : "Add New Meal"}
          </DialogTitle>
          <DialogDescription>
            {defaultDate && defaultMealType 
              ? `Planning for ${defaultMealType} on ${format(new Date(defaultDate), "MMM d")}`
              : "Add a meal to your board"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">Meal Name</Label>
            <Input
              id="name"
              placeholder="e.g. Spicy Basil Pasta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="bg-secondary/50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary text-base py-6 rounded-xl"
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
          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-medium">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || isPending}
              className="rounded-xl font-medium bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
            >
              {isPending ? "Saving..." : initialData ? "Save Changes" : "Add Meal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
