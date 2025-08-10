import { Request } from 'express';
import Vehicle from '../models/vehicle.model';
import { IVehicle, CreateVehicleRequest, UpdateVehicleRequest } from '../types/vehicle.types';
import CustomError from '../utils/customError';
import logger from '../utils/logger';
import { CacheService } from './cache.service';
import {
  getVehiclesCacheKey,
  VEHICLE_BY_ID_KEY,
  VEHICLES_CACHE_TTL,
  VEHICLE_BY_ID_CACHE_TTL,
  VEHICLES_ALL_CACHE_KEY,
  VEHICLES_ACTIVE_CACHE_KEY,
  VEHICLES_INACTIVE_CACHE_KEY,
  VEHICLES_BY_TYPE_ALL_KEY,
  VEHICLES_BY_TYPE_ACTIVE_KEY,
  VEHICLES_BY_TYPE_INACTIVE_KEY,
} from '@constants/cache.constants';

export class VehicleService {
  /**
   * Create a new vehicle
   */
  static async createVehicle(req: Request): Promise<IVehicle> {
    try {
      const vehicleData: CreateVehicleRequest = req.body;

      // Check if vehicle number already exists
      const existingVehicle = await Vehicle.findOne({ vehicleNumber: vehicleData.vehicleNumber });
      if (existingVehicle) {
        throw new CustomError('Vehicle number already exists', 400);
      }

      const vehicle = new Vehicle(vehicleData);
      const savedVehicle = await vehicle.save();

      logger.info(`Vehicle created: ${savedVehicle._id}`);
      await VehicleService.invalidateCache(savedVehicle._id.toString(), [savedVehicle.vehicleType]);
      return savedVehicle;
    } catch (error) {
      logger.error('Error creating vehicle:', error);
      throw error;
    }
  }

  /**
   * Get all vehicles with optional filtering
   */
  static async getVehicles(req: Request): Promise<IVehicle[]> {
    try {
      const cacheKey = getVehiclesCacheKey(req.query);
      const vehicles = await CacheService.getOrSet<IVehicle[]>(
        cacheKey,
        VEHICLES_CACHE_TTL,
        async () => {
          const { isActive, vehicleType } = req.query as any;
          const filter: any = {};
          if (isActive !== undefined) {
            filter.isActive = isActive === true || isActive === 'true';
          }
          if (vehicleType) {
            filter.vehicleType = String(vehicleType);
          }
          logger.info(
            `[FETCH EXEC] vehicles DB | key=${cacheKey} filter=${JSON.stringify(filter)}`,
          );
          const data = await Vehicle.find(filter).sort({ createdAt: -1 });
          return data;
        },
      );
      logger.info(`Retrieved ${vehicles.length} vehicles`);
      return vehicles;
    } catch (error) {
      logger.error('Error retrieving vehicles:', error);
      throw error;
    }
  }

  /**
   * Get a single vehicle by ID
   */
  static async getVehicleById(req: Request): Promise<IVehicle> {
    try {
      const { id } = req.params;
      const cacheKey = VEHICLE_BY_ID_KEY(id);
      const vehicle = await CacheService.getOrSet<IVehicle | null>(
        cacheKey,
        VEHICLE_BY_ID_CACHE_TTL,
        async () => {
          const data = await Vehicle.findById(id);
          return data as unknown as IVehicle | null;
        },
      );
      if (!vehicle) {
        throw new CustomError('Vehicle not found', 404);
      }
      logger.info(`Vehicle retrieved: ${id}`);
      return vehicle;
    } catch (error) {
      logger.error('Error retrieving vehicle:', error);
      throw error;
    }
  }

  /**
   * Update a vehicle
   */
  static async updateVehicle(req: Request): Promise<IVehicle> {
    try {
      const { id } = req.params;
      const updateData: UpdateVehicleRequest = req.body;

      // If vehicle number is being updated, check for uniqueness
      if (updateData.vehicleNumber) {
        const existingVehicle = await Vehicle.findOne({
          vehicleNumber: updateData.vehicleNumber,
          _id: { $ne: id },
        });
        if (existingVehicle) {
          throw new CustomError('Vehicle number already exists', 400);
        }
      }

      // Fetch previous state to detect type changes for targeted invalidation
      const prev = await Vehicle.findById(id);
      const vehicle = await Vehicle.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!vehicle) {
        throw new CustomError('Vehicle not found', 404);
      }

      logger.info(`Vehicle updated: ${id}`);
      const affectedTypes = new Set<string>();
      if (prev?.vehicleType) affectedTypes.add(String(prev.vehicleType));
      if (vehicle.vehicleType) affectedTypes.add(String(vehicle.vehicleType));
      await VehicleService.invalidateCache(id, Array.from(affectedTypes));
      return vehicle;
    } catch (error) {
      logger.error('Error updating vehicle:', error);
      throw error;
    }
  }

  /**
   * Delete a vehicle (soft delete by setting isActive to false)
   */
  static async deleteVehicle(req: Request): Promise<{ message: string }> {
    try {
      const { id } = req.params;
      const vehicle = await Vehicle.findByIdAndUpdate(id, { isActive: false }, { new: true });

      if (!vehicle) {
        throw new CustomError('Vehicle not found', 404);
      }

      logger.info(`Vehicle deleted: ${id}`);
      await VehicleService.invalidateCache(
        id,
        vehicle.vehicleType ? [String(vehicle.vehicleType)] : undefined,
      );
      return { message: 'Vehicle deleted successfully' };
    } catch (error) {
      logger.error('Error deleting vehicle:', error);
      throw error;
    }
  }

  static async invalidateCache(id?: string, vehicleTypes?: string[]) {
    // Invalidate list caches
    await CacheService.del(VEHICLES_ALL_CACHE_KEY);
    await CacheService.del(VEHICLES_ACTIVE_CACHE_KEY);
    await CacheService.del(VEHICLES_INACTIVE_CACHE_KEY);
    if (vehicleTypes && vehicleTypes.length > 0) {
      for (const vt of vehicleTypes) {
        const typeKey = String(vt);
        await CacheService.del(VEHICLES_BY_TYPE_ALL_KEY(typeKey));
        await CacheService.del(VEHICLES_BY_TYPE_ACTIVE_KEY(typeKey));
        await CacheService.del(VEHICLES_BY_TYPE_INACTIVE_KEY(typeKey));
      }
    }
    // Invalidate item cache
    if (id) {
      await CacheService.del(VEHICLE_BY_ID_KEY(id));
    }
  }

  // Example bulk delete/update invalidation (if/when bulk ops exist)
  static async invalidateBulk(vehicleIds: string[], vehicleType?: string) {
    await CacheService.invalidateListAndItems(
      VEHICLES_ALL_CACHE_KEY,
      VEHICLE_BY_ID_KEY,
      vehicleIds,
    );
    await CacheService.del(VEHICLES_ACTIVE_CACHE_KEY);
    await CacheService.del(VEHICLES_INACTIVE_CACHE_KEY);
    if (vehicleType) {
      await CacheService.del(VEHICLES_BY_TYPE_ALL_KEY(vehicleType));
      await CacheService.del(VEHICLES_BY_TYPE_ACTIVE_KEY(vehicleType));
      await CacheService.del(VEHICLES_BY_TYPE_INACTIVE_KEY(vehicleType));
    }
  }
}
