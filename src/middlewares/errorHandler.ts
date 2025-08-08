// src/middleware/error-handler.ts
import { Request, Response } from 'express';
import logger from '@utils/logger';
// src/errors/customError.ts
class CustomError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

const errorHandler = (err: Error, req: Request, res: Response) => {
  // Custom logging logic
  logger.error(`Error: ${err.message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: err.stack,
  });

  if (err instanceof CustomError) {
    return res.status(err.statusCode).send({
      errors: [{ message: err.message }],
    });
  }

  // Handle unexpected or unhandled errors
  return res.status(500).send({
    errors: [{ message: 'Something went wrong' }],
  });
};

export default errorHandler;
