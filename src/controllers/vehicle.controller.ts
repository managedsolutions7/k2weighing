import { Request, Response } from 'express';
import { VehicleService } from '@services/vehicle.service';
import logger from '@utils/logger';

export class VehicleController {
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
  static async createVehicle(req: Request, res: Response): Promise<void> {
    try {
      const vehicle = await VehicleService.createVehicle(req);
      res.status(201).json({
        success: true,
        data: vehicle,
        message: 'Vehicle created successfully',
      });
    } catch (error) {
      logger.error('Vehicle controller - createVehicle error:', error);
      throw error;
    }
  }

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
   *         x-cache:
   *           cached: true
   *           ttlSeconds: 3600
   *       401:
   *         description: Unauthorized
   */
  static async getVehicles(req: Request, res: Response): Promise<void> {
    try {
      const vehicles = await VehicleService.getVehicles(req);
      res.status(200).json({
        success: true,
        data: vehicles,
        message: 'Vehicles retrieved successfully',
      });
    } catch (error) {
      logger.error('Vehicle controller - getVehicles error:', error);
      throw error;
    }
  }

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
   *         x-cache:
   *           cached: true
   *           ttlSeconds: 3600
   *       404:
   *         description: Vehicle not found
   *       401:
   *         description: Unauthorized
   */
  static async getVehicleById(req: Request, res: Response): Promise<void> {
    try {
      const vehicle = await VehicleService.getVehicleById(req);
      res.status(200).json({
        success: true,
        data: vehicle,
        message: 'Vehicle retrieved successfully',
      });
    } catch (error) {
      logger.error('Vehicle controller - getVehicleById error:', error);
      throw error;
    }
  }

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
  static async updateVehicle(req: Request, res: Response): Promise<void> {
    try {
      const vehicle = await VehicleService.updateVehicle(req);
      res.status(200).json({
        success: true,
        data: vehicle,
        message: 'Vehicle updated successfully',
      });
    } catch (error) {
      logger.error('Vehicle controller - updateVehicle error:', error);
      throw error;
    }
  }

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
  static async deleteVehicle(req: Request, res: Response): Promise<void> {
    try {
      const result = await VehicleService.deleteVehicle(req);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Vehicle controller - deleteVehicle error:', error);
      throw error;
    }
  }
}
