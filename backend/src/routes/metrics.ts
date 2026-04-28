import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /metrics?from=YYYY-MM&to=YYYY-MM  (max 12 months)
router.get('/', authenticate, (_req, res) => { res.sendStatus(501); });

// GET /metrics/export?from=YYYY-MM&to=YYYY-MM  → CSV download
router.get('/export', authenticate, (_req, res) => { res.sendStatus(501); });

export default router;
