import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, mealsTable, ingredientsTable } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string; ingredientId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = await requireUserId(request);
  const { id: idStr, ingredientId: ingredientIdStr } = await context.params;
  const id = parseInt(idStr, 10);
  const ingredientId = parseInt(ingredientIdStr, 10);
  if (isNaN(id) || isNaN(ingredientId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const meal = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)));
  if (meal.length === 0) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const existing = await db
    .select()
    .from(ingredientsTable)
    .where(and(eq(ingredientsTable.id, ingredientId), eq(ingredientsTable.mealId, id)));

  if (existing.length === 0) {
    return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
  }

  await db.delete(ingredientsTable).where(eq(ingredientsTable.id, ingredientId));
  return new NextResponse(null, { status: 204 });
}
