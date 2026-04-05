import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, mealsTable, ingredientsTable } from "@/lib/db";
import { requireUserIdOrRespond } from "@/lib/auth";
import { copyMealSchema } from "@/lib/validations";
import { formatMeal, getNextPosition } from "@/lib/db/helpers";
import type { MealType } from "@/lib/db/schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireUserIdOrRespond(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;
  const { id: idStr } = await context.params;
  const sourceId = parseInt(idStr, 10);
  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = copyMealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }

  const [source] = await db
    .select()
    .from(mealsTable)
    .where(and(eq(mealsTable.id, sourceId), eq(mealsTable.userId, userId)));
  if (!source) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const newDate = parsed.data.scheduledDate ?? null;
  const newType = (parsed.data.mealType ?? null) as MealType | null;

  try {
    const nextPos = await getNextPosition(userId, newDate, newType);

    const [created] = await db
      .insert(mealsTable)
      .values({
        userId,
        name: source.name,
        description: source.description ?? null,
        scheduledDate: newDate,
        mealType: newType,
        position: nextPos,
      })
      .returning();

    const sourceIngredients = await db
      .select()
      .from(ingredientsTable)
      .where(eq(ingredientsTable.mealId, source.id));

    if (sourceIngredients.length > 0) {
      await db.insert(ingredientsTable).values(
        sourceIngredients.map((i) => ({
          mealId: created.id,
          name: i.name,
          measurement: i.measurement ?? null,
        }))
      );
    }

    return NextResponse.json(formatMeal(created), { status: 201 });
  } catch (err) {
    console.error("Failed to copy meal:", err);
    return NextResponse.json({ error: "Failed to copy meal", details: String(err) }, { status: 500 });
  }
}
