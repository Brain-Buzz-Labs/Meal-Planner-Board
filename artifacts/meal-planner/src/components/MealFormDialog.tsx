import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Meal, MealType, useCreateMeal, useUpdateMeal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

interface MealFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Meal | null;
  defaultDate?: string;
  defaultMealType?: MealType;
}

function parseDateString(dateStr: string): Date {
  return parseISO(dateStr);
}

export function MealFormDialog({ isOpen, onClose, initialData, defaultDate, defaultMealType }: MealFormDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedMealType, setSelectedMealType] = useState<string>("dinner");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const createMutation = useCreateMeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
        onClose();
      }
    }
  });

  const updateMutation = useUpdateMeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/meals/past"] });
        onClose();
      }
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || "");
        setSelectedDate(initialData.scheduledDate ? parseDateString(initialData.scheduledDate) : undefined);
        setSelectedMealType(initialData.mealType || "dinner");
      } else {
        setName("");
        setDescription("");
        setSelectedDate(defaultDate ? parseDateString(defaultDate) : undefined);
        setSelectedMealType(defaultMealType || "dinner");
      }
    }
  }, [isOpen, initialData, defaultDate, defaultMealType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const dateValue = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
    const mealTypeValue = (selectedMealType as MealType) || MealType.dinner;

    if (initialData) {
      updateMutation.mutate({
        id: initialData.id,
        data: {
          name,
          description: description || null,
          scheduledDate: dateValue,
          mealType: mealTypeValue,
          position: initialData.position,
        }
      });
    } else {
      createMutation.mutate({
        data: {
          name,
          description: description || null,
          scheduledDate: dateValue,
          mealType: mealTypeValue,
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[425px] rounded-2xl overflow-hidden shadow-2xl">
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

          <div className="grid grid-cols-2 gap-4">
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
                    initialFocus
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
