import { Request, Response } from 'express';
import { PlantService } from '@services/plant.service';
import logger from '@utils/logger';

export class PlantController {
  /**
   * @swagger
   * /api/plants:
   *   post:
   *     summary: Create a new plant
   *     description: Create a new biofuel plant with location and address details
   *     tags: [Plants]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - code
   *               - location
   *               - address
   *             properties:
   *               name:
   *                 type: string
   *                 description: Plant name
   *                 example: "Main Biofuel Plant"
   *               code:
   *                 type: string
   *                 description: Unique plant code
   *                 example: "PLANT001"
   *               location:
   *                 type: string
   *                 description: Plant location/city
   *                 example: "Mumbai"
   *               address:
   *                 type: string
   *                 description: Full plant address
   *                 example: "123 Industrial Area, Mumbai, Maharashtra"
   *     responses:
   *       201:
   *         description: Plant created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/definitions/Plant'
   *                 message:
   *                   type: string
   *                   example: "Plant created successfully"
   *       400:
   *         description: Bad request - validation error or duplicate plant code
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async createPlant(req: Request, res: Response): Promise<void> {
    try {
      const plant = await PlantService.createPlant(req);
      res.status(201).json({
        success: true,
        data: plant,
        message: 'Plant created successfully',
      });
    } catch (error) {
      logger.error('Plant controller - createPlant error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/plants:
   *   get:
   *     summary: Get all plants
   *     description: Retrieve all plants with optional filtering by active status
   *     tags: [Plants]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *         example: true
   *     responses:
   *       200:
   *         description: List of plants retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/definitions/Plant'
   *                 message:
   *                   type: string
   *                   example: "Plants retrieved successfully"
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getPlants(req: Request, res: Response): Promise<void> {
    try {
      const plants = await PlantService.getPlants(req);
      res.status(200).json({
        success: true,
        data: plants,
        message: 'Plants retrieved successfully',
      });
    } catch (error) {
      logger.error('Plant controller - getPlants error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/plants/{id}:
   *   get:
   *     summary: Get a plant by ID
   *     description: Retrieve a specific plant by its ID
   *     tags: [Plants]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Plant ID
   *         example: "507f1f77bcf86cd799439011"
   *     responses:
   *       200:
   *         description: Plant details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/definitions/Plant'
   *                 message:
   *                   type: string
   *                   example: "Plant retrieved successfully"
   *       400:
   *         description: Bad request - invalid plant ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Plant not found
   *       500:
   *         description: Internal server error
   */
  static async getPlantById(req: Request, res: Response): Promise<void> {
    try {
      const plant = await PlantService.getPlantById(req);
      res.status(200).json({
        success: true,
        data: plant,
        message: 'Plant retrieved successfully',
      });
    } catch (error) {
      logger.error('Plant controller - getPlantById error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/plants/{id}:
   *   put:
   *     summary: Update a plant
   *     description: Update plant details by ID
   *     tags: [Plants]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Plant ID
   *         example: "507f1f77bcf86cd799439011"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Plant name
   *                 example: "Updated Plant Name"
   *               code:
   *                 type: string
   *                 description: Unique plant code
   *                 example: "PLANT002"
   *               location:
   *                 type: string
   *                 description: Plant location/city
   *                 example: "Delhi"
   *               address:
   *                 type: string
   *                 description: Full plant address
   *                 example: "456 Business Park, Delhi"
   *               isActive:
   *                 type: boolean
   *                 description: Plant active status
   *                 example: true
   *     responses:
   *       200:
   *         description: Plant updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/definitions/Plant'
   *                 message:
   *                   type: string
   *                   example: "Plant updated successfully"
   *       400:
   *         description: Bad request - validation error or duplicate plant code
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Plant not found
   *       500:
   *         description: Internal server error
   */
  static async updatePlant(req: Request, res: Response): Promise<void> {
    try {
      const plant = await PlantService.updatePlant(req);
      res.status(200).json({
        success: true,
        data: plant,
        message: 'Plant updated successfully',
      });
    } catch (error) {
      logger.error('Plant controller - updatePlant error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/plants/{id}:
   *   delete:
   *     summary: Delete a plant
   *     description: Soft delete a plant by setting isActive to false
   *     tags: [Plants]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Plant ID
   *         example: "507f1f77bcf86cd799439011"
   *     responses:
   *       200:
   *         description: Plant deleted successfully
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
   *                   example: "Plant deleted successfully"
   *       400:
   *         description: Bad request - invalid plant ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Plant not found
   *       500:
   *         description: Internal server error
   */
  static async deletePlant(req: Request, res: Response): Promise<void> {
    try {
      const result = await PlantService.deletePlant(req);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Plant controller - deletePlant error:', error);
      throw error;
    }
  }
}
