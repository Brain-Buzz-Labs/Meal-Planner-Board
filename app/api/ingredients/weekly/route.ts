import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, mealsTable, ingredientsTable } from "@/lib/db";
import { requireUserIdOrRespond } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireUserIdOrRespond(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const meals = await db
    .select()
    .from(mealsTable)
    .where(
      and(
        eq(mealsTable.userId, userId),
        gte(mealsTable.scheduledDate, startDate),
        lte(mealsTable.scheduledDate, endDate)
      )
    );

  const result = await Promise.all(
    meals.map(async (meal) => {
      const ingredients = await db
        .select()
        .from(ingredientsTable)
        .where(eq(ingredientsTable.mealId, meal.id))
        .orderBy(ingredientsTable.id);

      return ingredients.map((i) => ({
        id: i.id,
        mealId: i.mealId,
        mealName: meal.name,
        name: i.name,
        measurement: i.measurement ?? null,
      }));
    })
  );

  return NextResponse.json(result.flat());
}
