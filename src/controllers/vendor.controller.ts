import { Request, Response } from 'express';
import { VendorService } from '@services/vendor.service';
import logger from '@utils/logger';

export class VendorController {
  /**
   * @swagger
   * /api/vendors:
   *   post:
   *     summary: Create a new vendor
   *     tags: [Vendors]
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
   *               - contactPerson
   *               - phone
   *               - email
   *               - address
   *               - gstNumber
   *               - linkedPlants
   *             properties:
   *               name:
   *                 type: string
   *               code:
   *                 type: string
   *               contactPerson:
   *                 type: string
   *               phone:
   *                 type: string
   *               email:
   *                 type: string
   *               address:
   *                 type: string
   *               gstNumber:
   *                 type: string
   *               linkedPlants:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       201:
   *         description: Vendor created successfully
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   */
  static async createVendor(req: Request, res: Response): Promise<void> {
    try {
      const vendor = await VendorService.createVendor(req);
      res.status(201).json({
        success: true,
        data: vendor,
        message: 'Vendor created successfully',
      });
    } catch (error) {
      logger.error('Vendor controller - createVendor error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/vendors:
   *   get:
   *     summary: Get all vendors
   *     tags: [Vendors]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *       - in: query
   *         name: plantId
   *         schema:
   *           type: string
   *         description: Filter by linked plant
   *     responses:
   *       200:
   *         description: List of vendors
   *       401:
   *         description: Unauthorized
   */
  static async getVendors(req: Request, res: Response): Promise<void> {
    try {
      const vendors = await VendorService.getVendors(req);
      res.status(200).json({
        success: true,
        data: vendors,
        message: 'Vendors retrieved successfully',
      });
    } catch (error) {
      logger.error('Vendor controller - getVendors error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/vendors/{id}:
   *   get:
   *     summary: Get a vendor by ID
   *     tags: [Vendors]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
   *     responses:
   *       200:
   *         description: Vendor details
   *       404:
   *         description: Vendor not found
   *       401:
   *         description: Unauthorized
   */
  static async getVendorById(req: Request, res: Response): Promise<void> {
    try {
      const vendor = await VendorService.getVendorById(req);
      res.status(200).json({
        success: true,
        data: vendor,
        message: 'Vendor retrieved successfully',
      });
    } catch (error) {
      logger.error('Vendor controller - getVendorById error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/vendors/{id}:
   *   put:
   *     summary: Update a vendor
   *     tags: [Vendors]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
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
   *               contactPerson:
   *                 type: string
   *               phone:
   *                 type: string
   *               email:
   *                 type: string
   *               address:
   *                 type: string
   *               gstNumber:
   *                 type: string
   *               linkedPlants:
   *                 type: array
   *                 items:
   *                   type: string
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Vendor updated successfully
   *       404:
   *         description: Vendor not found
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   */
  static async updateVendor(req: Request, res: Response): Promise<void> {
    try {
      const vendor = await VendorService.updateVendor(req);
      res.status(200).json({
        success: true,
        data: vendor,
        message: 'Vendor updated successfully',
      });
    } catch (error) {
      logger.error('Vendor controller - updateVendor error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/vendors/{id}:
   *   delete:
   *     summary: Delete a vendor
   *     tags: [Vendors]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
   *     responses:
   *       200:
   *         description: Vendor deleted successfully
   *       404:
   *         description: Vendor not found
   *       401:
   *         description: Unauthorized
   */
  static async deleteVendor(req: Request, res: Response): Promise<void> {
    try {
      const result = await VendorService.deleteVendor(req);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Vendor controller - deleteVendor error:', error);
      throw error;
    }
  }
}
