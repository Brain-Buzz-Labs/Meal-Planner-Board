import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, mealsTable } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { createMealSchema } from "@/lib/validations";
import { formatMeal, getNextPosition } from "@/lib/db/helpers";
import type { MealType } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const userId = await requireUserId(request);
  const meals = await db
    .select()
    .from(mealsTable)
    .where(eq(mealsTable.userId, userId))
    .orderBy(mealsTable.position);
  return NextResponse.json(meals.map(formatMeal));
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId(request);
  const body = await request.json();
  const parsed = createMealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  const sd = data.scheduledDate ?? null;
  const mt = (data.mealType ?? null) as MealType | null;
  const nextPos = await getNextPosition(userId, sd, mt);

  const [meal] = await db
    .insert(mealsTable)
    .values({
      userId,
      name: data.name,
      description: data.description ?? null,
      scheduledDate: sd,
      mealType: mt,
      position: nextPos,
    })
    .returning();

  return NextResponse.json(formatMeal(meal), { status: 201 });
}
