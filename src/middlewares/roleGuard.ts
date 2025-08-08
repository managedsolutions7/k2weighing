// File: src/middlewares/roleGuard.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const allowRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};
