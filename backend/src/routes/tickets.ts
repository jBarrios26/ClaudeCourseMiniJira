import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// GET /tickets  (filters: status, priority, assignee_id, label_id, from, to, is_archived)
router.get('/', authenticate, (_req, res) => { res.sendStatus(501); });

// POST /tickets
router.post('/', authenticate, (_req, res) => { res.sendStatus(501); });

// GET /tickets/:id
router.get('/:id', authenticate, (_req, res) => { res.sendStatus(501); });

// PATCH /tickets/:id  (requires version for optimistic locking)
router.patch('/:id', authenticate, (_req, res) => { res.sendStatus(501); });

// PATCH /tickets/:id/archive
router.patch('/:id/archive', authenticate, (_req, res) => { res.sendStatus(501); });

// PATCH /tickets/:id/restore  (admin only)
router.patch('/:id/restore', authenticate, requireAdmin, (_req, res) => { res.sendStatus(501); });

export default router;
