import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  name:         text('name').notNull(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt:    integer('created_at').notNull(),
});

export const projects = sqliteTable('projects', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  name:        text('name').notNull().unique(),
  description: text('description'),
  createdAt:   integer('created_at').notNull(),
  updatedAt:   integer('updated_at').notNull(),
});

export const tickets = sqliteTable('tickets', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  title:       text('title').notNull(),
  description: text('description'),
  status:      text('status', { enum: ['to_do', 'in_progress', 'in_review', 'done'] }).notNull().default('to_do'),
  priority:    text('priority', { enum: ['low', 'medium', 'high'] }).notNull().default('medium'),
  assigneeId:  integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  createdBy:   integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  projectId:   integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  version:     integer('version').notNull().default(1),
  isArchived:  integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  archivedAt:  integer('archived_at'),
  createdAt:   integer('created_at').notNull(),
  updatedAt:   integer('updated_at').notNull(),
}, (t) => [
  index('idx_tickets_status').on(t.status),
  index('idx_tickets_assignee_id').on(t.assigneeId),
  index('idx_tickets_created_at').on(t.createdAt),
  index('idx_tickets_is_archived').on(t.isArchived),
  index('idx_tickets_project_id').on(t.projectId),
]);

export const labels = sqliteTable('labels', {
  id:   integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const ticketLabels = sqliteTable('ticket_labels', {
  ticketId: integer('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  labelId:  integer('label_id').notNull().references(() => labels.id,  { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.ticketId, t.labelId] }),
  index('idx_ticket_labels_label_id').on(t.labelId),
]);

export const comments = sqliteTable('comments', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  ticketId:  integer('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId:  integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  body:      text('body').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => [
  index('idx_comments_ticket_id').on(t.ticketId),
]);
