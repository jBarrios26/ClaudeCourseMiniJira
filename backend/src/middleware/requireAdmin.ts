import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  // TODO: check req.user.role === 'admin', return 403 otherwise
  next();
}
