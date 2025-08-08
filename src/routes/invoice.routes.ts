import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller';
import { validate } from '../middlewares/validator';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  getInvoiceSchema,
  deleteInvoiceSchema,
  getInvoicesSchema,
  generatePdfSchema,
} from '../validations/invoice.schema';
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
 *   name: Invoices
 *   description: Invoice management and PDF generation endpoints
 */

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
 *       400:
 *         description: Bad request - validation error or business rule violation
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Not found - vendor, plant, or entries not found
 */
router.post('/', validate(createInvoiceSchema), InvoiceController.createInvoice);

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
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get('/', validate(getInvoicesSchema), InvoiceController.getInvoices);

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
 *       400:
 *         description: Bad request - invalid invoice ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Invoice not found
 */
router.get('/:id', validate(getInvoiceSchema), InvoiceController.getInvoiceById);

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
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Invoice not found
 */
router.put('/:id', validate(updateInvoiceSchema), InvoiceController.updateInvoice);

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
 *       400:
 *         description: Bad request - invalid invoice ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Invoice not found
 */
router.delete('/:id', validate(deleteInvoiceSchema), InvoiceController.deleteInvoice);

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
 *       400:
 *         description: Bad request - invalid invoice ID
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 *       404:
 *         description: Invoice not found
 */
router.post('/:id/generate-pdf', validate(generatePdfSchema), InvoiceController.generatePdf);

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
 */
router.get('/:id/download', validate(getInvoiceSchema), InvoiceController.downloadPdf);

export default router;
