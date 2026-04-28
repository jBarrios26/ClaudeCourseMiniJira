import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// GET /users
router.get('/', authenticate, (_req, res) => { res.sendStatus(501); });

// GET /users/:id
router.get('/:id', authenticate, (_req, res) => { res.sendStatus(501); });

// POST /users  (admin only)
router.post('/', authenticate, requireAdmin, (_req, res) => { res.sendStatus(501); });

// PATCH /users/:id  (admin only)
router.patch('/:id', authenticate, requireAdmin, (_req, res) => { res.sendStatus(501); });

// DELETE /users/:id  (admin only)
router.delete('/:id', authenticate, requireAdmin, (_req, res) => { res.sendStatus(501); });

export default router;
