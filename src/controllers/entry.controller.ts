import { Request, Response } from 'express';
import { EntryService } from '@services/entry.service';
import logger from '@utils/logger';

export class EntryController {
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
   *                     _id:
   *                       type: string
   *                     entryType:
   *                       type: string
   *                     totalAmount:
   *                       type: number
   *                     entryDate:
   *                       type: string
   *                       format: date-time
   *                 message:
   *                   type: string
   *                   example: "Entry created successfully"
   *       400:
   *         description: Bad request - validation error or business rule violation
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Not found - vendor, vehicle, or plant not found
   *       500:
   *         description: Internal server error
   */
  static async createEntry(req: Request, res: Response): Promise<void> {
    try {
      const entry = await EntryService.createEntry(req);
      res.status(201).json({
        success: true,
        data: entry,
        message: 'Entry created successfully',
      });
    } catch (error) {
      logger.error('Entry controller - createEntry error:', error);
      throw error;
    }
  }

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
   *         x-cache:
   *           cached: true
   *           ttlSeconds: 300
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
   *                     entries:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           entryType:
   *                             type: string
   *                           quantity:
   *                             type: number
   *                           rate:
   *                             type: number
   *                           totalAmount:
   *                             type: number
   *                           entryDate:
   *                             type: string
   *                             format: date-time
   *                           vendor:
   *                             type: object
   *                             properties:
   *                               _id:
   *                                 type: string
   *                               name:
   *                                 type: string
   *                               code:
   *                                 type: string
   *                           vehicle:
   *                             type: object
   *                             properties:
   *                               _id:
   *                                 type: string
   *                               vehicleNumber:
   *                                 type: string
   *                               vehicleType:
   *                                 type: string
   *                           plant:
   *                             type: object
   *                             properties:
   *                               _id:
   *                                 type: string
   *                               name:
   *                                 type: string
   *                               code:
   *                                 type: string
   *                     total:
   *                       type: number
   *                       description: Total number of entries
   *                     page:
   *                       type: number
   *                       description: Current page number
   *                     limit:
   *                       type: number
   *                       description: Items per page
   *                     totalPages:
   *                       type: number
   *                       description: Total number of pages
   *                 message:
   *                   type: string
   *                   example: "Entries retrieved successfully"
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getEntries(req: Request, res: Response): Promise<void> {
    try {
      const result = await EntryService.getEntries(req);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Entries retrieved successfully',
      });
    } catch (error) {
      logger.error('Entry controller - getEntries error:', error);
      throw error;
    }
  }

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
   *         x-cache:
   *           cached: true
   *           ttlSeconds: 300
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
   *                     _id:
   *                       type: string
   *                     entryType:
   *                       type: string
   *                     quantity:
   *                       type: number
   *                     rate:
   *                       type: number
   *                     totalAmount:
   *                       type: number
   *                     entryDate:
   *                       type: string
   *                       format: date-time
   *                     vendor:
   *                       type: object
   *                     vehicle:
   *                       type: object
   *                     plant:
   *                       type: object
   *                     createdBy:
   *                       type: object
   *                 message:
   *                   type: string
   *                   example: "Entry retrieved successfully"
   *       400:
   *         description: Bad request - invalid entry ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Entry not found
   *       500:
   *         description: Internal server error
   */
  static async getEntryById(req: Request, res: Response): Promise<void> {
    try {
      const entry = await EntryService.getEntryById(req);
      res.status(200).json({
        success: true,
        data: entry,
        message: 'Entry retrieved successfully',
      });
    } catch (error) {
      logger.error('Entry controller - getEntryById error:', error);
      throw error;
    }
  }

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
   *                 message:
   *                   type: string
   *                   example: "Entry updated successfully"
   *       400:
   *         description: Bad request - validation error or business rule violation
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Entry not found
   *       500:
   *         description: Internal server error
   */
  static async updateEntry(req: Request, res: Response): Promise<void> {
    try {
      const entry = await EntryService.updateEntry(req);
      res.status(200).json({
        success: true,
        data: entry,
        message: 'Entry updated successfully',
      });
    } catch (error) {
      logger.error('Entry controller - updateEntry error:', error);
      throw error;
    }
  }

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
   *                   example: "Entry deleted successfully"
   *       400:
   *         description: Bad request - invalid entry ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Entry not found
   *       500:
   *         description: Internal server error
   */
  static async deleteEntry(req: Request, res: Response): Promise<void> {
    try {
      const result = await EntryService.deleteEntry(req);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Entry controller - deleteEntry error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/entries/{id}/exit:
   *   patch:
   *     summary: Update exit weight and finalize entry
   *     description: Sets exit weight, computes expected and exact weights, flags variance, and updates invoices.
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               exitWeight:
   *                 type: number
   *                 description: Measured exit weight
   *     responses:
   *       200:
   *         description: Exit weight updated and totals recalculated
   */
  static async updateExitWeight(req: Request, res: Response): Promise<void> {
    try {
      const entry = await EntryService.updateExitWeight(req);
      res.status(200).json({ success: true, data: entry, message: 'Exit weight updated' });
    } catch (error) {
      logger.error('Entry controller - updateExitWeight error:', error);
      throw error;
    }
  }

  /**
   * Review an entry (supervisor/admin)
   */
  static async reviewEntry(req: Request, res: Response): Promise<void> {
    try {
      const updated = await EntryService.reviewEntry(req);
      res.status(200).json({ success: true, data: updated, message: 'Entry reviewed' });
    } catch (error) {
      logger.error('Entry controller - reviewEntry error:', error);
      throw error;
    }
  }

  /**
   * Flag/unflag an entry (supervisor/admin)
   */
  static async flagEntry(req: Request, res: Response): Promise<void> {
    try {
      const updated = await EntryService.flagEntry(req);
      res.status(200).json({ success: true, data: updated, message: 'Entry flag updated' });
    } catch (error) {
      logger.error('Entry controller - flagEntry error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/entries/{id}/receipt:
   *   get:
   *     summary: Download entry receipt PDF
   *     description: Returns a PDF receipt for the entry. Not available if varianceFlag is true.
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
   *     responses:
   *       200:
   *         description: PDF receipt
   *         content:
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *       403:
   *         description: Receipt not available due to variance failure or forbidden plant scope
   *       404:
   *         description: Entry not found
   */
  static async downloadReceipt(req: Request, res: Response): Promise<void> {
    try {
      const { s3Key } = await EntryService.generateReceiptPdf(req);
      const url = await (await import('@services/s3.service')).S3Service.getPresignedGetUrl(s3Key);
      res.json({ url });
    } catch (error) {
      logger.error('Entry controller - downloadReceipt error:', error);
      throw error;
    }
  }
}
