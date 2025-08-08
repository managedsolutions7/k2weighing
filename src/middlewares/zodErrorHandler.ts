// File: src/middlewares/zodErrorHandler.ts
import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const zodErrorHandler = (err: unknown, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    const formatted = err.issues.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({ error: formatted });
  }
  next(err);
};
