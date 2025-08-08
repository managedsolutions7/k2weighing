// File: src/services/token.service.ts
import logger from '@utils/logger';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

export const signAccessToken = (userId: string, role: string): string => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyAccessToken = (token: string): boolean => {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (err) {
    logger.error(err);
    return false;
  }
};

export const decodeAccessToken = (token: string): { id: string; role: string } => {
  return jwt.decode(token) as { id: string; role: string };
};
