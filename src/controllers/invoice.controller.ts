import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { InvoiceService } from '@services/invoice.service';
import logger from '@utils/logger';
import CustomError from '@utils/customError';

export class InvoiceController {
  /**
   * @swagger
   * /api/invoices:
   *   post:
   *     summary: Create a new invoice
   *     description: Create a new invoice from selected entries
   *     tags: [Invoices]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - vendor
   *               - plant
   *               - entries
   *             properties:
   *               vendor:
   *                 type: string
   *                 description: Vendor ID
   *                 example: "507f1f77bcf86cd799439013"
   *               plant:
   *                 type: string
   *                 description: Plant ID
   *                 example: "507f1f77bcf86cd799439011"
   *               entries:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of entry IDs
   *                 example: ["507f1f77bcf86cd799439015", "507f1f77bcf86cd799439016"]
   *               invoiceDate:
   *                 type: string
   *                 format: date-time
   *                 description: Invoice date (optional, defaults to current date)
   *                 example: "2024-01-15T10:30:00Z"
   *               dueDate:
   *                 type: string
   *                 format: date-time
   *                 description: Due date (optional, defaults to 30 days from invoice date)
   *                 example: "2024-02-14T10:30:00Z"
   *     responses:
   *       201:
   *         description: Invoice created successfully
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
   *                     invoiceNumber:
   *                       type: string
   *                       example: "INV-2024-0001"
   *                     totalAmount:
   *                       type: number
   *                     status:
   *                       type: string
   *                       enum: [draft, sent, paid, overdue]
   *                 message:
   *                   type: string
   *                   example: "Invoice created successfully"
   *       400:
   *         description: Bad request - validation error or business rule violation
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Not found - vendor, plant, or entries not found
   *       500:
   *         description: Internal server error
   */
  static async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const invoice = await InvoiceService.createInvoice(req);
      res.status(201).json({
        success: true,
        data: invoice,
        message: 'Invoice created successfully',
      });
    } catch (error) {
      logger.error('Invoice controller - createInvoice error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/invoices:
   *   get:
   *     summary: Get all invoices
   *     description: Retrieve invoices with filtering, pagination, and populated relationships
   *     tags: [Invoices]
   *     security:
   *       - bearerAuth: []
   *     parameters:
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
   *         name: status
   *         schema:
   *           type: string
   *           enum: [draft, sent, paid, overdue]
   *         description: Filter by invoice status
   *         example: "draft"
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
   *         description: Invoices retrieved successfully
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
   *                     invoices:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           invoiceNumber:
   *                             type: string
   *                           totalAmount:
   *                             type: number
   *                           status:
   *                             type: string
   *                           invoiceDate:
   *                             type: string
   *                             format: date-time
   *                           vendor:
   *                             type: object
   *                           plant:
   *                             type: object
   *                     total:
   *                       type: number
   *                     page:
   *                       type: number
   *                     limit:
   *                       type: number
   *                     totalPages:
   *                       type: number
   *                 message:
   *                   type: string
   *                   example: "Invoices retrieved successfully"
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const result = await InvoiceService.getInvoices(req);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Invoices retrieved successfully',
      });
    } catch (error) {
      logger.error('Invoice controller - getInvoices error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/invoices/{id}:
   *   get:
   *     summary: Get invoice by ID
   *     description: Retrieve a specific invoice with all populated relationships
   *     tags: [Invoices]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Invoice ID
   *         example: "507f1f77bcf86cd799439017"
   *     responses:
   *       200:
   *         description: Invoice retrieved successfully
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
   *                     invoiceNumber:
   *                       type: string
   *                     totalAmount:
   *                       type: number
   *                     status:
   *                       type: string
   *                     vendor:
   *                       type: object
   *                     plant:
   *                       type: object
   *                     entries:
   *                       type: array
   *                       items:
   *                         type: object
   *                 message:
   *                   type: string
   *                   example: "Invoice retrieved successfully"
   *       400:
   *         description: Bad request - invalid invoice ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Invoice not found
   *       500:
   *         description: Internal server error
   */
  static async getInvoiceById(req: Request, res: Response): Promise<void> {
    try {
      const invoice = await InvoiceService.getInvoiceById(req);
      res.status(200).json({
        success: true,
        data: invoice,
        message: 'Invoice retrieved successfully',
      });
    } catch (error) {
      logger.error('Invoice controller - getInvoiceById error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/invoices/{id}:
   *   put:
   *     summary: Update invoice
   *     description: Update an existing invoice status and details
   *     tags: [Invoices]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Invoice ID
   *         example: "507f1f77bcf86cd799439017"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [draft, sent, paid, overdue]
   *                 description: Invoice status
   *                 example: "sent"
   *               dueDate:
   *                 type: string
   *                 format: date-time
   *                 description: Due date
   *                 example: "2024-02-14T10:30:00Z"
   *               isActive:
   *                 type: boolean
   *                 description: Invoice active status
   *                 example: true
   *     responses:
   *       200:
   *         description: Invoice updated successfully
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
   *                   example: "Invoice updated successfully"
   *       400:
   *         description: Bad request - validation error
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Invoice not found
   *       500:
   *         description: Internal server error
   */
  static async updateInvoice(req: Request, res: Response): Promise<void> {
    try {
      const invoice = await InvoiceService.updateInvoice(req);
      res.status(200).json({
        success: true,
        data: invoice,
        message: 'Invoice updated successfully',
      });
    } catch (error) {
      logger.error('Invoice controller - updateInvoice error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/invoices/{id}:
   *   delete:
   *     summary: Delete invoice
   *     description: Soft delete an invoice by setting isActive to false
   *     tags: [Invoices]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Invoice ID
   *         example: "507f1f77bcf86cd799439017"
   *     responses:
   *       200:
   *         description: Invoice deleted successfully
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
   *                   example: "Invoice deleted successfully"
   *       400:
   *         description: Bad request - invalid invoice ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Invoice not found
   *       500:
   *         description: Internal server error
   */
  static async deleteInvoice(req: Request, res: Response): Promise<void> {
    try {
      const result = await InvoiceService.deleteInvoice(req);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Invoice controller - deleteInvoice error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/invoices/{id}/generate-pdf:
   *   post:
   *     summary: Generate PDF for invoice
   *     description: Generate a PDF document for the specified invoice
   *     tags: [Invoices]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Invoice ID
   *         example: "507f1f77bcf86cd799439017"
   *     responses:
   *       200:
   *         description: PDF generated successfully
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
   *                     pdfPath:
   *                       type: string
   *                       description: Path to generated PDF file
   *                     downloadUrl:
   *                       type: string
   *                       description: URL to download the PDF
   *                 message:
   *                   type: string
   *                   example: "PDF generated successfully"
   *       400:
   *         description: Bad request - invalid invoice ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Invoice not found
   *       500:
   *         description: Internal server error
   */
  static async generatePdf(req: Request, res: Response): Promise<void> {
    try {
      const result = await InvoiceService.generatePdf(req);
      res.status(200).json({
        success: true,
        data: result,
        message: 'PDF generated successfully',
      });
    } catch (error) {
      logger.error('Invoice controller - generatePdf error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/invoices/{id}/download:
   *   get:
   *     summary: Download invoice PDF
   *     description: Download the generated PDF file for an invoice
   *     tags: [Invoices]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Invoice ID
   *         example: "507f1f77bcf86cd799439017"
   *     responses:
   *       200:
   *         description: PDF file downloaded successfully
   *         content:
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Bad request - invalid invoice ID
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       404:
   *         description: Invoice or PDF file not found
   *       500:
   *         description: Internal server error
   */
  static async downloadPdf(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoice = await InvoiceService.getInvoiceById(req);

      if (!invoice.pdfPath) {
        throw new CustomError('PDF not generated for this invoice', 404);
      }

      const filePath = path.join(process.cwd(), invoice.pdfPath);

      if (!fs.existsSync(filePath)) {
        throw new CustomError('PDF file not found', 404);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      logger.info(`PDF downloaded for invoice: ${invoice.invoiceNumber}`);
    } catch (error) {
      logger.error('Invoice controller - downloadPdf error:', error);
      throw error;
    }
  }
}
