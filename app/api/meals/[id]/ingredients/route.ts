import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, mealsTable, ingredientsTable } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { createIngredientSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ id: string }> };

function formatIngredient(i: typeof ingredientsTable.$inferSelect) {
  return {
    id: i.id,
    mealId: i.mealId,
    name: i.name,
    measurement: i.measurement ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const userId = requireUserId(request);
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const meal = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)));
  if (meal.length === 0) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const ingredients = await db
    .select()
    .from(ingredientsTable)
    .where(eq(ingredientsTable.mealId, id))
    .orderBy(ingredientsTable.id);

  return NextResponse.json(ingredients.map(formatIngredient));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const userId = requireUserId(request);
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const meal = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)));
  if (meal.length === 0) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createIngredientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }

  const [ingredient] = await db
    .insert(ingredientsTable)
    .values({
      mealId: id,
      name: parsed.data.name,
      measurement: parsed.data.measurement ?? null,
    })
    .returning();

  return NextResponse.json(formatIngredient(ingredient), { status: 201 });
}
