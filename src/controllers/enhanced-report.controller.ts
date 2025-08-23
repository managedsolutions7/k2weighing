import { Request, Response } from 'express';
import { EnhancedReportService } from '@services/enhanced-report.service';
import logger from '@utils/logger';
import { Readable } from 'stream';

export class EnhancedReportController {
  /**
   * @swagger
   * /api/reports/enhanced-summary:
   *   get:
   *     summary: Get enhanced summary report
   *     description: Generate a comprehensive enhanced summary report with quality, review, material, and palette metrics
   *     tags: [Enhanced Reports]
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
   *         description: Enhanced summary report generated successfully
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   */
  static async getEnhancedSummaryReport(req: Request, res: Response): Promise<void> {
    try {
      const summary = await EnhancedReportService.generateEnhancedSummaryReport(req);
      res.status(200).json({
        success: true,
        data: summary,
        message: 'Enhanced summary report generated successfully',
      });
    } catch (error) {
      logger.error('Enhanced report controller - getEnhancedSummaryReport error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/reports/enhanced-detailed:
   *   get:
   *     summary: Get enhanced detailed report
   *     description: Generate a comprehensive enhanced detailed report with computed fields and quality metrics
   *     tags: [Enhanced Reports]
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
   *         description: Enhanced detailed report generated successfully
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   */
  static async getEnhancedDetailedReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await EnhancedReportService.generateEnhancedDetailedReport(req);
      res.status(200).json({
        success: true,
        data: report,
        message: 'Enhanced detailed report generated successfully',
      });
    } catch (error) {
      logger.error('Enhanced report controller - getEnhancedDetailedReport error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/reports/enhanced-vendors:
   *   get:
   *     summary: Get enhanced vendor report
   *     description: Generate a comprehensive enhanced vendor report with quality, review, and performance metrics
   *     tags: [Enhanced Reports]
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
   *         description: Enhanced vendor report generated successfully
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   */
  static async getEnhancedVendorReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await EnhancedReportService.generateEnhancedVendorReport(req);
      res.status(200).json({
        success: true,
        data: report,
        message: 'Enhanced vendor report generated successfully',
      });
    } catch (error) {
      logger.error('Enhanced report controller - getEnhancedVendorReport error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/reports/enhanced-plants:
   *   get:
   *     summary: Get enhanced plant report
   *     description: Generate a comprehensive enhanced plant report with quality, review, and performance metrics
   *     tags: [Enhanced Reports]
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
   *         description: Enhanced plant report generated successfully
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   */
  static async getEnhancedPlantReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await EnhancedReportService.generateEnhancedPlantReport(req);
      res.status(200).json({
        success: true,
        data: report,
        message: 'Enhanced plant report generated successfully',
      });
    } catch (error) {
      logger.error('Enhanced report controller - getEnhancedPlantReport error:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /api/reports/enhanced-export:
   *   get:
   *     summary: Export enhanced report to multiple formats
   *     description: Export enhanced report data to CSV, PDF, or Excel format with comprehensive metrics
   *     tags: [Enhanced Reports]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: format
   *         schema:
   *           type: string
   *           enum: [csv, pdf, excel]
   *           default: csv
   *         description: Export format (CSV, PDF, or Excel)
   *         example: "csv"
   *       - in: query
   *         name: reportType
   *         schema:
   *           type: string
   *           enum: [summary, detailed, vendors, plants]
   *           default: summary
   *         description: Type of report to export
   *         example: "summary"
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
   *         description: Enhanced report exported successfully
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Bad request - invalid query parameters
   *       401:
   *         description: Unauthorized - authentication required
   *       403:
   *         description: Forbidden - admin/supervisor access required
   */
  static async exportEnhancedReport(req: Request, res: Response): Promise<void> {
    try {
      const exportResult = await EnhancedReportService.exportEnhancedReport(req);

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);

      if (typeof exportResult.content === 'string') {
        res.status(200).send(exportResult.content);
      } else if (Buffer.isBuffer(exportResult.content)) {
        res.status(200).send(exportResult.content);
      } else if (exportResult.content instanceof Readable) {
        exportResult.content.pipe(res);
      } else {
        res.status(200).send(exportResult.content);
      }

      logger.info(`Enhanced report exported to ${req.query.format || 'csv'} successfully`);
    } catch (error) {
      logger.error('Enhanced report controller - exportEnhancedReport error:', error);
      throw error;
    }
  }
}

export default EnhancedReportController;
