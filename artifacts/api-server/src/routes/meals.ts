import { Router, type IRouter } from "express";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db, mealsTable } from "@workspace/db";
import {
  CreateMealBody,
  UpdateMealBody,
  UpdateMealParams,
  MoveMealBody,
  MoveMealParams,
  DeleteMealParams,
  ListDaysQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatMeal(m: typeof mealsTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    description: m.description ?? null,
    scheduledDate: m.scheduledDate ?? null,
    mealType: m.mealType ?? null,
    position: m.position,
    createdAt: m.createdAt.toISOString(),
  };
}

type MealType = (typeof mealsTable.$inferSelect)["mealType"];

async function getNextPosition(scheduledDate: string | null, mealType: MealType): Promise<number> {
  const conditions = [];
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

async function reindexSlot(scheduledDate: string | null, mealType: MealType) {
  const conditions = [];
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

async function reindexSlotWithInsert(scheduledDate: string | null, mealType: MealType, movedMeal: typeof mealsTable.$inferSelect, targetPosition: number) {
  const conditions = [];
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

router.get("/meals", async (_req, res) => {
  const meals = await db
    .select()
    .from(mealsTable)
    .orderBy(mealsTable.position);
  res.json(meals.map(formatMeal));
});

router.post("/meals", async (req, res) => {
  const parsed = CreateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  const body = parsed.data;

  const sd = body.scheduledDate ?? null;
  const mt = body.mealType ?? null;
  const nextPos = await getNextPosition(sd, mt);

  const [meal] = await db
    .insert(mealsTable)
    .values({
      name: body.name,
      description: body.description ?? null,
      scheduledDate: sd,
      mealType: mt,
      position: nextPos,
    })
    .returning();
  res.status(201).json(formatMeal(meal));
});

router.put("/meals/:id", async (req, res) => {
  const paramsParsed = UpdateMealParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { id } = paramsParsed.data;

  const bodyParsed = UpdateMealBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.issues });
    return;
  }
  const body = bodyParsed.data;

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.scheduledDate !== undefined) updates.scheduledDate = body.scheduledDate;
  if (body.mealType !== undefined) updates.mealType = body.mealType;
  if (body.position !== undefined) updates.position = body.position;

  const [meal] = await db
    .update(mealsTable)
    .set(updates)
    .where(eq(mealsTable.id, id))
    .returning();
  if (!meal) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  res.json(formatMeal(meal));
});

router.delete("/meals/:id", async (req, res) => {
  const paramsParsed = DeleteMealParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { id } = paramsParsed.data;

  const existing = await db.select().from(mealsTable).where(eq(mealsTable.id, id));
  if (existing.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  const meal = existing[0];
  await db.delete(mealsTable).where(eq(mealsTable.id, id));
  await reindexSlot(meal.scheduledDate, meal.mealType);
  res.status(204).send();
});

router.get("/days", async (req, res) => {
  const parsed = ListDaysQueryParams.safeParse(req.query);
  const startDateStr = parsed.success && parsed.data.startDate ? parsed.data.startDate : null;
  const count = parsed.success && parsed.data.count ? parsed.data.count : 7;

  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push({
      date: d.toISOString().split("T")[0],
      dayOfWeek: d.toLocaleDateString("en-US", { weekday: "long" }),
      isToday: d.getTime() === today.getTime(),
    });
  }
  res.json(days);
});

router.patch("/meals/:id/move", async (req, res) => {
  const paramsParsed = MoveMealParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { id } = paramsParsed.data;

  const bodyParsed = MoveMealBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.issues });
    return;
  }
  const body = bodyParsed.data;

  const existing = await db.select().from(mealsTable).where(eq(mealsTable.id, id));
  if (existing.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  const oldMeal = existing[0];
  const newDate = body.scheduledDate !== undefined ? (body.scheduledDate ?? null) : oldMeal.scheduledDate;
  const newType = body.mealType !== undefined ? (body.mealType ?? null) : oldMeal.mealType;
  const newPosition = body.position;

  const [meal] = await db
    .update(mealsTable)
    .set({
      scheduledDate: newDate,
      mealType: newType,
      position: newPosition,
    })
    .where(eq(mealsTable.id, id))
    .returning();

  const sameSlot = oldMeal.scheduledDate === newDate && oldMeal.mealType === newType;
  if (!sameSlot) {
    await reindexSlot(oldMeal.scheduledDate, oldMeal.mealType);
  }

  await reindexSlotWithInsert(newDate, newType, meal, newPosition);

  const [updated] = await db.select().from(mealsTable).where(eq(mealsTable.id, id));
  res.json(formatMeal(updated));
});

export default router;
