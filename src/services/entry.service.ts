import { Request } from 'express';
import Entry from '../models/entry.model';
import {
  IEntry,
  CreateEntryRequest,
  UpdateEntryRequest,
  EntryFilters,
  EntryWithRelations,
} from '../types/entry.types';
import CustomError from '../utils/customError';
import logger from '../utils/logger';
import { PaginationDefaults } from '../constants';

export class EntryService {
  /**
   * Create a new entry
   */
  static async createEntry(req: Request): Promise<IEntry> {
    try {
      const entryData: CreateEntryRequest = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      // Validate that the vehicle type matches entry type
      const vehicle = await Entry.db.models.Vehicle.findById(entryData.vehicle);
      if (!vehicle) {
        throw new CustomError('Vehicle not found', 404);
      }

      if (entryData.entryType === 'purchase' && vehicle.vehicleType !== 'buy') {
        throw new CustomError('Purchase entries can only use buy vehicles', 400);
      }

      if (entryData.entryType === 'sale' && vehicle.vehicleType !== 'sell') {
        throw new CustomError('Sale entries can only use sell vehicles', 400);
      }

      // Validate vendor exists and is linked to the plant
      const vendor = await Entry.db.models.Vendor.findById(entryData.vendor);
      if (!vendor) {
        throw new CustomError('Vendor not found', 404);
      }

      if (!vendor.linkedPlants.includes(entryData.plant)) {
        throw new CustomError('Vendor is not linked to this plant', 400);
      }

      // Validate plant exists
      const plant = await Entry.db.models.Plant.findById(entryData.plant);
      if (!plant) {
        throw new CustomError('Plant not found', 404);
      }

      // Calculate total amount
      const totalAmount = entryData.quantity * entryData.rate;

      const entry = new Entry({
        ...entryData,
        totalAmount,
        createdBy: userId,
        entryDate: entryData.entryDate ? new Date(entryData.entryDate) : new Date(),
      });

      const savedEntry = await entry.save();

      logger.info(`Entry created: ${savedEntry._id} by user: ${userId}`);
      return savedEntry;
    } catch (error) {
      logger.error('Error creating entry:', error);
      throw error;
    }
  }

  /**
   * Get all entries with filtering and pagination
   */
  static async getEntries(req: Request): Promise<{
    entries: EntryWithRelations[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        entryType,
        vendor,
        plant,
        startDate,
        endDate,
        isActive,
        page = PaginationDefaults.PAGE,
        limit = PaginationDefaults.LIMIT,
      } = req.query;

      const filter: any = {};

      if (entryType) filter.entryType = entryType;
      if (vendor) filter.vendor = vendor;
      if (plant) filter.plant = plant;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const total = await Entry.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      const entries = await Entry.find(filter)
        .populate('vendor', 'name code contactPerson')
        .populate('vehicle', 'vehicleNumber vehicleType driverName')
        .populate('plant', 'name code')
        .populate('createdBy', 'name username')
        .sort({ entryDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      logger.info(`Retrieved ${entries.length} entries out of ${total}`);
      return {
        entries: entries as unknown as EntryWithRelations[],
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      logger.error('Error retrieving entries:', error);
      throw error;
    }
  }

  /**
   * Get a single entry by ID
   */
  static async getEntryById(req: Request): Promise<EntryWithRelations> {
    try {
      const { id } = req.params;
      const entry = await Entry.findById(id)
        .populate('vendor', 'name code contactPerson')
        .populate('vehicle', 'vehicleNumber vehicleType driverName')
        .populate('plant', 'name code')
        .populate('createdBy', 'name username');

      if (!entry) {
        throw new CustomError('Entry not found', 404);
      }

      logger.info(`Entry retrieved: ${id}`);
      return entry as unknown as EntryWithRelations;
    } catch (error) {
      logger.error('Error retrieving entry:', error);
      throw error;
    }
  }

  /**
   * Update an entry
   */
  static async updateEntry(req: Request): Promise<IEntry> {
    try {
      const { id } = req.params;
      const updateData: UpdateEntryRequest = req.body;

      // If vehicle is being updated, validate vehicle type matches entry type
      if (updateData.vehicle) {
        const vehicle = await Entry.db.models.Vehicle.findById(updateData.vehicle);
        if (!vehicle) {
          throw new CustomError('Vehicle not found', 404);
        }

        const entry = await Entry.findById(id);
        if (!entry) {
          throw new CustomError('Entry not found', 404);
        }

        if (entry.entryType === 'purchase' && vehicle.vehicleType !== 'buy') {
          throw new CustomError('Purchase entries can only use buy vehicles', 400);
        }

        if (entry.entryType === 'sale' && vehicle.vehicleType !== 'sell') {
          throw new CustomError('Sale entries can only use sell vehicles', 400);
        }
      }

      // If vendor is being updated, validate vendor is linked to plant
      if (updateData.vendor) {
        const vendor = await Entry.db.models.Vendor.findById(updateData.vendor);
        if (!vendor) {
          throw new CustomError('Vendor not found', 404);
        }

        const entry = await Entry.findById(id);
        if (!entry) {
          throw new CustomError('Entry not found', 404);
        }

        if (!vendor.linkedPlants.includes(entry.plant)) {
          throw new CustomError('Vendor is not linked to this plant', 400);
        }
      }

      // Recalculate total amount if quantity or rate is updated
      if (updateData.quantity || updateData.rate) {
        const entry = await Entry.findById(id);
        if (!entry) {
          throw new CustomError('Entry not found', 404);
        }

        const newQuantity = updateData.quantity || entry.quantity;
        const newRate = updateData.rate || entry.rate;
        updateData.totalAmount = newQuantity * newRate;
      }

      const updatedEntry = await Entry.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedEntry) {
        throw new CustomError('Entry not found', 404);
      }

      logger.info(`Entry updated: ${id}`);
      return updatedEntry;
    } catch (error) {
      logger.error('Error updating entry:', error);
      throw error;
    }
  }

  /**
   * Delete an entry (soft delete)
   */
  static async deleteEntry(req: Request): Promise<{ message: string }> {
    try {
      const { id } = req.params;
      const entry = await Entry.findByIdAndUpdate(id, { isActive: false }, { new: true });

      if (!entry) {
        throw new CustomError('Entry not found', 404);
      }

      logger.info(`Entry deleted: ${id}`);
      return { message: 'Entry deleted successfully' };
    } catch (error) {
      logger.error('Error deleting entry:', error);
      throw error;
    }
  }
}
