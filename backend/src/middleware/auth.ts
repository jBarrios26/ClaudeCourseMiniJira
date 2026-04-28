import { NextFunction, Request, Response } from 'express';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: 'user' | 'admin' };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  // TODO: extract Bearer token from Authorization header, verify with JWT_SECRET,
  // attach decoded payload to req.user, return 401 if missing or invalid
  next();
}
