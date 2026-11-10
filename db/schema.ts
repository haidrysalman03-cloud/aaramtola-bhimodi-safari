import { pgTable, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
export const content = pgTable('safari_content', {
  id: text().primaryKey(),
  data: jsonb().notNull(),
  revision: integer().notNull().default(1),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: text('updated_by').notNull(),
});
