// File: src/middlewares/auth.ts
import { verifyAccessToken } from '@services/token.service';
import logger from '@utils/logger';
import CustomError from '@utils/customError';
import { Request, Response, NextFunction } from 'express';
import User from '@models/user.model';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  refreshToken?: string; // Add this line
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new CustomError('Authorization header is required', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new CustomError('Bearer token is required', 401);
    }

    // Verify and decode token
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    logger.info(`Token verified for user: ${decoded.id}`);
    next();
  } catch (error) {
    logger.error('Auth middleware - verifyToken error:', error);

    if (error instanceof CustomError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }
  }
};

export const verifyRefreshToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new CustomError('Authorization header is required', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new CustomError('Bearer token is required', 401);
    }

    // Verify and decode refresh token
    const decoded = verifyAccessToken(token);

    // Fetch user from DB
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new CustomError('User not found or inactive', 401);
    }

    // Attach user info to request
    req.user = {
      id: user._id.toString(),
      role: user.role,
    };
    req.refreshToken = token; // optional, if you need raw token later

    logger.info(`Refresh token verified for user: ${user.username}`);
    next();
  } catch (error) {
    logger.error('Auth middleware - verifyRefreshToken error:', error);

    if (error instanceof CustomError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }
  }
};
