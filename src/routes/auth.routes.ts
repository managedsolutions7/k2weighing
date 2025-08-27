// File: src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validator';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  updateUserSchema,
} from '../validations/auth.schema';
import { verifyRefreshToken, verifyToken } from '../middlewares/auth';
import { allowRoles } from '../middlewares/roleGuard';
import User from '../models/user.model';
import { Request, Response } from 'express';
import Plant from '@models/plant.model';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), AuthController.login);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new user
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
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               empId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, supervisor, operator]
 *               plantId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/register',
  verifyToken,
  allowRoles('admin'),
  validate(registerSchema),
  AuthController.register,
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
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
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/change-password',
  verifyToken,
  allowRoles('admin'),
  validate(changePasswordSchema),
  AuthController.changePassword,
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
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
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/refresh', verifyRefreshToken, AuthController.refreshToken);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', verifyToken, AuthController.getProfile);

router.get('/users', verifyToken, allowRoles('admin'), async (req, res: Response) => {
  try {
    const users = await User.find().select('-password').populate('plantId', 'name');

    res.json({ success: true, data: users, message: 'Users retrieved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin - update user role/plant/status
router.patch(
  '/users/:id',
  verifyToken,
  allowRoles('admin'),
  validate(updateUserSchema),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role, plantId, isActive } = req.body as {
      role?: 'admin' | 'supervisor' | 'operator';
      plantId?: string | null;
      isActive?: boolean;
    };
    const update: any = {};
    if (role) update.role = role;
    if (plantId !== undefined) update.plantId = plantId || undefined;
    if (typeof isActive === 'boolean') update.isActive = isActive;
    const user = await User.findByIdAndUpdate(id, update, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      data: { id: user._id, role: user.role, plantId: user.plantId, isActive: user.isActive },
      message: 'User updated',
    });
  },
);
export default router;
