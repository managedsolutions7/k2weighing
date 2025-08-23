import { Request, Response } from 'express';
import EnhancedDashboardService from '@services/enhanced-dashboard.service';
import logger from '@utils/logger';

export class EnhancedDashboardController {
  /**
   * @swagger
   * /api/enhanced-dashboard/admin:
   *   get:
   *     summary: Get enhanced admin dashboard
   *     description: Get comprehensive admin dashboard with enhanced metrics including quality analysis, review status, and material/palette breakdowns
   *     tags: [Enhanced Dashboard]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for filtering
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for filtering
   *       - in: query
   *         name: topVendorsLimit
   *         schema:
   *           type: integer
   *           default: 5
   *         description: Number of top vendors to return
   *       - in: query
   *         name: recentEntriesLimit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Number of recent entries to return
   *       - in: query
   *         name: recentInvoicesLimit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Number of recent invoices to return
   *       - in: query
   *         name: includeFlags
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Include flagged entries in analysis
   *     responses:
   *       200:
   *         description: Enhanced admin dashboard data retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     totals:
   *                       type: object
   *                       properties:
   *                         totalEntries:
   *                           type: number
   *                         totalQuantity:
   *                           type: number
   *                         totalAmount:
   *                           type: number
   *                         averageRate:
   *                           type: number
   *                     byType:
   *                       type: object
   *                       properties:
   *                         purchase:
   *                           type: object
   *                         sale:
   *                           type: object
   *                     quality:
   *                       type: object
   *                       properties:
   *                         totalMoistureWeight:
   *                           type: number
   *                         totalDustWeight:
   *                           type: number
   *                         averageMoisturePercentage:
   *                           type: number
   *                         averageDustPercentage:
   *                           type: number
   *                         moistureDeductionPercentage:
   *                           type: number
   *                         dustDeductionPercentage:
   *                           type: number
   *                     review:
   *                       type: object
   *                       properties:
   *                         reviewedEntries:
   *                           type: number
   *                         pendingReview:
   *                           type: number
   *                         reviewRate:
   *                           type: number
   *                         flaggedEntries:
   *                           type: number
   *                         varianceFlaggedEntries:
   *                           type: number
   *                         manualWeightEntries:
   *                           type: number
   *                         flagRate:
   *                           type: number
   *                     breakdowns:
   *                       type: object
   *                       properties:
   *                         materials:
   *                           type: array
   *                         palettes:
   *                           type: array
   *                     topVendors:
   *                       type: array
   *                     recentEntries:
   *                       type: array
   *                     recentInvoices:
   *                       type: array
   *                     counts:
   *                       type: object
   *                 message:
   *                   type: string
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - admin access required
   *       500:
   *         description: Internal server error
   */
  static async getEnhancedAdminDashboard(req: Request, res: Response): Promise<void> {
    try {
      const data = await EnhancedDashboardService.getEnhancedAdminDashboard(req);
      res.status(200).json({
        success: true,
        data,
        message: 'Enhanced admin dashboard retrieved successfully',
      });
    } catch (error) {
      logger.error('Enhanced dashboard controller - admin error:', error);
      throw error;
    }
  }
}

export default EnhancedDashboardController;
