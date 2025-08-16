// File: src/services/token.service.ts
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import CustomError from '../utils/customError';
import { env } from '../config/env';

export interface TokenPayload {
  id: string;
  role: string;
  plantId?: string;
  iat?: number;
  exp?: number;
}

export const signAccessToken = (userId: string, role: string, plantId?: string): string => {
  try {
    const payload: TokenPayload = { id: userId, role, plantId };
    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d',
      issuer: 'biofuel-management-system',
      audience: 'biofuel-users',
    });
    logger.info(`Access token generated for user: ${userId}`);
    return token;
  } catch (error) {
    logger.error('Error signing access token:', error);
    throw new CustomError('Failed to generate access token', 500);
  }
};

export const signRefreshToken = (userId: string): string => {
  try {
    const payload = { id: userId };
    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '30d',
      issuer: 'biofuel-management-system',
      audience: 'biofuel-users',
    });
    logger.info(`Refresh token generated for user: ${userId}`);
    return token;
  } catch (error) {
    logger.error('Error signing refresh token:', error);
    throw new CustomError('Failed to generate refresh token', 500);
  }
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    logger.info(`Access token verified for user: ${decoded.id}`);
    return decoded;
  } catch (error) {
    logger.error('Error verifying access token:', error);
    if (error instanceof jwt.TokenExpiredError) {
      throw new CustomError('Token expired', 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new CustomError('Invalid token', 401);
    }
    throw new CustomError('Token verification failed', 401);
  }
};

export const verifyRefreshToken = (token: string): { id: string } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    logger.info(`Refresh token verified for user: ${decoded.id}`);
    return decoded;
  } catch (error) {
    logger.error('Error verifying refresh token:', error);
    if (error instanceof jwt.TokenExpiredError) {
      throw new CustomError('Refresh token expired', 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new CustomError('Invalid refresh token', 401);
    }
    throw new CustomError('Refresh token verification failed', 401);
  }
};

export const decodeAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    if (!decoded) {
      throw new CustomError('Invalid token format', 401);
    }
    logger.info(`Access token decoded for user: ${decoded.id}`);
    return decoded;
  } catch (error) {
    logger.error('Error decoding access token:', error);
    throw new CustomError('Failed to decode token', 401);
  }
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    if (!decoded || !decoded.exp) {
      return true;
    }
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    logger.error('Error checking token expiration:', error);
    return true;
  }
};
