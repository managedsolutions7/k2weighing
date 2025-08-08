import { Request } from 'express';
import Plant from '@models/plant.model';
import { IPlant, CreatePlantRequest, UpdatePlantRequest } from '../types/plant.types';
import CustomError from '@utils/customError';
import logger from '@utils/logger';

export class PlantService {
  /**
   * Create a new plant
   */
  static async createPlant(req: Request): Promise<IPlant> {
    try {
      const plantData: CreatePlantRequest = req.body;

      // Check if plant code already exists
      const existingPlant = await Plant.findOne({ code: plantData.code });
      if (existingPlant) {
        throw new CustomError('Plant code already exists', 400);
      }

      const plant = new Plant(plantData);
      const savedPlant = await plant.save();

      logger.info(`Plant created: ${savedPlant._id}`);
      return savedPlant;
    } catch (error) {
      logger.error('Error creating plant:', error);
      throw error;
    }
  }

  /**
   * Get all plants with optional filtering
   */
  static async getPlants(req: Request): Promise<IPlant[]> {
    try {
      const { isActive } = req.query;
      const filter: any = {};

      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      const plants = await Plant.find(filter).sort({ createdAt: -1 });
      logger.info(`Retrieved ${plants.length} plants`);
      return plants;
    } catch (error) {
      logger.error('Error retrieving plants:', error);
      throw error;
    }
  }

  /**
   * Get a single plant by ID
   */
  static async getPlantById(req: Request): Promise<IPlant> {
    try {
      const { id } = req.params;
      const plant = await Plant.findById(id);

      if (!plant) {
        throw new CustomError('Plant not found', 404);
      }

      logger.info(`Plant retrieved: ${id}`);
      return plant;
    } catch (error) {
      logger.error('Error retrieving plant:', error);
      throw error;
    }
  }

  /**
   * Update a plant
   */
  static async updatePlant(req: Request): Promise<IPlant> {
    try {
      const { id } = req.params;
      const updateData: UpdatePlantRequest = req.body;

      // If code is being updated, check for uniqueness
      if (updateData.code) {
        const existingPlant = await Plant.findOne({
          code: updateData.code,
          _id: { $ne: id },
        });
        if (existingPlant) {
          throw new CustomError('Plant code already exists', 400);
        }
      }

      const plant = await Plant.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!plant) {
        throw new CustomError('Plant not found', 404);
      }

      logger.info(`Plant updated: ${id}`);
      return plant;
    } catch (error) {
      logger.error('Error updating plant:', error);
      throw error;
    }
  }

  /**
   * Delete a plant (soft delete by setting isActive to false)
   */
  static async deletePlant(req: Request): Promise<{ message: string }> {
    try {
      const { id } = req.params;
      const plant = await Plant.findByIdAndUpdate(id, { isActive: false }, { new: true });

      if (!plant) {
        throw new CustomError('Plant not found', 404);
      }

      logger.info(`Plant deleted: ${id}`);
      return { message: 'Plant deleted successfully' };
    } catch (error) {
      logger.error('Error deleting plant:', error);
      throw error;
    }
  }
}
