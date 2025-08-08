// src/middleware/not-found-handler.ts
import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
  // Log the 404 error
  console.warn(`404 Not Found: ${req.method} ${req.path}`);

  // Send a consistent 404 response
  res.status(404).send({
    errors: [{ message: 'Route not found' }],
  });
};
