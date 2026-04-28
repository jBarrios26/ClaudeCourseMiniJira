import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /tickets/:id/comments
router.get('/:id/comments', authenticate, (_req, res) => { res.sendStatus(501); });

// POST /tickets/:id/comments
router.post('/:id/comments', authenticate, (_req, res) => { res.sendStatus(501); });

export default router;
