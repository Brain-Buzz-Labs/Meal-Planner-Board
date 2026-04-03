import { pgTable, serial, text, date, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mealTypeEnum = ["breakfast", "lunch", "dinner"] as const;

export const mealsTable = pgTable("meals", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  description: text("description"),
  scheduledDate: date("scheduled_date"),
  mealType: text("meal_type", { enum: mealTypeEnum }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  check("meal_type_check", sql`${table.mealType} IS NULL OR ${table.mealType} IN ('breakfast', 'lunch', 'dinner')`),
]);

export const insertMealSchema = createInsertSchema(mealsTable).omit({ id: true, createdAt: true });
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof mealsTable.$inferSelect;
