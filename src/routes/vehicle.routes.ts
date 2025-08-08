import { Router } from 'express';
import { VehicleController } from '../controllers/vehicle.controller';
import { validate } from '../middlewares/validator';
import {
  createVehicleSchema,
  updateVehicleSchema,
  getVehicleSchema,
  deleteVehicleSchema,
} from '../validations/vehicle.schema';
import { verifyToken } from '../middlewares/auth';
import { allowRoles } from '../middlewares/roleGuard';

const router = Router();

// Apply authentication to all routes
router.use(verifyToken);

// Apply role-based access control
router.use(allowRoles('admin', 'supervisor'));

/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: Vehicle management endpoints
 */

/**
 * @swagger
 * /api/vehicles:
 *   post:
 *     summary: Create a new vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleNumber
 *               - vehicleType
 *               - capacity
 *               - driverName
 *               - driverPhone
 *             properties:
 *               vehicleNumber:
 *                 type: string
 *               vehicleType:
 *                 type: string
 *                 enum: [buy, sell]
 *               capacity:
 *                 type: number
 *               driverName:
 *                 type: string
 *               driverPhone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vehicle created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/', validate(createVehicleSchema), VehicleController.createVehicle);

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Get all vehicles
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: vehicleType
 *         schema:
 *           type: string
 *           enum: [buy, sell]
 *         description: Filter by vehicle type
 *     responses:
 *       200:
 *         description: List of vehicles
 *       401:
 *         description: Unauthorized
 */
router.get('/', VehicleController.getVehicles);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Get a vehicle by ID
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *     responses:
 *       200:
 *         description: Vehicle details
 *       404:
 *         description: Vehicle not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', validate(getVehicleSchema), VehicleController.getVehicleById);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   put:
 *     summary: Update a vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vehicleNumber:
 *                 type: string
 *               vehicleType:
 *                 type: string
 *                 enum: [buy, sell]
 *               capacity:
 *                 type: number
 *               driverName:
 *                 type: string
 *               driverPhone:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Vehicle updated successfully
 *       404:
 *         description: Vehicle not found
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', validate(updateVehicleSchema), VehicleController.updateVehicle);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Delete a vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *     responses:
 *       200:
 *         description: Vehicle deleted successfully
 *       404:
 *         description: Vehicle not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', validate(deleteVehicleSchema), VehicleController.deleteVehicle);

export default router;
