import { and, eq, gte, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { labels, ticketLabels, tickets, users } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

const assigneeUser = alias(users, 'assigneeUser');
const creatorUser  = alias(users, 'creatorUser');

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function shapeTicket(
  t: {
    id: number; title: string; description: string | null;
    status: string; priority: string;
    assigneeId: number | null; assigneeName: string | null;
    createdById: number | null; createdByName: string | null;
    version: number; isArchived: boolean; archivedAt: number | null;
    createdAt: number; updatedAt: number;
  },
  ticketLabels: { id: number; name: string }[],
) {
  return {
    id:          t.id,
    title:       t.title,
    description: t.description,
    status:      t.status,
    priority:    t.priority,
    assignee:    t.assigneeId != null ? { id: t.assigneeId, name: t.assigneeName! } : null,
    created_by:  t.createdById != null ? { id: t.createdById, name: t.createdByName! } : null,
    labels:      ticketLabels,
    version:     t.version,
    is_archived: t.isArchived,
    archived_at: t.archivedAt,
    created_at:  t.createdAt,
    updated_at:  t.updatedAt,
  };
}

const TICKET_SELECT = {
  id:            tickets.id,
  title:         tickets.title,
  description:   tickets.description,
  status:        tickets.status,
  priority:      tickets.priority,
  assigneeId:    tickets.assigneeId,
  assigneeName:  assigneeUser.name,
  createdById:   creatorUser.id,
  createdByName: creatorUser.name,
  version:       tickets.version,
  isArchived:    tickets.isArchived,
  archivedAt:    tickets.archivedAt,
  createdAt:     tickets.createdAt,
  updatedAt:     tickets.updatedAt,
};

// ─── GET /tickets ─────────────────────────────────────────────────────────────

const getTicketsSchema = z.object({
  status:      z.enum(['to_do', 'in_progress', 'in_review', 'done']).optional(),
  priority:    z.enum(['low', 'medium', 'high']).optional(),
  assignee_id: z.coerce.number().int().positive().optional(),
  label_id:    z.coerce.number().int().positive().optional(),
  from:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  is_archived: z.enum(['true', 'false']).optional(),
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = getTicketsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { status, priority, assignee_id, label_id, from, to, is_archived } = parsed.data;
    const isArchivedFilter = is_archived === 'true';

    if (isArchivedFilter && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Insufficient role' });
      return;
    }

    const conditions = [eq(tickets.isArchived, isArchivedFilter)];
    if (status)      conditions.push(eq(tickets.status, status));
    if (priority)    conditions.push(eq(tickets.priority, priority));
    if (assignee_id) conditions.push(eq(tickets.assigneeId, assignee_id));
    if (from)        conditions.push(gte(tickets.createdAt, Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000)));
    if (to)          conditions.push(lte(tickets.createdAt, Math.floor(new Date(`${to}T23:59:59Z`).getTime()  / 1000)));

    // Fetch tickets and all their labels in parallel.
    // label_id filtering is applied in JS so we avoid a sequential pre-query.
    const [ticketRows, labelRows] = await Promise.all([
      db
        .select(TICKET_SELECT)
        .from(tickets)
        .leftJoin(assigneeUser, eq(tickets.assigneeId, assigneeUser.id))
        .leftJoin(creatorUser,  eq(tickets.createdBy,  creatorUser.id))
        .where(and(...conditions)),
      db
        .select({ ticketId: ticketLabels.ticketId, labelId: ticketLabels.labelId, id: labels.id, name: labels.name })
        .from(ticketLabels)
        .innerJoin(labels, eq(ticketLabels.labelId, labels.id)),
    ]);

    // Apply label_id filter in memory
    const visibleTickets = label_id
      ? (() => {
          const ids = new Set(labelRows.filter(r => r.labelId === label_id).map(r => r.ticketId));
          return ticketRows.filter(t => ids.has(t.id));
        })()
      : ticketRows;

    if (visibleTickets.length === 0) { res.json([]); return; }

    const ticketIdSet = new Set(visibleTickets.map(t => t.id));
    const labelsByTicket = new Map<number, { id: number; name: string }[]>();
    for (const row of labelRows) {
      if (!ticketIdSet.has(row.ticketId)) continue;
      const arr = labelsByTicket.get(row.ticketId) ?? [];
      arr.push({ id: row.id, name: row.name });
      labelsByTicket.set(row.ticketId, arr);
    }

    res.json(visibleTickets.map(t => shapeTicket(t, labelsByTicket.get(t.id) ?? [])));
  } catch (err) {
    console.error('[GET /tickets]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /tickets ────────────────────────────────────────────────────────────

const ticketCreateSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(120, 'Title must be 120 characters or fewer'),
  description: z.string().nullable().optional(),
  status:      z.enum(['to_do', 'in_progress', 'in_review', 'done']).default('to_do'),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
  assignee_id: z.number().int().positive().nullable().optional(),
  label_ids:   z.array(z.number().int().positive()).default([]),
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = ticketCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { title, description, status, priority, assignee_id, label_ids } = parsed.data;
    const ts = unixNow();

    const [inserted] = await db.insert(tickets).values({
      title,
      description: description ?? null,
      status,
      priority,
      assigneeId: assignee_id ?? null,
      createdBy:  req.user!.id,
      version:    1,
      isArchived: false,
      createdAt:  ts,
      updatedAt:  ts,
    }).returning({ id: tickets.id });

    if (label_ids.length > 0) {
      await db.insert(ticketLabels).values(
        label_ids.map(lid => ({ ticketId: inserted.id, labelId: lid }))
      );
    }

    // Fetch ticket row and its labels in parallel now that we have the ID
    const ticketId = inserted.id;
    const [ticketData, labelData] = await Promise.all([
      db
        .select(TICKET_SELECT)
        .from(tickets)
        .leftJoin(assigneeUser, eq(tickets.assigneeId, assigneeUser.id))
        .leftJoin(creatorUser,  eq(tickets.createdBy,  creatorUser.id))
        .where(eq(tickets.id, ticketId)),
      db
        .select({ id: labels.id, name: labels.name })
        .from(ticketLabels)
        .innerJoin(labels, eq(ticketLabels.labelId, labels.id))
        .where(eq(ticketLabels.ticketId, ticketId)),
    ]);

    res.status(201).json(shapeTicket(ticketData[0]!, labelData));
  } catch (err) {
    console.error('[POST /tickets]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Remaining endpoints (stubs) ─────────────────────────────────────────────

router.get('/:id',           authenticate,               (_req, res) => { res.sendStatus(501); });
router.patch('/:id',         authenticate,               (_req, res) => { res.sendStatus(501); });
router.patch('/:id/archive', authenticate,               (_req, res) => { res.sendStatus(501); });
router.patch('/:id/restore', authenticate, requireAdmin, (_req, res) => { res.sendStatus(501); });

export default router;
