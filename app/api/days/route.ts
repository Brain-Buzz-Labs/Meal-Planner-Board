import { NextRequest, NextResponse } from "next/server";
import { listDaysSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = listDaysSchema.safeParse({
    startDate: searchParams.get("startDate") ?? undefined,
    count: searchParams.get("count") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", details: parsed.error.issues }, { status: 400 });
  }

  const { startDate: startDateStr, count } = parsed.data;
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

  return NextResponse.json(days);
}
