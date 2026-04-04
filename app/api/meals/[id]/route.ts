import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, mealsTable } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { updateMealSchema } from "@/lib/validations";
import { formatMeal, reindexSlot, reindexSlotWithInsert } from "@/lib/db/helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const userId = requireUserId(request);
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateMealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }

  const existing = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)));
  if (existing.length === 0) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }
  const oldMeal = existing[0];

  const updates: Record<string, unknown> = {};
  const data = parsed.data;
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.scheduledDate !== undefined) updates.scheduledDate = data.scheduledDate;
  if (data.mealType !== undefined) updates.mealType = data.mealType;
  if (data.position !== undefined) updates.position = data.position;

  const [meal] = await db
    .update(mealsTable)
    .set(updates)
    .where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)))
    .returning();

  const newDate = meal.scheduledDate;
  const newType = meal.mealType;
  const slotChanged = oldMeal.scheduledDate !== newDate || oldMeal.mealType !== newType;
  const posChanged = data.position !== undefined;

  if (slotChanged) {
    await reindexSlot(userId, oldMeal.scheduledDate, oldMeal.mealType);
    await reindexSlotWithInsert(userId, newDate, newType, meal, meal.position);
  } else if (posChanged) {
    await reindexSlotWithInsert(userId, newDate, newType, meal, meal.position);
  }

  const [updated] = await db.select().from(mealsTable).where(eq(mealsTable.id, id));
  return NextResponse.json(formatMeal(updated));
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const userId = requireUserId(request);
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)));
  if (existing.length === 0) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }
  const meal = existing[0];
  await db.delete(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)));
  await reindexSlot(userId, meal.scheduledDate, meal.mealType);
  return new NextResponse(null, { status: 204 });
}
