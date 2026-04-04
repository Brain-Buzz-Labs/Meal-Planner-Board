import { pgTable, serial, text, date, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const mealTypeEnum = ["breakfast", "lunch", "dinner"] as const;
export type MealType = (typeof mealTypeEnum)[number];

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

export const ingredientsTable = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  mealId: integer("meal_id").notNull().references(() => mealsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  measurement: text("measurement"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Meal = typeof mealsTable.$inferSelect;
export type InsertMeal = typeof mealsTable.$inferInsert;
export type Ingredient = typeof ingredientsTable.$inferSelect;
