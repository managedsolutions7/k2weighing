import { Request } from 'express';
import User from '../models/user.model';
import { LoginRequest, RegisterRequest, ChangePasswordRequest } from '../types/auth.types';
import { comparePasswords, hashPassword, validatePasswordStrength } from './hash.service';
import { signAccessToken, signRefreshToken } from './token.service';
import CustomError from '../utils/customError';
import logger from '../utils/logger';
import { CacheService } from './cache.service';
import { USER_PROFILE_CACHE_TTL, USER_PROFILE_KEY } from '@constants/cache.constants';
interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  refreshToken?: string; // Add this line
}
export class AuthService {
  /**
   * Authenticate user and generate tokens
   */
  static async login(req: Request): Promise<{
    token: string;
    refreshToken: string;
    user: {
      id: string;
      username: string;
      name: string;
      role: string;
      empId: string;
      plantId?: string;
    };
  }> {
    try {
      const { username, password }: LoginRequest = req.body;

      // Find user by username
      const user = await User.findOne({ username }).select('+password');
      if (!user) {
        logger.warn(`Login attempt failed: User not found - ${username}`);
        throw new CustomError('Invalid credentials', 401);
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn(`Login attempt failed: Inactive user - ${username}`);
        throw new CustomError('Account is deactivated', 401);
      }

      // Verify password
      const isPasswordValid = await comparePasswords(password, user.password);
      if (!isPasswordValid) {
        logger.warn(`Login attempt failed: Invalid password - ${username}`);
        throw new CustomError('Invalid credentials', 401);
      }

      // Generate tokens
      const token = signAccessToken(user._id.toString(), user.role, user.plantId?.toString());
      const refreshToken = signRefreshToken(user._id.toString());

      logger.info(`User logged in successfully: ${username}`);

      return {
        token,
        refreshToken,
        user: {
          id: user._id.toString(),
          username: user.username,
          name: user.name,
          role: user.role,
          empId: user.empId,
          plantId: user.plantId?.toString(),
        },
      };
    } catch (error) {
      logger.error('Auth service - login error:', error);
      throw error;
    }
  }

  /**
   * Register a new user
   */
  static async register(req: Request): Promise<{
    user: {
      id: string;
      username: string;
      name: string;
      role: string;
      empId: string;
      plantId?: string;
    };
  }> {
    try {
      const userData: RegisterRequest = req.body;

      // Check if username already exists
      const existingUsername = await User.findOne({ username: userData.username });
      if (existingUsername) {
        throw new CustomError('Username already exists', 400);
      }

      // Check if employee ID already exists
      const existingEmpId = await User.findOne({ empId: userData.empId });
      if (existingEmpId) {
        throw new CustomError('Employee ID already exists', 400);
      }

      // Validate password strength
      if (!validatePasswordStrength(userData.password)) {
        throw new CustomError('Password does not meet strength requirements', 400);
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);

      // Create user
      const user = new User({
        ...userData,
        password: hashedPassword,
      });

      const savedUser = await user.save();

      logger.info(`User registered successfully: ${savedUser.username}`);

      return {
        user: {
          id: savedUser._id.toString(),
          username: savedUser.username,
          name: savedUser.name,
          role: savedUser.role,
          empId: savedUser.empId,
          plantId: savedUser.plantId?.toString(),
        },
      };
    } catch (error) {
      logger.error('Auth service - register error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  static async changePassword(req: Request): Promise<{ message: string }> {
    try {
      const { currentPassword, newPassword }: ChangePasswordRequest = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      // Get user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        logger.warn(`Password change failed: Invalid current password - ${user.username}`);
        throw new CustomError('Current password is incorrect', 400);
      }

      // Validate new password strength
      if (!validatePasswordStrength(newPassword)) {
        throw new CustomError('New password does not meet strength requirements', 400);
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      user.password = hashedNewPassword;
      await user.save();

      logger.info(`Password changed successfully for user: ${user.username}`);
      // Invalidate profile cache
      await CacheService.del(USER_PROFILE_KEY(user._id.toString()));

      return { message: 'Password changed successfully' };
    } catch (error) {
      logger.error('Auth service - changePassword error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: AuthRequest): Promise<{ token: string; refreshToken: string }> {
    const { id, role } = req.user!;
    const token = signAccessToken(id, role, (req.user as any)?.plantId);
    const refreshToken = signRefreshToken(id);
    logger.info(`Token refreshed for user: ${id}`);
    return { token, refreshToken };
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: Request): Promise<{
    id: string;
    username: string;
    name: string;
    role: string;
    empId: string;
    plantId?: string;
    createdAt: Date;
  }> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const cacheKey = USER_PROFILE_KEY(userId);
      const profile = await CacheService.getOrSet<{
        id: string;
        username: string;
        name: string;
        role: string;
        empId: string;
        plantId?: string;
        createdAt: Date;
      }>(cacheKey, USER_PROFILE_CACHE_TTL, async () => {
        const user = await User.findById(userId);
        if (!user) {
          throw new CustomError('User not found', 404);
        }
        logger.info(`Profile fetched from DB for user: ${user.username}`);
        return {
          id: user._id.toString(),
          username: user.username,
          name: user.name,
          role: user.role,
          empId: user.empId,
          plantId: user.plantId?.toString(),
          createdAt: user.createdAt,
        };
      });

      logger.info(`Profile retrieved for user: ${profile.username}`);
      return profile;
    } catch (error) {
      logger.error('Auth service - getProfile error:', error);
      throw error;
    }
  }
}
