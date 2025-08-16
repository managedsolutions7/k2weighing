import { Request, Response } from 'express';
import MaterialService from '@services/material.service';
import logger from '@utils/logger';

export class MaterialController {
  static async getMaterials(req: Request, res: Response): Promise<void> {
    try {
      const data = await MaterialService.getMaterials(req);
      res.status(200).json({ success: true, data, message: 'Materials retrieved successfully' });
    } catch (error) {
      logger.error('Material controller - getMaterials error:', error);
      throw error;
    }
  }

  static async createMaterial(req: Request, res: Response): Promise<void> {
    try {
      const data = await MaterialService.createMaterial(req);
      res.status(201).json({ success: true, data, message: 'Material created successfully' });
    } catch (error) {
      logger.error('Material controller - createMaterial error:', error);
      throw error;
    }
  }

  static async getMaterialById(req: Request, res: Response): Promise<void> {
    try {
      const data = await MaterialService.getMaterialById(req);
      res.status(200).json({ success: true, data, message: 'Material retrieved successfully' });
    } catch (error) {
      logger.error('Material controller - getMaterialById error:', error);
      throw error;
    }
  }

  static async updateMaterial(req: Request, res: Response): Promise<void> {
    try {
      const data = await MaterialService.updateMaterial(req);
      res.status(200).json({ success: true, data, message: 'Material updated successfully' });
    } catch (error) {
      logger.error('Material controller - updateMaterial error:', error);
      throw error;
    }
  }

  static async deleteMaterial(req: Request, res: Response): Promise<void> {
    try {
      const data = await MaterialService.deleteMaterial(req);
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      logger.error('Material controller - deleteMaterial error:', error);
      throw error;
    }
  }
}

export default MaterialController;
