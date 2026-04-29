import bcrypt from 'bcryptjs';
import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { users } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

function shapeUser(u: typeof users.$inferSelect) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.createdAt };
}

// GET /users
router.get('/', authenticate, async (_req, res) => {
  try {
    const rows = await db.select().from(users).orderBy(asc(users.createdAt));
    res.json(rows.map(shapeUser));
  } catch (err) {
    console.error('[GET /users]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(404).json({ error: 'User not found' }); return; }

    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    res.json(shapeUser(user));
  } catch (err) {
    console.error('[GET /users/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const createUserSchema = z.object({
  name:     z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(1),
  role:     z.enum(['user', 'admin']).default('user'),
});

// POST /users  (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { name, email, password, role } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = Math.floor(Date.now() / 1000);

    try {
      const [inserted] = await db.insert(users).values({ name, email, passwordHash, role, createdAt }).returning();
      res.status(201).json(shapeUser(inserted!));
    } catch (dbErr: unknown) {
      if (isUniqueConstraintError(dbErr)) {
        res.status(409).json({ error: 'Email already exists' });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('[POST /users]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const patchUserSchema = z.object({
  name:     z.string().min(1).optional(),
  email:    z.string().email().optional(),
  password: z.string().min(1).optional(),
  role:     z.enum(['user', 'admin']).optional(),
});

// PATCH /users/:id  (admin only)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(404).json({ error: 'User not found' }); return; }

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) { res.status(404).json({ error: 'User not found' }); return; }

    const parsed = patchUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { name, email, password, role } = parsed.data;
    const updates: Partial<typeof users.$inferInsert> = {};
    if (name  !== undefined) updates.name  = name;
    if (email !== undefined) updates.email = email;
    if (role  !== undefined) updates.role  = role;
    if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 10);

    if (Object.keys(updates).length === 0) {
      res.json(shapeUser(existing));
      return;
    }

    try {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      res.json(shapeUser(updated!));
    } catch (dbErr: unknown) {
      if (isUniqueConstraintError(dbErr)) {
        res.status(409).json({ error: 'Email already exists' });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('[PATCH /users/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/:id  (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(404).json({ error: 'User not found' }); return; }

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) { res.status(404).json({ error: 'User not found' }); return; }

    await db.delete(users).where(eq(users.id, id));
    res.sendStatus(204);
  } catch (err) {
    console.error('[DELETE /users/:id]', err);
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
