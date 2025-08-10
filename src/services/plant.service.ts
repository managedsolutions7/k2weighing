import { Request } from 'express';
import Plant from '@models/plant.model';
import { IPlant, CreatePlantRequest, UpdatePlantRequest } from '../types/plant.types';
import CustomError from '@utils/customError';
import logger from '@utils/logger';
import {
  getPlantsCacheKey,
  PLANT_BY_ID_CACHE_TTL,
  PLANT_BY_ID_KEY,
  PLANTS_CACHE_TTL,
} from '@constants/cache.constants';
import { CacheService } from './cache.service';

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
      //  Invalidate cache after creation
      await PlantService.invalidateCache();
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
    const cacheKey = getPlantsCacheKey(req.query);

    const cached = await CacheService.get<IPlant[]>(cacheKey);
    if (cached) {
      logger.info(`Serving plants from cache: ${cacheKey}`);
      return cached;
    }

    const filter: any = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const plants = await Plant.find(filter).sort({ createdAt: -1 });
    await CacheService.set(cacheKey, plants, PLANTS_CACHE_TTL);

    logger.info(`Stored plants in cache: ${cacheKey}`);
    return plants;
  }

  /**
   * Get a single plant by ID
   */
  static async getPlantById(req: Request): Promise<IPlant> {
    const { id } = req.params;
    const cacheKey = PLANT_BY_ID_KEY(id);

    const cached = await CacheService.get<IPlant>(cacheKey);
    if (cached) {
      logger.info(`Serving plant from cache: ${cacheKey}`);
      return cached;
    }

    const plant = await Plant.findById(id);
    if (!plant) {
      throw new CustomError('Plant not found', 404);
    }

    await CacheService.set(cacheKey, plant, PLANT_BY_ID_CACHE_TTL);
    logger.info(`Stored plant in cache: ${cacheKey}`);
    return plant;
  }

  static async invalidateCache(id?: string) {
    await CacheService.del(getPlantsCacheKey({}));
    await CacheService.del(getPlantsCacheKey({ isActive: 'true' }));
    await CacheService.del(getPlantsCacheKey({ isActive: 'false' }));
    if (id) {
      await CacheService.del(PLANT_BY_ID_KEY(id));
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
      await PlantService.invalidateCache(id);

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
      await PlantService.invalidateCache(id);

      logger.info(`Plant deleted: ${id}`);
      return { message: 'Plant deleted successfully' };
    } catch (error) {
      logger.error('Error deleting plant:', error);
      throw error;
    }
  }
}
