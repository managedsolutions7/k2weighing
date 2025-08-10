import { Router } from 'express';
import { PlantController } from '@controllers/plant.controller';
import { validate } from '@middlewares/validator';
import {
  createPlantSchema,
  updatePlantSchema,
  getPlantSchema,
  deletePlantSchema,
} from '@validations/plant.schema';
import { verifyToken } from '@middlewares/auth';
import { allowRoles } from '@middlewares/roleGuard';
import { checkPlantAccess } from '@middlewares/checkPlantAccess';
// Removed route-level cache middleware to avoid key collisions with service caching

const router = Router();

// Apply authentication to all routes
router.use(verifyToken);

/**
 * @swagger
 * tags:
 *   name: Plants
 *   description: Plant management endpoints
 */

/**
 * @swagger
 * /api/plants:
 *   post:
 *     summary: Create a new plant
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
 *               code:
 *                 type: string
 *               location:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Plant created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/', validate(createPlantSchema), allowRoles('admin'), PlantController.createPlant);

/**
 * @swagger
 * /api/plants:
 *   get:
 *     summary: Get all plants
 *     tags: [Plants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of plants
 *       401:
 *         description: Unauthorized
 */
router.get('/', allowRoles('admin'), PlantController.getPlants);

/**
 * @swagger
 * /api/plants/{id}:
 *   get:
 *     summary: Get a plant by ID
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
 *     responses:
 *       200:
 *         description: Plant details
 *       404:
 *         description: Plant not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:id',
  validate(getPlantSchema),
  allowRoles('admin', 'supervisor'),
  checkPlantAccess((req) => req.params.id),
  PlantController.getPlantById,
);

/**
 * @swagger
 * /api/plants/{id}:
 *   put:
 *     summary: Update a plant
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               location:
 *                 type: string
 *               address:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Plant updated successfully
 *       404:
 *         description: Plant not found
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', validate(updatePlantSchema), allowRoles('admin'), PlantController.updatePlant);

/**
 * @swagger
 * /api/plants/{id}:
 *   delete:
 *     summary: Delete a plant
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
 *     responses:
 *       200:
 *         description: Plant deleted successfully
 *       404:
 *         description: Plant not found
 *       401:
 *         description: Unauthorized
 */
router.delete(
  '/:id',
  validate(deletePlantSchema),
  allowRoles('admin'),
  PlantController.deletePlant,
);

export default router;
