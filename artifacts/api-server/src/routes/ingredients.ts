import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ingredientsTable, mealsTable } from "@workspace/db";
import {
  CreateIngredientBody,
  CreateIngredientParams,
  ListIngredientsParams,
  DeleteIngredientParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatIngredient(i: typeof ingredientsTable.$inferSelect) {
  return {
    id: i.id,
    mealId: i.mealId,
    name: i.name,
    measurement: i.measurement ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

router.get("/meals/:id/ingredients", async (req, res) => {
  const paramsParsed = ListIngredientsParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { id } = paramsParsed.data;

  const meal = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, req.userId)));
  if (meal.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const ingredients = await db
    .select()
    .from(ingredientsTable)
    .where(eq(ingredientsTable.mealId, id))
    .orderBy(ingredientsTable.id);

  res.json(ingredients.map(formatIngredient));
});

router.post("/meals/:id/ingredients", async (req, res) => {
  const paramsParsed = CreateIngredientParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { id } = paramsParsed.data;

  const meal = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, req.userId)));
  if (meal.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const bodyParsed = CreateIngredientBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.issues });
    return;
  }
  const body = bodyParsed.data;

  const [ingredient] = await db
    .insert(ingredientsTable)
    .values({
      mealId: id,
      name: body.name,
      measurement: body.measurement ?? null,
    })
    .returning();

  res.status(201).json(formatIngredient(ingredient));
});

router.delete("/meals/:id/ingredients/:ingredientId", async (req, res) => {
  const paramsParsed = DeleteIngredientParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  const { id, ingredientId } = paramsParsed.data;

  const meal = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, req.userId)));
  if (meal.length === 0) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const existing = await db
    .select()
    .from(ingredientsTable)
    .where(and(eq(ingredientsTable.id, ingredientId), eq(ingredientsTable.mealId, id)));

  if (existing.length === 0) {
    res.status(404).json({ error: "Ingredient not found" });
    return;
  }

  await db.delete(ingredientsTable).where(eq(ingredientsTable.id, ingredientId));
  res.status(204).send();
});

export default router;
