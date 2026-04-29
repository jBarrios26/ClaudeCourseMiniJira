import { and, count, eq, gte, lt } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { tickets } from '../db/schema';
import { buildMetricsCsv, MetricsRow } from '../lib/csv';
import { authenticate } from '../middleware/auth';

const router = Router();

const metricsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}$/, 'from must be YYYY-MM'),
  to:   z.string().regex(/^\d{4}-\d{2}$/, 'to must be YYYY-MM'),
});

function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number)   as [number, number];
  const result: string[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

function monthBounds(month: string): { start: number; end: number } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const start = Math.floor(new Date(Date.UTC(y, m - 1, 1)).getTime() / 1000);
  const end   = Math.floor(new Date(Date.UTC(y, m, 1)).getTime() / 1000);
  return { start, end };
}

async function fetchMetrics(from: string, to: string): Promise<MetricsRow[]> {
  const months = monthsBetween(from, to);

  const rows = await Promise.all(
    months.map(async (month): Promise<MetricsRow> => {
      const { start, end } = monthBounds(month);

      const [created, closed, archived, openStatus] = await Promise.all([
        db
          .select({ total: count() })
          .from(tickets)
          .where(and(gte(tickets.createdAt, start), lt(tickets.createdAt, end))),
        db
          .select({ total: count() })
          .from(tickets)
          .where(and(eq(tickets.status, 'done'), gte(tickets.updatedAt, start), lt(tickets.updatedAt, end))),
        db
          .select({ total: count() })
          .from(tickets)
          .where(and(eq(tickets.isArchived, true), gte(tickets.archivedAt!, start), lt(tickets.archivedAt!, end))),
        db
          .select({ status: tickets.status, total: count() })
          .from(tickets)
          .where(eq(tickets.isArchived, false))
          .groupBy(tickets.status),
      ]);

      const openByStatus = { to_do: 0, in_progress: 0, in_review: 0 };
      for (const row of openStatus) {
        if (row.status === 'to_do')       openByStatus.to_do       = row.total;
        if (row.status === 'in_progress') openByStatus.in_progress = row.total;
        if (row.status === 'in_review')   openByStatus.in_review   = row.total;
      }

      return {
        month,
        ticketsCreated:  created[0]!.total,
        ticketsClosed:   closed[0]!.total,
        ticketsArchived: archived[0]!.total,
        openToDo:        openByStatus.to_do,
        openInProgress:  openByStatus.in_progress,
        openInReview:    openByStatus.in_review,
      };
    }),
  );

  return rows;
}

// GET /metrics?from=YYYY-MM&to=YYYY-MM  (max 12 months)
router.get('/', authenticate, async (req, res) => {
  try {
    const parsed = metricsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { from, to } = parsed.data;
    if (monthsBetween(from, to).length > 12) {
      res.status(400).json({ error: 'Export range cannot exceed 12 months.' });
      return;
    }

    const rows = await fetchMetrics(from, to);
    res.json(
      rows.map(r => ({
        month:            r.month,
        tickets_created:  r.ticketsCreated,
        tickets_closed:   r.ticketsClosed,
        tickets_archived: r.ticketsArchived,
        open_by_status: {
          to_do:       r.openToDo,
          in_progress: r.openInProgress,
          in_review:   r.openInReview,
        },
      })),
    );
  } catch (err) {
    console.error('[GET /metrics]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /metrics/export?from=YYYY-MM&to=YYYY-MM  → CSV download
router.get('/export', authenticate, async (req, res) => {
  try {
    const parsed = metricsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { from, to } = parsed.data;
    if (monthsBetween(from, to).length > 12) {
      res.status(400).json({ error: 'Export range cannot exceed 12 months.' });
      return;
    }

    const rows = await fetchMetrics(from, to);
    const csv = buildMetricsCsv(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="metrics-${to}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[GET /metrics/export]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
