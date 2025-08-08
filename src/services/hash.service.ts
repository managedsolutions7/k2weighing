// File: src/services/hash.service.ts
import bcrypt from 'bcryptjs';
import logger from '../utils/logger';
import CustomError from '../utils/customError';

export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    logger.info('Password hashed successfully');
    return hashedPassword;
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new CustomError('Failed to hash password', 500);
  }
};

export const comparePasswords = async (plainText: string, hashed: string): Promise<boolean> => {
  try {
    const isMatch = await bcrypt.compare(plainText, hashed);
    logger.info(`Password comparison result: ${isMatch}`);
    return isMatch;
  } catch (error) {
    logger.error('Error comparing passwords:', error);
    throw new CustomError('Failed to compare passwords', 500);
  }
};

export const validatePasswordStrength = (password: string): boolean => {
  // Basic password strength validation
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  return password.length >= minLength && (hasUpperCase || hasLowerCase || hasNumbers);
};

export const generateRandomPassword = (length: number = 8): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};
