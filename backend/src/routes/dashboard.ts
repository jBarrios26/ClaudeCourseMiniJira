import { and, count, desc, eq, gte, lt } from 'drizzle-orm';
import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { tickets, users } from '../db/schema';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /dashboard
router.get('/', authenticate, async (_req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // 12-month window
    const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

    const [statusRows, closedPerMonthRows, topAssigneesRows] = await Promise.all([
      // tickets_by_status — active tickets only
      db
        .select({ status: tickets.status, total: count() })
        .from(tickets)
        .where(eq(tickets.isArchived, false))
        .groupBy(tickets.status),

      // closed_per_month — last 12 calendar months
      db
        .select({
          month: sql<string>`strftime('%Y-%m', datetime(${tickets.updatedAt}, 'unixepoch'))`.as('month'),
          total: count(),
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, 'done'),
            gte(tickets.updatedAt, Math.floor(twelveMonthsAgo.getTime() / 1000)),
          ),
        )
        .groupBy(sql`strftime('%Y-%m', datetime(${tickets.updatedAt}, 'unixepoch'))`),

      // top_assignees — current month, status=done, top 5
      db
        .select({
          id:               tickets.assigneeId,
          name:             users.name,
          closed_this_month: count(),
        })
        .from(tickets)
        .innerJoin(users, eq(tickets.assigneeId, users.id))
        .where(
          and(
            eq(tickets.status, 'done'),
            gte(tickets.updatedAt, Math.floor(currentMonthStart.getTime() / 1000)),
            lt(tickets.updatedAt,  Math.floor(nextMonthStart.getTime()    / 1000)),
          ),
        )
        .groupBy(tickets.assigneeId)
        .orderBy(desc(count()))
        .limit(5),
    ]);

    const tickets_by_status = {
      to_do:       0,
      in_progress: 0,
      in_review:   0,
      done:        0,
    };
    for (const row of statusRows) {
      tickets_by_status[row.status as keyof typeof tickets_by_status] = row.total;
    }

    res.json({
      tickets_by_status,
      closed_per_month: closedPerMonthRows.map(r => ({ month: r.month, count: r.total })),
      top_assignees:    topAssigneesRows.map(r => ({
        id:               r.id,
        name:             r.name,
        closed_this_month: r.closed_this_month,
      })),
    });
  } catch (err) {
    console.error('[GET /dashboard]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
