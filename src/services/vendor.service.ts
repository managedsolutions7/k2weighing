import { Request } from 'express';
import Vendor from '../models/vendor.model';
import { IVendor, CreateVendorRequest, UpdateVendorRequest } from '../types/vendor.types';
import CustomError from '../utils/customError';
import logger from '../utils/logger';
import { CacheService } from './cache.service';
import {
  getVendorsCacheKey,
  VENDORS_CACHE_TTL,
  VENDOR_BY_ID_CACHE_TTL,
  VENDOR_BY_ID_KEY,
  VENDORS_ALL_CACHE_KEY,
  VENDORS_ACTIVE_CACHE_KEY,
  VENDORS_INACTIVE_CACHE_KEY,
  VENDORS_BY_PLANT_ALL_KEY,
  VENDORS_BY_PLANT_ACTIVE_KEY,
  VENDORS_BY_PLANT_INACTIVE_KEY,
} from '@constants/cache.constants';

export class VendorService {
  /**
   * Create a new vendor
   */
  static async createVendor(req: Request): Promise<IVendor> {
    try {
      const vendorData: CreateVendorRequest = req.body;

      // If code provided, ensure uniqueness. Code is optional (vendorNumber will be primary id for search)
      if (vendorData.code) {
        const existingVendor = await Vendor.findOne({ code: vendorData.code });
        if (existingVendor) {
          throw new CustomError('Vendor code already exists', 400);
        }
      }

      // Check if GST number already exists
      const existingGST = await Vendor.findOne({ gstNumber: vendorData.gstNumber });
      if (existingGST) {
        throw new CustomError('GST number already exists', 400);
      }

      const vendor = new Vendor(vendorData);
      const savedVendor = await vendor.save();

      logger.info(`Vendor created: ${savedVendor._id}`);
      const plantIds = (savedVendor.linkedPlants || []).map((p: any) => String(p));
      await VendorService.invalidateCache(savedVendor._id.toString(), plantIds);
      return savedVendor;
    } catch (error) {
      logger.error('Error creating vendor:', error);
      throw error;
    }
  }

  /**
   * Get all vendors with optional filtering
   */
  static async getVendors(req: Request): Promise<IVendor[]> {
    try {
      const cacheKey = getVendorsCacheKey(req.query);
      const vendors = await CacheService.getOrSet<IVendor[]>(
        cacheKey,
        VENDORS_CACHE_TTL,
        async () => {
          const { isActive, plantId, q, limit } = req.query as any;
          const filter: any = {};
          if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
          }
          if (plantId) {
            filter.linkedPlants = plantId;
          }
          if (q) {
            const regex = new RegExp(String(q).trim(), 'i');
            filter.$or = [{ name: regex }, { code: regex }, { vendorNumber: regex }];
          }
          const data = await Vendor.find(filter)
            .populate('linkedPlants', 'name code')
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit) || 25, 50));
          return data;
        },
      );
      logger.info(`Retrieved ${vendors.length} vendors`);
      return vendors;
    } catch (error) {
      logger.error('Error retrieving vendors:', error);
      throw error;
    }
  }

  /**
   * Get a single vendor by ID
   */
  static async getVendorById(req: Request): Promise<IVendor> {
    try {
      const { id } = req.params;
      const cacheKey = VENDOR_BY_ID_KEY(id);
      const vendor = await CacheService.getOrSet<IVendor | null>(
        cacheKey,
        VENDOR_BY_ID_CACHE_TTL,
        async () => {
          const data = await Vendor.findById(id).populate('linkedPlants', 'name code');
          return data as unknown as IVendor | null;
        },
      );
      if (!vendor) {
        throw new CustomError('Vendor not found', 404);
      }
      logger.info(`Vendor retrieved: ${id}`);
      return vendor;
    } catch (error) {
      logger.error('Error retrieving vendor:', error);
      throw error;
    }
  }

  /**
   * Update a vendor
   */
  static async updateVendor(req: Request): Promise<IVendor> {
    try {
      const { id } = req.params;
      const updateData: UpdateVendorRequest = req.body;

      // If code is being updated, check for uniqueness
      if (updateData.code) {
        const existingVendor = await Vendor.findOne({
          code: updateData.code,
          _id: { $ne: id },
        });
        if (existingVendor) {
          throw new CustomError('Vendor code already exists', 400);
        }
      }

      // If GST number is being updated, check for uniqueness
      if (updateData.gstNumber) {
        const existingGST = await Vendor.findOne({
          gstNumber: updateData.gstNumber,
          _id: { $ne: id },
        });
        if (existingGST) {
          throw new CustomError('GST number already exists', 400);
        }
      }

      const prev = await Vendor.findById(id).lean();
      const vendor = await Vendor.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate('linkedPlants', 'name code');

      if (!vendor) {
        throw new CustomError('Vendor not found', 404);
      }

      logger.info(`Vendor updated: ${id}`);
      const prevPlantIds = new Set<string>((prev?.linkedPlants || []).map((p: any) => String(p)));
      const nextPlantIds = new Set<string>(
        (vendor.linkedPlants || []).map((p: any) => String(p._id ?? p)),
      );
      const affected = new Set<string>([...prevPlantIds, ...nextPlantIds]);
      await VendorService.invalidateCache(id, Array.from(affected));
      return vendor;
    } catch (error) {
      logger.error('Error updating vendor:', error);
      throw error;
    }
  }

  /**
   * Delete a vendor (soft delete by setting isActive to false)
   */
  static async deleteVendor(req: Request): Promise<{ message: string }> {
    try {
      const { id } = req.params;
      const vendor = await Vendor.findByIdAndUpdate(id, { isActive: false }, { new: true });

      if (!vendor) {
        throw new CustomError('Vendor not found', 404);
      }

      logger.info(`Vendor deleted: ${id}`);
      const plantIds = (vendor.linkedPlants || []).map((p: any) => String(p));
      await VendorService.invalidateCache(id, plantIds);
      return { message: 'Vendor deleted successfully' };
    } catch (error) {
      logger.error('Error deleting vendor:', error);
      throw error;
    }
  }

  static async invalidateCache(id?: string, plantIds?: string[]) {
    // Invalidate list caches
    await CacheService.del(VENDORS_ALL_CACHE_KEY);
    await CacheService.del(VENDORS_ACTIVE_CACHE_KEY);
    await CacheService.del(VENDORS_INACTIVE_CACHE_KEY);
    if (plantIds && plantIds.length > 0) {
      for (const plantId of plantIds) {
        const pid = String(plantId);
        await CacheService.del(VENDORS_BY_PLANT_ALL_KEY(pid));
        await CacheService.del(VENDORS_BY_PLANT_ACTIVE_KEY(pid));
        await CacheService.del(VENDORS_BY_PLANT_INACTIVE_KEY(pid));
      }
    }
    // Invalidate item cache
    if (id) {
      await CacheService.del(VENDOR_BY_ID_KEY(id));
    }
  }

  // Example bulk update invalidation (if/when bulk ops exist)
  static async invalidateBulk(vendorIds: string[], plantIds?: string[]) {
    await CacheService.invalidateListAndItems(VENDORS_ALL_CACHE_KEY, VENDOR_BY_ID_KEY, vendorIds);
    await CacheService.del(VENDORS_ACTIVE_CACHE_KEY);
    await CacheService.del(VENDORS_INACTIVE_CACHE_KEY);
    if (plantIds && plantIds.length > 0) {
      for (const pid of plantIds) {
        await CacheService.del(VENDORS_BY_PLANT_ALL_KEY(pid));
        await CacheService.del(VENDORS_BY_PLANT_ACTIVE_KEY(pid));
        await CacheService.del(VENDORS_BY_PLANT_INACTIVE_KEY(pid));
      }
    }
  }
}
