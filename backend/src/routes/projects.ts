import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { projects } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function shapeProject(p: { id: number; name: string; description: string | null; createdAt: number; updatedAt: number }) {
  return {
    id:          p.id,
    name:        p.name,
    description: p.description,
    created_at:  p.createdAt,
    updated_at:  p.updatedAt,
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

const projectBodySchema = z.object({
  name:        z.string().min(1).max(80),
  description: z.string().nullable().optional(),
});

// ─── GET /projects ─────────────────────────────────────────────────────────────

router.get('/', authenticate, async (_req, res) => {
  try {
    const rows = await db.select().from(projects).orderBy(asc(projects.name));
    res.json(rows.map(shapeProject));
  } catch (err) {
    console.error('[GET /projects]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /projects ────────────────────────────────────────────────────────────

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsed = projectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { name, description } = parsed.data;
    const ts = unixNow();
    try {
      const [inserted] = await db.insert(projects)
        .values({ name, description: description ?? null, createdAt: ts, updatedAt: ts })
        .returning();
      res.status(201).json(shapeProject(inserted));
    } catch (dbErr: unknown) {
      if (isUniqueConstraintError(dbErr)) {
        res.status(409).json({ error: 'Project name already exists' });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('[POST /projects]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /projects/:id ───────────────────────────────────────────────────────

router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(404).json({ error: 'Project not found' }); return; }

    const parsed = projectBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const [existing] = await db.select().from(projects).where(eq(projects.id, id));
    if (!existing) { res.status(404).json({ error: 'Project not found' }); return; }

    const updates: Record<string, unknown> = { updatedAt: unixNow() };
    if (parsed.data.name        !== undefined) updates.name        = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;

    try {
      await db.update(projects).set(updates).where(eq(projects.id, id));
    } catch (dbErr: unknown) {
      if (isUniqueConstraintError(dbErr)) {
        res.status(409).json({ error: 'Project name already exists' });
        return;
      }
      throw dbErr;
    }

    const [updated] = await db.select().from(projects).where(eq(projects.id, id));
    res.json(shapeProject(updated));
  } catch (err) {
    console.error('[PATCH /projects/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /projects/:id ──────────────────────────────────────────────────────

router.delete('/:id', authenticate, requireAdmin, async (_req, res) => {
  try {
    const id = Number(_req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(404).json({ error: 'Project not found' }); return; }

    const [existing] = await db.select().from(projects).where(eq(projects.id, id));
    if (!existing) { res.status(404).json({ error: 'Project not found' }); return; }

    await db.delete(projects).where(eq(projects.id, id));
    res.sendStatus(204);
  } catch (err) {
    console.error('[DELETE /projects/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
