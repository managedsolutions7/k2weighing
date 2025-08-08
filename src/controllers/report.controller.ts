import { Request, Response } from 'express';
import { ReportService } from '@services/report.service';
import logger from '@utils/logger';

export class ReportController {
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
   *                     totalEntries:
   *                       type: number
   *                       description: Total number of entries
   *                     totalQuantity:
   *                       type: number
   *                       description: Total quantity in liters
   *                     totalAmount:
   *                       type: number
   *                       description: Total amount in currency
   *                     averageRate:
   *                       type: number
   *                       description: Average rate per liter
   *                     purchaseEntries:
   *                       type: number
   *                       description: Number of purchase entries
   *                     purchaseQuantity:
   *                       type: number
   *                       description: Total purchase quantity
   *                     purchaseAmount:
   *                       type: number
   *                       description: Total purchase amount
   *                     saleEntries:
   *                       type: number
   *                       description: Number of sale entries
   *                     saleQuantity:
   *                       type: number
   *                       description: Total sale quantity
   *                     saleAmount:
   *                       type: number
   *                       description: Total sale amount
   *                     dateRange:
   *                       type: object
   *                       properties:
   *                         start:
   *                           type: string
   *                           format: date-time
   *                         end:
   *                           type: string
   *                           format: date-time
   *                 message:
   *                   type: string
   *                   example: "Summary report generated successfully"
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getSummaryReport(req: Request, res: Response): Promise<void> {
    try {
      const summary = await ReportService.generateSummaryReport(req);
      res.status(200).json({
        success: true,
        data: summary,
        message: 'Summary report generated successfully',
      });
    } catch (error) {
      logger.error('Report controller - getSummaryReport error:', error);
      throw error;
    }
  }

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
   *                           plant:
   *                             type: object
   *                           vehicle:
   *                             type: object
   *                     summary:
   *                       type: object
   *                       description: Summary statistics
   *                     pagination:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                         page:
   *                           type: number
   *                         limit:
   *                           type: number
   *                         totalPages:
   *                           type: number
   *                 message:
   *                   type: string
   *                   example: "Detailed report generated successfully"
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getDetailedReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await ReportService.generateDetailedReport(req);
      res.status(200).json({
        success: true,
        data: report,
        message: 'Detailed report generated successfully',
      });
    } catch (error) {
      logger.error('Report controller - getDetailedReport error:', error);
      throw error;
    }
  }

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
   *                     type: object
   *                     properties:
   *                       vendor:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           name:
   *                             type: string
   *                           code:
   *                             type: string
   *                       totalEntries:
   *                         type: number
   *                       totalQuantity:
   *                         type: number
   *                       totalAmount:
   *                         type: number
   *                       averageRate:
   *                         type: number
   *                       purchaseEntries:
   *                         type: number
   *                       purchaseQuantity:
   *                         type: number
   *                       purchaseAmount:
   *                         type: number
   *                       saleEntries:
   *                         type: number
   *                       saleQuantity:
   *                         type: number
   *                       saleAmount:
   *                         type: number
   *                 message:
   *                   type: string
   *                   example: "Vendor report generated successfully"
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getVendorReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await ReportService.generateVendorReport(req);
      res.status(200).json({
        success: true,
        data: report,
        message: 'Vendor report generated successfully',
      });
    } catch (error) {
      logger.error('Report controller - getVendorReport error:', error);
      throw error;
    }
  }

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
   *                     type: object
   *                     properties:
   *                       plant:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           name:
   *                             type: string
   *                           code:
   *                             type: string
   *                       totalEntries:
   *                         type: number
   *                       totalQuantity:
   *                         type: number
   *                       totalAmount:
   *                         type: number
   *                       averageRate:
   *                         type: number
   *                       purchaseEntries:
   *                         type: number
   *                       purchaseQuantity:
   *                         type: number
   *                       purchaseAmount:
   *                         type: number
   *                       saleEntries:
   *                         type: number
   *                       saleQuantity:
   *                         type: number
   *                       saleAmount:
   *                         type: number
   *                 message:
   *                   type: string
   *                   example: "Plant report generated successfully"
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getPlantReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await ReportService.generatePlantReport(req);
      res.status(200).json({
        success: true,
        data: report,
        message: 'Plant report generated successfully',
      });
    } catch (error) {
      logger.error('Report controller - getPlantReport error:', error);
      throw error;
    }
  }

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
   *                     type: object
   *                     properties:
   *                       date:
   *                         type: string
   *                         description: Date/time period
   *                       entries:
   *                         type: number
   *                         description: Number of entries
   *                       quantity:
   *                         type: number
   *                         description: Total quantity
   *                       amount:
   *                         type: number
   *                         description: Total amount
   *                       purchaseEntries:
   *                         type: number
   *                       purchaseQuantity:
   *                         type: number
   *                       purchaseAmount:
   *                         type: number
   *                       saleEntries:
   *                         type: number
   *                       saleQuantity:
   *                         type: number
   *                       saleAmount:
   *                         type: number
   *                 message:
   *                   type: string
   *                   example: "Time series report generated successfully"
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   *       500:
   *         description: Internal server error
   */
  static async getTimeSeriesReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await ReportService.generateTimeSeriesReport(req);
      res.status(200).json({
        success: true,
        data: report,
        message: 'Time series report generated successfully',
      });
    } catch (error) {
      logger.error('Report controller - getTimeSeriesReport error:', error);
      throw error;
    }
  }

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
   *       500:
   *         description: Internal server error
   */
  static async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const csvContent = await ReportService.exportToCSV(req);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
      res.status(200).send(csvContent);

      logger.info('Report exported to CSV successfully');
    } catch (error) {
      logger.error('Report controller - exportReport error:', error);
      throw error;
    }
  }
}
