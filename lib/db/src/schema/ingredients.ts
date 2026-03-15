import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { mealsTable } from "./meals";

export const ingredientsTable = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  mealId: integer("meal_id").notNull().references(() => mealsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  measurement: text("measurement"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Ingredient = typeof ingredientsTable.$inferSelect;
