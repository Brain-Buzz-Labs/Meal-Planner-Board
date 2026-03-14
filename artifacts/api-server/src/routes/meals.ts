import { Router, type IRouter } from "express";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db, mealsTable } from "@workspace/db";

const router: IRouter = Router();

const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner"];

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

async function getNextPosition(scheduledDate: string | null, mealType: string | null): Promise<number> {
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

async function reindexSlot(scheduledDate: string | null, mealType: string | null, excludeId?: number) {
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

router.get("/meals", async (_req, res) => {
  const meals = await db
    .select()
    .from(mealsTable)
    .orderBy(mealsTable.position);
  res.json(meals.map(formatMeal));
});

router.post("/meals", async (req, res) => {
  const { name, description, scheduledDate, mealType } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (mealType && !VALID_MEAL_TYPES.includes(mealType)) {
    res.status(400).json({ error: "mealType must be breakfast, lunch, or dinner" });
    return;
  }

  const sd = scheduledDate || null;
  const mt = mealType || null;
  const nextPos = await getNextPosition(sd, mt);

  const [meal] = await db
    .insert(mealsTable)
    .values({
      name: name.trim(),
      description: description ?? null,
      scheduledDate: sd,
      mealType: mt,
      position: nextPos,
    })
    .returning();
  res.status(201).json(formatMeal(meal));
});

router.put("/meals/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { name, description, scheduledDate, mealType, position } = req.body;
  if (mealType !== undefined && mealType !== null && !VALID_MEAL_TYPES.includes(mealType)) {
    res.status(400).json({ error: "mealType must be breakfast, lunch, or dinner" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = typeof name === "string" ? name.trim() : name;
  if (description !== undefined) updates.description = description;
  if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
  if (mealType !== undefined) updates.mealType = mealType;
  if (position !== undefined) updates.position = position;

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
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
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

router.patch("/meals/:id/move", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (req.body.mealType !== undefined && req.body.mealType !== null && !VALID_MEAL_TYPES.includes(req.body.mealType)) {
    res.status(400).json({ error: "mealType must be breakfast, lunch, or dinner" });
    return;
  }

  const existing = await db.select().from(mealsTable).where(eq(mealsTable.id, id));
  if (existing.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  const oldMeal = existing[0];
  const newDate = req.body.scheduledDate !== undefined ? (req.body.scheduledDate ?? null) : oldMeal.scheduledDate;
  const newType = req.body.mealType !== undefined ? (req.body.mealType ?? null) : oldMeal.mealType;
  const newPosition = typeof req.body.position === "number" ? req.body.position : 0;

  const [meal] = await db
    .update(mealsTable)
    .set({
      scheduledDate: newDate,
      mealType: newType,
      position: newPosition,
    })
    .where(eq(mealsTable.id, id))
    .returning();

  await reindexSlot(oldMeal.scheduledDate, oldMeal.mealType);

  const sameSlot = oldMeal.scheduledDate === newDate && oldMeal.mealType === newType;
  if (!sameSlot) {
    const conditions = [];
    if (newDate) {
      conditions.push(eq(mealsTable.scheduledDate, newDate));
    } else {
      conditions.push(isNull(mealsTable.scheduledDate));
    }
    if (newType) {
      conditions.push(eq(mealsTable.mealType, newType));
    } else {
      conditions.push(isNull(mealsTable.mealType));
    }

    const targetMeals = await db
      .select()
      .from(mealsTable)
      .where(and(...conditions))
      .orderBy(mealsTable.position);

    const withoutMoved = targetMeals.filter(m => m.id !== id);
    withoutMoved.splice(Math.min(newPosition, withoutMoved.length), 0, meal);

    for (let i = 0; i < withoutMoved.length; i++) {
      if (withoutMoved[i].position !== i) {
        await db.update(mealsTable).set({ position: i }).where(eq(mealsTable.id, withoutMoved[i].id));
      }
    }
  } else {
    const conditions = [];
    if (newDate) {
      conditions.push(eq(mealsTable.scheduledDate, newDate));
    } else {
      conditions.push(isNull(mealsTable.scheduledDate));
    }
    if (newType) {
      conditions.push(eq(mealsTable.mealType, newType));
    } else {
      conditions.push(isNull(mealsTable.mealType));
    }

    const slotMeals = await db
      .select()
      .from(mealsTable)
      .where(and(...conditions))
      .orderBy(mealsTable.position);

    const withoutMoved = slotMeals.filter(m => m.id !== id);
    withoutMoved.splice(Math.min(newPosition, withoutMoved.length), 0, meal);

    for (let i = 0; i < withoutMoved.length; i++) {
      if (withoutMoved[i].position !== i) {
        await db.update(mealsTable).set({ position: i }).where(eq(mealsTable.id, withoutMoved[i].id));
      }
    }
  }

  const [updated] = await db.select().from(mealsTable).where(eq(mealsTable.id, id));
  res.json(formatMeal(updated));
});

export default router;
