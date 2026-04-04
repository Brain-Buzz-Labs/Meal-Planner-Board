import { z } from "zod";

export const createMealSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner"]).nullable().optional(),
});

export const updateMealSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner"]).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const moveMealSchema = z.object({
  scheduledDate: z.string().nullable().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner"]).nullable().optional(),
  position: z.number().int().min(0),
});

export const createIngredientSchema = z.object({
  name: z.string().min(1),
  measurement: z.string().nullable().optional(),
});

export const listDaysSchema = z.object({
  startDate: z.string().optional(),
  count: z.coerce.number().int().min(1).max(31).optional().default(7),
});
