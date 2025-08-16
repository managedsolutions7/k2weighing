import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { validate } from '../middlewares/validator';
import { verifyToken } from '../middlewares/auth';
import { allowRoles } from '../middlewares/roleGuard';
import {
  summaryReportSchema,
  detailedReportSchema,
  vendorReportSchema,
  plantReportSchema,
  timeSeriesReportSchema,
  exportReportSchema,
} from '../validations/report.schema';

const router = Router();

// Apply authentication to all routes
router.use(verifyToken);

// Apply role-based access control
router.use(allowRoles('admin', 'supervisor'));

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Analytics and reporting endpoints
 */

/**
 * @swagger
 * /api/reports/summary:
 *   get:
 *     summary: Get summary report
 *     description: Generate a comprehensive summary report with totals and averages
 *     tags: [Reports]
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
 *     responses:
 *       200:
 *         description: Summary report generated successfully
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get('/summary', validate(summaryReportSchema), ReportController.getSummaryReport);

/**
 * @swagger
 * /api/reports/detailed:
 *   get:
 *     summary: Get detailed report
 *     description: Generate a detailed report with paginated entries and summary
 *     tags: [Reports]
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
 *         description: Detailed report generated successfully
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get('/detailed', validate(detailedReportSchema), ReportController.getDetailedReport);

/**
 * @swagger
 * /api/reports/vendors:
 *   get:
 *     summary: Get vendor report
 *     description: Generate a vendor-wise aggregated report
 *     tags: [Reports]
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
 *     responses:
 *       200:
 *         description: Vendor report generated successfully
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get('/vendors', validate(vendorReportSchema), ReportController.getVendorReport);

/**
 * @swagger
 * /api/reports/plants:
 *   get:
 *     summary: Get plant report
 *     description: Generate a plant-wise aggregated report
 *     tags: [Reports]
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
 *     responses:
 *       200:
 *         description: Plant report generated successfully
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get('/plants', validate(plantReportSchema), ReportController.getPlantReport);

/**
 * @swagger
 * /api/reports/timeseries:
 *   get:
 *     summary: Get time series report
 *     description: Generate a time series report with daily/weekly/monthly aggregations
 *     tags: [Reports]
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
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Group by time period
 *         example: "day"
 *     responses:
 *       200:
 *         description: Time series report generated successfully
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get('/timeseries', validate(timeSeriesReportSchema), ReportController.getTimeSeriesReport);

/**
 * @swagger
 * /api/reports/export:
 *   get:
 *     summary: Export report to CSV
 *     description: Export report data to CSV format
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv]
 *           default: csv
 *         description: Export format
 *         example: "csv"
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [vendor, plant]
 *         description: Group by vendor or plant
 *         example: "vendor"
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
 *     responses:
 *       200:
 *         description: Report exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/supervisor access required
 */
router.get('/export', validate(exportReportSchema), ReportController.exportReport);

// Supervisor dashboard data
router.get(
  '/dashboard/supervisor',
  validate(summaryReportSchema),
  ReportController.getSummaryReport,
);

export default router;
