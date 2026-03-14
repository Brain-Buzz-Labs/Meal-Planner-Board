import { pgTable, serial, text, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mealsTable = pgTable("meals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  scheduledDate: date("scheduled_date"),
  mealType: text("meal_type"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMealSchema = createInsertSchema(mealsTable).omit({ id: true, createdAt: true });
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof mealsTable.$inferSelect;
