import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, mealsTable } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { moveMealSchema } from "@/lib/validations";
import { formatMeal, reindexSlot, reindexSlotWithInsert } from "@/lib/db/helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await requireUserId(request);
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = moveMealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }

  const existing = await db.select().from(mealsTable).where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)));
  if (existing.length === 0) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }
  const oldMeal = existing[0];
  const data = parsed.data;
  const newDate = data.scheduledDate !== undefined ? (data.scheduledDate ?? null) : oldMeal.scheduledDate;
  const newType = data.mealType !== undefined ? (data.mealType ?? null) : oldMeal.mealType;
  const newPosition = data.position;

  const [meal] = await db
    .update(mealsTable)
    .set({
      scheduledDate: newDate,
      mealType: newType,
      position: newPosition,
    })
    .where(and(eq(mealsTable.id, id), eq(mealsTable.userId, userId)))
    .returning();

  const sameSlot = oldMeal.scheduledDate === newDate && oldMeal.mealType === newType;
  if (!sameSlot) {
    await reindexSlot(userId, oldMeal.scheduledDate, oldMeal.mealType);
  }

  await reindexSlotWithInsert(userId, newDate, newType, meal, newPosition);

  const [updated] = await db.select().from(mealsTable).where(eq(mealsTable.id, id));
  return NextResponse.json(formatMeal(updated));
}
