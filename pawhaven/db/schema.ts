// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), kind: text('kind').notNull(), payload: text('payload').notNull(), status: text('status').notNull().default('pending'), amount: integer('amount').notNull().default(0), requestKey: text('request_key').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('records_owner_kind').on(t.owner, t.kind), uniqueIndex('records_idempotency').on(t.owner, t.requestKey)]);
export const rateLimits = sqliteTable('rate_limits', {key: text('key').primaryKey(), count: integer('count').notNull(), expires: integer('expires').notNull()});
export const auditLog = sqliteTable('audit_log', {id: text('id').primaryKey(), actor: text('actor').notNull(), action: text('action').notNull(), recordId: text('record_id').notNull(), createdAt: text('created_at').notNull()});
export const customers = sqliteTable('customers', {id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),provider:text('provider').notNull(),createdAt:text('created_at').notNull(),lastSeen:text('last_seen').notNull()});
export const recordOperations = sqliteTable('record_operations', {recordId:text('record_id').primaryKey().references(()=>records.id),notes:text('notes').notNull().default(''),assignedTo:text('assigned_to').notNull().default(''),paymentStatus:text('payment_status').notNull().default('unpaid'),paidAmount:integer('paid_amount').notNull().default(0),version:integer('version').notNull().default(0),updatedAt:text('updated_at').notNull()});
