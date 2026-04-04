import { NextRequest, NextResponse } from "next/server";
import { eq, and, lt } from "drizzle-orm";
import { db, mealsTable, ingredientsTable } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { formatMeal } from "@/lib/db/helpers";

export async function GET(request: NextRequest) {
  const userId = requireUserId(request);
  const today = new Date().toISOString().split("T")[0];

  const pastMeals = await db
    .select()
    .from(mealsTable)
    .where(and(eq(mealsTable.userId, userId), lt(mealsTable.scheduledDate, today)))
    .orderBy(mealsTable.scheduledDate);

  // Deduplicate by name (keep most recent)
  const seen = new Map<string, typeof pastMeals[0]>();
  for (const meal of pastMeals) {
    const key = meal.name.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || (meal.scheduledDate && (!existing.scheduledDate || meal.scheduledDate > existing.scheduledDate))) {
      seen.set(key, meal);
    }
  }

  const uniqueMeals = Array.from(seen.values());

  const result = await Promise.all(
    uniqueMeals.map(async (meal) => {
      const ingredients = await db
        .select()
        .from(ingredientsTable)
        .where(eq(ingredientsTable.mealId, meal.id))
        .orderBy(ingredientsTable.id);

      return {
        ...formatMeal(meal),
        ingredients: ingredients.map((i) => ({
          id: i.id,
          mealId: i.mealId,
          name: i.name,
          measurement: i.measurement ?? null,
          createdAt: i.createdAt.toISOString(),
        })),
      };
    })
  );

  return NextResponse.json(result);
}
