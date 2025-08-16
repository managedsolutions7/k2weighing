import { Request, Response } from 'express';
import DashboardService from '@services/dashboard.service';
import logger from '@utils/logger';

export class DashboardController {
  static async admin(req: Request, res: Response): Promise<void> {
    try {
      const data = await DashboardService.getAdminDashboard(req);
      res.status(200).json({ success: true, data, message: 'Admin dashboard' });
    } catch (error) {
      logger.error('Dashboard controller - admin error:', error);
      throw error;
    }
  }

  static async supervisor(req: Request, res: Response): Promise<void> {
    try {
      const data = await DashboardService.getSupervisorDashboard(req);
      res.status(200).json({ success: true, data, message: 'Supervisor dashboard' });
    } catch (error) {
      logger.error('Dashboard controller - supervisor error:', error);
      throw error;
    }
  }

  static async operator(req: Request, res: Response): Promise<void> {
    try {
      const data = await DashboardService.getOperatorDashboard(req);
      res.status(200).json({ success: true, data, message: 'Operator dashboard' });
    } catch (error) {
      logger.error('Dashboard controller - operator error:', error);
      throw error;
    }
  }
}

export default DashboardController;
