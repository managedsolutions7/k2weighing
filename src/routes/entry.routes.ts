import { Router } from 'express';
import { EntryController } from '../controllers/entry.controller';
import { validate } from '../middlewares/validator';
import {
  createEntrySchema,
  updateEntrySchema,
  getEntrySchema,
  deleteEntrySchema,
  getEntriesSchema,
  updateExitWeightSchema,
  reviewEntrySchema,
  flagEntrySchema,
} from '../validations/entry.schema';
import { verifyToken } from '../middlewares/auth';
import { allowRoles } from '../middlewares/roleGuard';

const router = Router();

// Apply authentication to all routes
router.use(verifyToken);

// Apply role-based access control for read/update routes
// Create and exit weight should be allowed for operators too; others restricted

/**
 * @swagger
 * tags:
 *   name: Entries
 *   description: Purchase and sale entry management endpoints
 */

/**
 * @swagger
 * /api/entries:
 *   post:
 *     summary: Create a new entry
 *     description: Create a new purchase or sale entry with validation
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entryType
 *               - vendor
 *               - vehicle
 *               - plant
 *               - quantity
 *               - rate
 *             properties:
 *               entryType:
 *                 type: string
 *                 enum: [purchase, sale]
 *                 description: Type of entry
 *                 example: "purchase"
 *               vendor:
 *                 type: string
 *                 description: Vendor ID
 *                 example: "507f1f77bcf86cd799439013"
 *               vehicle:
 *                 type: string
 *                 description: Vehicle ID
 *                 example: "507f1f77bcf86cd799439012"
 *               plant:
 *                 type: string
 *                 description: Plant ID
 *                 example: "507f1f77bcf86cd799439011"
 *               quantity:
 *                 type: number
 *                 description: Quantity in liters
 *                 example: 1000
 *               rate:
 *                 type: number
 *                 description: Rate per liter
 *                 example: 85.50
 *               entryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Entry date (optional, defaults to current date)
 *                 example: "2024-01-15T10:30:00Z"
 *     responses:
 *       201:
 *         description: Entry created successfully
 *       400:
 *         description: Bad request - validation error or business rule violation
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Not found - vendor, vehicle, or plant not found
 */
router.post(
  '/',
  allowRoles('admin', 'supervisor', 'operator'),
  validate(createEntrySchema),
  EntryController.createEntry,
);

/**
 * @swagger
 * /api/entries:
 *   get:
 *     summary: Get all entries
 *     description: Retrieve entries with filtering, pagination, and populated relationships
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entryType
 *         schema:
 *           type: string
 *           enum: [purchase, sale]
 *         description: Filter by entry type
 *         example: "purchase"
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Filter by vendor ID
 *         example: "507f1f77bcf86cd799439013"
 *       - in: query
 *         name: plant
 *         schema:
 *           type: string
 *         description: Filter by plant ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *         example: "2024-01-31T23:59:59Z"
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Entries retrieved successfully
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get(
  '/',
  allowRoles('admin', 'supervisor', 'operator'),
  validate(getEntriesSchema),
  EntryController.getEntries,
);

/**
 * @swagger
 * /api/entries/{id}:
 *   get:
 *     summary: Get entry by ID
 *     description: Retrieve a specific entry with all populated relationships
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry ID
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Entry retrieved successfully
 *       400:
 *         description: Bad request - invalid entry ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Entry not found
 */
router.get(
  '/:id',
  allowRoles('admin', 'supervisor', 'operator'),
  validate(getEntrySchema),
  EntryController.getEntryById,
);

/**
 * @swagger
 * /api/entries/{id}:
 *   put:
 *     summary: Update entry
 *     description: Update an existing entry with validation
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry ID
 *         example: "507f1f77bcf86cd799439015"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entryType:
 *                 type: string
 *                 enum: [purchase, sale]
 *                 description: Type of entry
 *               vendor:
 *                 type: string
 *                 description: Vendor ID
 *               vehicle:
 *                 type: string
 *                 description: Vehicle ID
 *               plant:
 *                 type: string
 *                 description: Plant ID
 *               quantity:
 *                 type: number
 *                 description: Quantity in liters
 *               rate:
 *                 type: number
 *                 description: Rate per liter
 *               entryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Entry date
 *               isActive:
 *                 type: boolean
 *                 description: Entry active status
 *     responses:
 *       200:
 *         description: Entry updated successfully
 *       400:
 *         description: Bad request - validation error or business rule violation
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Entry not found
 */
router.put(
  '/:id',
  allowRoles('admin', 'supervisor'),
  validate(updateEntrySchema),
  EntryController.updateEntry,
);

/**
 * @swagger
 * /api/entries/{id}:
 *   delete:
 *     summary: Delete entry
 *     description: Soft delete an entry by setting isActive to false
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry ID
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Entry deleted successfully
 *       400:
 *         description: Bad request - invalid entry ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Entry not found
 */
router.delete(
  '/:id',
  allowRoles('admin', 'supervisor'),
  validate(deleteEntrySchema),
  EntryController.deleteEntry,
);

/**
 * @swagger
 * /api/entries/{id}/exit:
 *   patch:
 *     summary: Update exit weight and compute variance
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exit weight updated
 */
router.patch(
  '/:id/exit',
  allowRoles('admin', 'supervisor', 'operator'),
  validate(updateExitWeightSchema),
  EntryController.updateExitWeight,
);

// Review and flag endpoints (supervisor/admin only)
router.patch(
  '/:id/review',
  allowRoles('admin', 'supervisor'),
  validate(reviewEntrySchema),
  EntryController.reviewEntry,
);
router.patch(
  '/:id/flag',
  allowRoles('admin', 'supervisor'),
  validate(flagEntrySchema),
  EntryController.flagEntry,
);

export default router;
