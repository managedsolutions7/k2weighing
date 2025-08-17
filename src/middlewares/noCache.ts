// File: src/middlewares/noCache.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to disable caching for API responses
 * Sets no-store, no-cache headers to prevent stale results
 */
export const noCache = (req: Request, res: Response, next: NextFunction): void => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  next();
};

export default noCache;
