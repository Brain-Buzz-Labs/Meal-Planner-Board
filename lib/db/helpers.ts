import { eq, and, isNull, sql } from "drizzle-orm";
import { db, mealsTable, type MealType } from "./index";

export function formatMeal(m: typeof mealsTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    description: m.description ?? null,
    scheduledDate: m.scheduledDate ?? null,
    mealType: (m.mealType ?? null) as MealType | null,
    position: m.position,
    createdAt: m.createdAt.toISOString(),
  };
}

export type FormattedMeal = ReturnType<typeof formatMeal>;

export async function getNextPosition(userId: string, scheduledDate: string | null, mealType: MealType | null): Promise<number> {
  const conditions = [eq(mealsTable.userId, userId)];
  if (scheduledDate) {
    conditions.push(eq(mealsTable.scheduledDate, scheduledDate));
  } else {
    conditions.push(isNull(mealsTable.scheduledDate));
  }
  if (mealType) {
    conditions.push(eq(mealsTable.mealType, mealType));
  } else {
    conditions.push(isNull(mealsTable.mealType));
  }

  const result = await db
    .select({ maxPos: sql<number>`coalesce(max(${mealsTable.position}), -1)` })
    .from(mealsTable)
    .where(and(...conditions));

  return (result[0]?.maxPos ?? -1) + 1;
}

export async function reindexSlot(userId: string, scheduledDate: string | null, mealType: MealType | null) {
  const conditions = [eq(mealsTable.userId, userId)];
  if (scheduledDate) {
    conditions.push(eq(mealsTable.scheduledDate, scheduledDate));
  } else {
    conditions.push(isNull(mealsTable.scheduledDate));
  }
  if (mealType) {
    conditions.push(eq(mealsTable.mealType, mealType));
  } else {
    conditions.push(isNull(mealsTable.mealType));
  }

  const meals = await db
    .select()
    .from(mealsTable)
    .where(and(...conditions))
    .orderBy(mealsTable.position);

  for (let i = 0; i < meals.length; i++) {
    if (meals[i].position !== i) {
      await db.update(mealsTable).set({ position: i }).where(eq(mealsTable.id, meals[i].id));
    }
  }
}

export async function reindexSlotWithInsert(userId: string, scheduledDate: string | null, mealType: MealType | null, movedMeal: typeof mealsTable.$inferSelect, targetPosition: number) {
  const conditions = [eq(mealsTable.userId, userId)];
  if (scheduledDate) {
    conditions.push(eq(mealsTable.scheduledDate, scheduledDate));
  } else {
    conditions.push(isNull(mealsTable.scheduledDate));
  }
  if (mealType) {
    conditions.push(eq(mealsTable.mealType, mealType));
  } else {
    conditions.push(isNull(mealsTable.mealType));
  }

  const slotMeals = await db
    .select()
    .from(mealsTable)
    .where(and(...conditions))
    .orderBy(mealsTable.position);

  const withoutMoved = slotMeals.filter(m => m.id !== movedMeal.id);
  const insertAt = Math.min(targetPosition, withoutMoved.length);
  withoutMoved.splice(insertAt, 0, movedMeal);

  for (let i = 0; i < withoutMoved.length; i++) {
    if (withoutMoved[i].position !== i) {
      await db.update(mealsTable).set({ position: i }).where(eq(mealsTable.id, withoutMoved[i].id));
    }
  }
}
