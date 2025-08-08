// File: src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '@services/auth.service';
import logger from '@utils/logger';
import {
  LoginRequest,
  RegisterRequest,
  ChangePasswordRequest,
  RefreshTokenRequest,
  LoginResponse,
  RegisterResponse,
  ChangePasswordResponse,
  RefreshTokenResponse,
  ProfileResponse,
  ErrorResponse,
} from '../types/auth.types';

export class AuthController {
  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Authenticate user and get access tokens
   *     description: Login with username and password to receive access and refresh tokens
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 description: User's username
   *                 example: "admin"
   *               password:
   *                 type: string
   *                 description: User's password
   *                 example: "password123"
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     token:
   *                       type: string
   *                       description: JWT access token
   *                     refreshToken:
   *                       type: string
   *                       description: JWT refresh token
   *                     user:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         username:
   *                           type: string
   *                         name:
   *                           type: string
   *                         role:
   *                           type: string
   *                           enum: [admin, supervisor, operator]
   *                         empId:
   *                           type: string
   *                         plantId:
   *                           type: string
   *                 message:
   *                   type: string
   *                   example: "Login successful"
   *       400:
   *         description: Bad request - validation error
   *       401:
   *         description: Unauthorized - invalid credentials
   *       500:
   *         description: Internal server error
   */
  static async login(
    req: Request<unknown, LoginResponse | ErrorResponse, LoginRequest>,
    res: Response<LoginResponse | ErrorResponse>,
  ): Promise<void> {
    try {
      const result = await AuthService.login(req);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login successful',
      });
    } catch (error) {
      logger.error('Auth controller - login error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Register a new user
   *     description: Create a new user account (admin only)
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *               - name
   *               - empId
   *               - role
   *             properties:
   *               username:
   *                 type: string
   *                 description: Unique username
   *                 example: "john.doe"
   *               password:
   *                 type: string
   *                 description: User password (min 6 chars)
   *                 example: "password123"
   *               name:
   *                 type: string
   *                 description: Full name
   *                 example: "John Doe"
   *               empId:
   *                 type: string
   *                 description: Employee ID
   *                 example: "EMP001"
   *               role:
   *                 type: string
   *                 enum: [admin, supervisor, operator]
   *                 description: User role
   *                 example: "supervisor"
   *               plantId:
   *                 type: string
   *                 description: Associated plant ID (optional)
   *                 example: "507f1f77bcf86cd799439011"
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       $ref: '#/definitions/User'
   *                 message:
   *                   type: string
   *                   example: "User registered successfully"
   *       400:
   *         description: Bad request - validation error or duplicate entry
   *       401:
   *         description: Unauthorized - admin access required
   *       500:
   *         description: Internal server error
   */
  static async register(
    req: Request<unknown, RegisterResponse | ErrorResponse, RegisterRequest>,
    res: Response<RegisterResponse | ErrorResponse>,
  ): Promise<void> {
    try {
      const result = await AuthService.register(req);

      res.status(201).json({
        success: true,
        data: result,
        message: 'User registered successfully',
      });
    } catch (error) {
      logger.error('Auth controller - register error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/auth/change-password:
   *   post:
   *     summary: Change user password
   *     description: Change the current user's password
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *                 description: Current password
   *                 example: "oldpassword123"
   *               newPassword:
   *                 type: string
   *                 description: New password (min 6 chars)
   *                 example: "newpassword123"
   *     responses:
   *       200:
   *         description: Password changed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Password changed successfully"
   *       400:
   *         description: Bad request - validation error or incorrect current password
   *       401:
   *         description: Unauthorized - authentication required
   *       500:
   *         description: Internal server error
   */
  static async changePassword(
    req: Request<unknown, ChangePasswordResponse | ErrorResponse, ChangePasswordRequest>,
    res: Response<ChangePasswordResponse | ErrorResponse>,
  ): Promise<void> {
    try {
      const result = await AuthService.changePassword(req);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Auth controller - changePassword error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/auth/refresh:
   *   post:
   *     summary: Refresh access token
   *     description: Get a new access token using refresh token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: JWT refresh token
   *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *     responses:
   *       200:
   *         description: Token refreshed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     token:
   *                       type: string
   *                       description: New JWT access token
   *                 message:
   *                   type: string
   *                   example: "Token refreshed successfully"
   *       400:
   *         description: Bad request - refresh token required
   *       401:
   *         description: Unauthorized - invalid or expired refresh token
   *       500:
   *         description: Internal server error
   */
  static async refreshToken(
    req: Request<unknown, RefreshTokenResponse | ErrorResponse, RefreshTokenRequest>,
    res: Response<RefreshTokenResponse | ErrorResponse>,
  ): Promise<void> {
    try {
      const result = await AuthService.refreshToken(req);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      logger.error('Auth controller - refreshToken error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/auth/profile:
   *   get:
   *     summary: Get current user profile
   *     description: Retrieve the profile of the authenticated user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: User ID
   *                     username:
   *                       type: string
   *                       description: Username
   *                     name:
   *                       type: string
   *                       description: Full name
   *                     role:
   *                       type: string
   *                       enum: [admin, supervisor, operator]
   *                       description: User role
   *                     empId:
   *                       type: string
   *                       description: Employee ID
   *                     plantId:
   *                       type: string
   *                       description: Associated plant ID
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Account creation date
   *                 message:
   *                   type: string
   *                   example: "Profile retrieved successfully"
   *       401:
   *         description: Unauthorized - authentication required
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  static async getProfile(
    req: Request<unknown, ProfileResponse | ErrorResponse>,
    res: Response<ProfileResponse | ErrorResponse>,
  ): Promise<void> {
    try {
      const result = await AuthService.getProfile(req);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Profile retrieved successfully',
      });
    } catch (error) {
      logger.error('Auth controller - getProfile error:', error);
      throw error;
    }
  }
}
