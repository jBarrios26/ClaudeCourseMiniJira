import { Router } from 'express';

const router = Router();

// POST /auth/login
router.post('/login', (_req, res) => {
  res.sendStatus(501);
});

export default router;
