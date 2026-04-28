import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /labels
router.get('/', authenticate, (_req, res) => { res.sendStatus(501); });

// POST /labels
router.post('/', authenticate, (_req, res) => { res.sendStatus(501); });

// DELETE /labels/:id
router.delete('/:id', authenticate, (_req, res) => { res.sendStatus(501); });

export default router;
