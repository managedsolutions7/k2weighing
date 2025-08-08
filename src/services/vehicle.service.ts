import { Request } from 'express';
import Vehicle from '../models/vehicle.model';
import { IVehicle, CreateVehicleRequest, UpdateVehicleRequest } from '../types/vehicle.types';
import CustomError from '../utils/customError';
import logger from '../utils/logger';

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
      const { isActive, vehicleType } = req.query;
      const filter: any = {};

      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      if (vehicleType) {
        filter.vehicleType = vehicleType;
      }

      const vehicles = await Vehicle.find(filter).sort({ createdAt: -1 });
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
      const vehicle = await Vehicle.findById(id);

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

      const vehicle = await Vehicle.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!vehicle) {
        throw new CustomError('Vehicle not found', 404);
      }

      logger.info(`Vehicle updated: ${id}`);
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
      return { message: 'Vehicle deleted successfully' };
    } catch (error) {
      logger.error('Error deleting vehicle:', error);
      throw error;
    }
  }
}
