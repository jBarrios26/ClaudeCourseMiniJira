import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { comments, tickets, users } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function shapeComment(row: {
  id: number;
  body: string;
  authorId: number | null;
  authorName: string | null;
  createdAt: number;
}) {
  return {
    id:         row.id,
    body:       row.body,
    author:     row.authorId != null ? { id: row.authorId, name: row.authorName! } : null,
    created_at: row.createdAt,
  };
}

// GET /tickets/:id/comments
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId < 1) { res.status(404).json({ error: 'Ticket not found' }); return; }

    const [ticket] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, ticketId));
    if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

    const rows = await db
      .select({
        id:         comments.id,
        body:       comments.body,
        authorId:   comments.authorId,
        authorName: users.name,
        createdAt:  comments.createdAt,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.ticketId, ticketId))
      .orderBy(asc(comments.createdAt));

    res.json(rows.map(shapeComment));
  } catch (err) {
    console.error('[GET /tickets/:id/comments]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const commentCreateSchema = z.object({ body: z.string().min(1, 'Body is required') });

// POST /tickets/:id/comments
router.post('/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId < 1) { res.status(404).json({ error: 'Ticket not found' }); return; }

    const [ticket] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, ticketId));
    if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

    const parsed = commentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const ts = unixNow();
    const [inserted] = await db
      .insert(comments)
      .values({ ticketId, authorId: req.user!.id, body: parsed.data.body, createdAt: ts })
      .returning({ id: comments.id });

    const [row] = await db
      .select({
        id:         comments.id,
        body:       comments.body,
        authorId:   comments.authorId,
        authorName: users.name,
        createdAt:  comments.createdAt,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, inserted!.id));

    res.status(201).json(shapeComment(row!));
  } catch (err) {
    console.error('[POST /tickets/:id/comments]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
