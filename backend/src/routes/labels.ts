import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { labels } from '../db/schema';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /labels
router.get('/', authenticate, async (_req, res) => {
  try {
    const rows = await db.select().from(labels).orderBy(asc(labels.name));
    res.json(rows);
  } catch (err) {
    console.error('[GET /labels]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const labelCreateSchema = z.object({ name: z.string().min(1) });

// POST /labels
router.post('/', authenticate, async (req, res) => {
  try {
    const parsed = labelCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    try {
      const [inserted] = await db.insert(labels).values({ name: parsed.data.name }).returning();
      res.status(201).json(inserted);
    } catch (dbErr: unknown) {
      if (isUniqueConstraintError(dbErr)) {
        res.status(409).json({ error: 'Label name already exists' });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('[POST /labels]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /labels/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(404).json({ error: 'Label not found' }); return; }

    const [existing] = await db.select().from(labels).where(eq(labels.id, id));
    if (!existing) { res.status(404).json({ error: 'Label not found' }); return; }

    await db.delete(labels).where(eq(labels.id, id));
    res.sendStatus(204);
  } catch (err) {
    console.error('[DELETE /labels/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export default router;
