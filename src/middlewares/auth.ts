// File: src/middlewares/auth.ts
import { decodeAccessToken } from '@services/token.service';
import logger from '@utils/logger';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = decodeAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error(err);
    res.status(401).json({ error: 'Invalid token' });
  }
};
