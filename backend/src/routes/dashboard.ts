import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /dashboard
router.get('/', authenticate, (_req, res) => { res.sendStatus(501); });

export default router;
