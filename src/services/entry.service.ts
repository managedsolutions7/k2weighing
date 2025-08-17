import { Request } from 'express';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import Entry from '../models/entry.model';
import {
  IEntry,
  CreateEntryRequest,
  UpdateEntryRequest,
  EntryWithRelations,
} from '../types/entry.types';
import CustomError from '../utils/customError';
import logger from '../utils/logger';
import { PaginationDefaults } from '../constants';
import { CacheService } from './cache.service';
import {
  ENTRIES_CACHE_TTL,
  ENTRIES_LIST_KEY,
  ENTRY_BY_ID_CACHE_TTL,
  ENTRY_BY_ID_KEY,
  serializeFilters,
} from '@constants/cache.constants';
import Vehicle from '@models/vehicle.model';
import { VARIANCE_TOLERANCE } from '@constants/variance.constants';

export class EntryService {
  /**
   * Create a new entry
   */
  static async createEntry(req: Request): Promise<IEntry> {
    try {
      const entryData: CreateEntryRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role as string | undefined;
      const userPlantId = (req as any).user?.plantId as string | undefined;

      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      // Vehicle must exist; allow any vehicleType for both flows (restriction removed)
      const vehicle = await Entry.db.models.Vehicle.findById(entryData.vehicle);
      if (!vehicle) {
        throw new CustomError('Vehicle not found', 404);
      }

      // Determine plant: from operator profile if not provided
      const effectivePlantId = entryData.plant || userPlantId;
      if (!effectivePlantId) {
        throw new CustomError('Plant not available for user', 400);
      }

      // Validate vendor exists and is linked to the plant
      const vendor = await Entry.db.models.Vendor.findById(entryData.vendor);
      if (!vendor) {
        throw new CustomError('Vendor not found', 404);
      }

      if (!vendor.linkedPlants.includes(effectivePlantId as any)) {
        throw new CustomError('Vendor is not linked to this plant', 400);
      }

      // Validate plant exists
      const plant = await Entry.db.models.Plant.findById(effectivePlantId);
      if (!plant) {
        throw new CustomError('Plant not found', 404);
      }

      // New logic by entryType
      if (entryData.entryType === 'sale') {
        // At creation, pallette details are optional. If provided as 'packed', ensure consistency
        if (entryData.palletteType === 'packed') {
          if (
            typeof entryData.noOfBags !== 'number' ||
            typeof entryData.weightPerBag !== 'number'
          ) {
            throw new CustomError('noOfBags and weightPerBag are required for packed sale', 400);
          }
        }
      }

      if (entryData.entryType === 'purchase') {
        if (!entryData.materialType) {
          throw new CustomError('materialType is required for purchase entry', 400);
        }
      }

      // Calculate expected values if tareWeight available
      let expectedWeight: number | null = null;
      const exactWeight: number | null = null;
      let varianceFlag: boolean | null = null;

      const vehForWeight = await Vehicle.findById(entryData.vehicle);
      if (!vehForWeight) {
        throw new CustomError('Vehicle not found', 404);
      }

      if (vehForWeight.tareWeight !== undefined && vehForWeight.tareWeight !== null) {
        // Expected calculation differs per flow
        if (entryData.entryType === 'purchase') {
          // For purchase, expected = loaded (entry) - tare
          expectedWeight = entryData.entryWeight - vehForWeight.tareWeight;
          // Strict validation: for purchase, entry weight must be >= tare
          if (entryData.entryWeight < vehForWeight.tareWeight) {
            throw new CustomError(
              'Invalid weights: for purchase, entryWeight must be greater than or equal to vehicle tareWeight',
              400,
            );
          }
        } else {
          // For sale, expected depends on exitWeight which we do not have yet at creation
          expectedWeight = null;
        }
        varianceFlag = null;
      }

      // quantity always start at 0; will be computed on exit
      const initialQuantity = 0;
      const totalAmount = 0; // rate is invoice-level now

      const entry = new Entry({
        ...entryData,
        plant: effectivePlantId,
        quantity: initialQuantity,
        totalAmount,
        createdBy: userId,
        entryDate: entryData.entryDate ? new Date(entryData.entryDate) : new Date(),
        expectedWeight,
        exactWeight,
        varianceFlag,
        manualWeight: Boolean(entryData.manualWeight),
        driverName: entryData.driverName,
        driverPhone: entryData.driverPhone,
        // Additional handling for sale packed weight will be handled in model pre-save
      });

      // Ensure exitWeight is null initially and quantity is 0 per new rules
      (entry as any).exitWeight = null;

      const savedEntry = await entry.save();
      // Invalidate dependent caches
      await (EntryService as unknown as IEntryServiceWithInvalidation).invalidateCachesOnMutation(
        savedEntry._id.toString(),
      );
      logger.info(`Entry created: ${savedEntry._id} by user: ${userId}`);
      return savedEntry;
    } catch (error) {
      logger.error('Error creating entry:', error);
      throw error;
    }
  }

  static async updateExitWeight(req: Request): Promise<IEntry> {
    const { id } = req.params;
    const { exitWeight, palletteType, noOfBags, weightPerBag, moisture, dust } = req.body as {
      exitWeight: number;
      palletteType?: 'loose' | 'packed';
      noOfBags?: number;
      weightPerBag?: number;
      moisture?: number;
      dust?: number;
    };
    const entry = await Entry.findById(id);
    if (!entry) throw new CustomError('Entry not found', 404);

    // Enforce single exit weight update
    if (entry.exitWeight != null) {
      throw new CustomError('Exit weight already recorded', 409);
    }

    const vehicle = await Vehicle.findById(entry.vehicle);
    if (!vehicle) throw new CustomError('Vehicle not found', 404);

    if (vehicle.tareWeight === undefined || vehicle.tareWeight === null) {
      vehicle.tareWeight = exitWeight;
      await vehicle.save();
    }

    // If sale, allow finalizing pallette info at exit
    if (entry.entryType === 'sale') {
      if (palletteType) (entry as any).palletteType = palletteType;
      if (palletteType === 'packed') {
        if (typeof noOfBags !== 'number' || typeof weightPerBag !== 'number') {
          throw new CustomError(
            'noOfBags and weightPerBag are required for packed sale at exit',
            400,
          );
        }
        (entry as any).noOfBags = noOfBags;
        (entry as any).weightPerBag = weightPerBag;
        (entry as any).packedWeight = noOfBags * weightPerBag;
      } else if (palletteType === 'loose') {
        (entry as any).noOfBags = undefined;
        (entry as any).weightPerBag = undefined;
        (entry as any).packedWeight = undefined;
      }
    }

    // Flow-specific expectedWeight
    let expectedWeight: number | null = null;
    if (vehicle.tareWeight != null) {
      if (entry.entryType === 'sale') {
        // expected = exit - tare (unladen at entry, loaded at exit)
        expectedWeight = exitWeight - vehicle.tareWeight;
      } else if (entry.entryType === 'purchase') {
        // expected = entry - tare (loaded at entry)
        expectedWeight = entry.entryWeight ? entry.entryWeight - vehicle.tareWeight : null;
      }
    }
    // Flow-specific exact weight
    let exactWeight: number | null = null;
    if (entry.entryWeight != null) {
      if (entry.entryType === 'sale') {
        // Vehicle was unladen at entry and loaded at exit
        exactWeight = exitWeight - entry.entryWeight;
      } else if (entry.entryType === 'purchase') {
        // Vehicle was loaded at entry and unladen at exit
        exactWeight = entry.entryWeight - exitWeight;
      }
    }

    // Validate relationships to prevent negative quantities
    if (exactWeight != null && exactWeight < 0) {
      if (entry.entryType === 'sale') {
        throw new CustomError(
          'Invalid weights: for sale, exitWeight must be greater than or equal to entryWeight',
          400,
        );
      } else {
        throw new CustomError(
          'Invalid weights: for purchase, entryWeight must be greater than or equal to exitWeight',
          400,
        );
      }
    }

    let varianceFlag: boolean | null = null;
    if (expectedWeight != null && exactWeight != null) {
      varianceFlag = Math.abs(exactWeight - expectedWeight) > VARIANCE_TOLERANCE;
    }

    if (exactWeight != null) {
      // Apply moisture/dust only for purchase entries
      if (entry.entryType === 'purchase') {
        const mPct =
          typeof moisture === 'number' ? Math.max(0, Math.min(100, moisture)) : undefined;
        const dPct = typeof dust === 'number' ? Math.max(0, Math.min(100, dust)) : undefined;
        if (mPct !== undefined) (entry as any).moisture = mPct;
        if (dPct !== undefined) (entry as any).dust = dPct;
        const dustWeight = dPct !== undefined ? (exactWeight * dPct) / 100 : 0;
        const moistureWeight = mPct !== undefined ? (exactWeight * mPct) / 100 : 0;
        if (dPct !== undefined) (entry as any).dustWeight = dustWeight;
        if (mPct !== undefined) (entry as any).moistureWeight = moistureWeight;
        if (mPct !== undefined || dPct !== undefined) {
          (entry as any).finalWeight = Math.max(0, exactWeight - (dustWeight + moistureWeight));
        }
      }
      entry.quantity = exactWeight;
      const rate = typeof (entry as any).rate === 'number' ? (entry as any).rate : 0;
      entry.totalAmount = Number(entry.quantity) * rate;
    }

    entry.exitWeight = exitWeight;
    entry.expectedWeight = expectedWeight;
    entry.exactWeight = exactWeight;
    entry.varianceFlag = varianceFlag;

    const updated = await entry.save();

    // Recalculate invoices that include this entry before invalidating caches
    await EntryService.recalculateInvoicesForEntry(updated._id);

    await (EntryService as unknown as IEntryServiceWithInvalidation).invalidateCachesOnMutation(id);
    logger.info(`Exit weight updated for entry: ${id}`);
    return updated as any;
  }

  /**
   * Review flow: set isReviewed and metadata
   */
  static async reviewEntry(req: Request): Promise<IEntry> {
    const { id } = req.params;
    const { isReviewed, reviewNotes } = req.body as {
      isReviewed: boolean;
      reviewNotes?: string | null;
    };
    const reviewerId = (req as any).user?.id;
    if (!reviewerId) throw new CustomError('User not authenticated', 401);

    const entry = await Entry.findById(id);
    if (!entry) throw new CustomError('Entry not found', 404);
    if (entry.flagged) {
      throw new CustomError('Cannot review a flagged entry', 400);
    }
    entry.isReviewed = Boolean(isReviewed);
    if (entry.isReviewed) {
      (entry as any).reviewedBy = reviewerId as any;
      (entry as any).reviewedAt = new Date();
    } else {
      (entry as any).reviewedBy = null as any;
      (entry as any).reviewedAt = null as any;
    }
    (entry as any).reviewNotes = reviewNotes ?? null;
    (entry as any).updatedBy = reviewerId as any;
    const updated = await entry.save();
    await (EntryService as unknown as IEntryServiceWithInvalidation).invalidateCachesOnMutation(id);
    return updated as any;
  }

  /**
   * Flag/unflag entries with optional reason
   */
  static async flagEntry(req: Request): Promise<IEntry> {
    const { id } = req.params;
    const { flagged, flagReason } = req.body as { flagged: boolean; flagReason?: string | null };
    const entry = await Entry.findById(id);
    if (!entry) throw new CustomError('Entry not found', 404);
    entry.flagged = Boolean(flagged);
    entry.flagReason = entry.flagged ? (flagReason ?? null) : null;
    (entry as any).updatedBy = (req as any).user?.id;
    const updated = await entry.save();
    await (EntryService as unknown as IEntryServiceWithInvalidation).invalidateCachesOnMutation(id);
    return updated as any;
  }

  // Recalculate invoice totals for invoices containing this entry
  private static async recalculateInvoicesForEntry(
    entryId: mongoose.Types.ObjectId,
  ): Promise<void> {
    const InvoiceModel = Entry.db.models.Invoice as mongoose.Model<any>;
    const invoices: Array<{ _id: mongoose.Types.ObjectId; entries: mongoose.Types.ObjectId[] }> =
      await InvoiceModel.find({ entries: entryId, isActive: true }).select('_id entries');

    for (const invoice of invoices) {
      const allEntries = await Entry.find({ _id: { $in: invoice.entries }, isActive: true }).select(
        'quantity totalAmount',
      );
      const totalQuantity = allEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
      const totalAmount = allEntries.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
      await InvoiceModel.findByIdAndUpdate(invoice._id, { totalQuantity, totalAmount });
      logger.info(
        `Invoice ${invoice._id.toString()} recalculated after entry ${entryId.toString()} update`,
      );
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
        flagged,
        isReviewed,
        page = PaginationDefaults.PAGE,
        limit = PaginationDefaults.LIMIT,
      } = req.query;

      const filter: any = {};

      if (entryType) filter.entryType = entryType;
      if (vendor) filter.vendor = vendor;
      if (plant) filter.plant = plant;
      if (req.query && (req.query as any).q) {
        const q = String((req.query as any).q).trim();
        if (q) {
          filter.$or = [{ entryNumber: new RegExp(q, 'i') }];
        }
      }
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (flagged !== undefined) filter.flagged = flagged === 'true';
      if (isReviewed !== undefined) filter.isReviewed = isReviewed === 'true';

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      // Role-aware scoping
      const requester = (req as any).user as
        | { id: string; role: string; plantId?: string }
        | undefined;
      if (requester) {
        const TWENTYFOUR_HRS = 24 * 60 * 60 * 1000;
        const now = new Date();

        // Operators: last 24h restriction and createdBy self, force plant scope
        if (requester.role === 'operator') {
          // Force plant scope from JWT, ignore query plantId
          if (requester.plantId) {
            filter.plant = requester.plantId;
          }

          // Handle date range with 24h window restriction
          let from: Date, to: Date;
          if (startDate && endDate) {
            from = new Date(startDate as string);
            to = new Date(endDate as string);
            // Clamp to 24h window if wider
            if (to.getTime() - from.getTime() > TWENTYFOUR_HRS) {
              from = new Date(to.getTime() - TWENTYFOUR_HRS);
            }
          } else {
            // Default to last 24h
            to = now;
            from = new Date(to.getTime() - TWENTYFOUR_HRS);
          }

          filter.createdBy = requester.id;
          filter.entryDate = { $gte: from, $lte: to };
        }
        // Supervisors: force plant scope from JWT, ignore query plantId
        else if (requester.role === 'supervisor') {
          if (requester.plantId) {
            filter.plant = requester.plantId;
          }
        }
        // Admin: no extra restrictions, can use query plantId
      }

      const skip = (Number(page) - 1) * Number(limit);
      const total = await Entry.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      const filterString = serializeFilters({
        entryType,
        vendor,
        plant,
        startDate,
        endDate,
        isActive,
        flagged,
        isReviewed,
        page,
        limit,
      });
      const cacheKey = ENTRIES_LIST_KEY(filterString);
      const entries = await CacheService.getOrSet<any[]>(cacheKey, ENTRIES_CACHE_TTL, async () => {
        const data = await Entry.find(filter)
          .populate('vendor', 'name code contactPerson')
          .populate('vehicle', 'vehicleNumber vehicleType driverName')
          .populate('plant', 'name code')
          .populate('materialType', 'name')
          .populate('createdBy', 'name username')
          .sort({ entryDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(Number(limit));
        return data as any[];
      });

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
      const cacheKey = ENTRY_BY_ID_KEY(id);
      const entry = await CacheService.getOrSet<any | null>(
        cacheKey,
        ENTRY_BY_ID_CACHE_TTL,
        async () => {
          const data = await Entry.findById(id)
            .populate('vendor', 'name code contactPerson')
            .populate('vehicle', 'vehicleNumber vehicleType driverName')
            .populate('plant', 'name code')
            .populate('materialType', 'name')
            .populate('createdBy', 'name username');
          return (data as any) || null;
        },
      );

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

      // Vehicle can be updated to any type; only ensure it exists
      if (updateData.vehicle) {
        const vehicle = await Entry.db.models.Vehicle.findById(updateData.vehicle);
        if (!vehicle) {
          throw new CustomError('Vehicle not found', 404);
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

      // Load current entry
      const entry = await Entry.findById(id);
      if (!entry) throw new CustomError('Entry not found', 404);

      // Reviewed entries cannot be updated
      if (entry.isReviewed) {
        throw new CustomError('Reviewed entry cannot be updated', 403);
      }

      // Variance rule: if variance not raised, only allow explicit clearing (varianceFlag === false)
      const wantsClearVariance =
        Object.prototype.hasOwnProperty.call(updateData, 'varianceFlag') &&
        (updateData as any).varianceFlag === false;
      if (entry.varianceFlag !== true && !wantsClearVariance) {
        throw new CustomError('Update not allowed: variance not raised', 403);
      }

      // Moisture/dust only for purchase
      const hasMoistureOrDust =
        Object.prototype.hasOwnProperty.call(updateData, 'moisture') ||
        Object.prototype.hasOwnProperty.call(updateData, 'dust');
      if (hasMoistureOrDust && entry.entryType !== 'purchase') {
        throw new CustomError('moisture/dust can only be set for purchase entries', 400);
      }

      // Validate weights if both provided or combined with existing
      const nextEntryWeight = (
        Object.prototype.hasOwnProperty.call(updateData, 'entryWeight')
          ? (updateData as any).entryWeight
          : entry.entryWeight
      ) as number | null | undefined;
      const nextExitWeight = (
        Object.prototype.hasOwnProperty.call(updateData, 'exitWeight')
          ? (updateData as any).exitWeight
          : entry.exitWeight
      ) as number | null | undefined;
      if (nextEntryWeight != null && nextExitWeight != null) {
        if (entry.entryType === 'sale' && nextExitWeight < nextEntryWeight) {
          throw new CustomError(
            'Invalid weights: for sale, exitWeight must be greater than or equal to entryWeight',
            400,
          );
        }
        if (entry.entryType === 'purchase' && nextEntryWeight < nextExitWeight) {
          throw new CustomError(
            'Invalid weights: for purchase, entryWeight must be greater than or equal to exitWeight',
            400,
          );
        }
      }

      // Assign only provided fields (diff-only)
      const allowedKeys: Array<keyof UpdateEntryRequest> = [
        'entryType',
        'vendor',
        'vehicle',
        'plant',
        'quantity',
        'rate',
        'entryDate',
        'isActive',
        'isReviewed',
        'reviewedBy',
        'reviewedAt',
        'reviewNotes',
        'flagged',
        'flagReason',
        'driverName',
        'driverPhone',
        'moisture',
        'dust',
        'exitWeight',
        'entryWeight',
        'varianceFlag',
      ];
      const updates: any = {};
      for (const k of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(updateData, k))
          (updates as any)[k] = (updateData as any)[k];
      }

      // Recompute totals and purchase deductions if applicable
      const effectiveExit = updates.exitWeight ?? entry.exitWeight;
      const effectiveEntry = updates.entryWeight ?? entry.entryWeight;
      let recomputedExact: number | null = entry.exactWeight ?? null;
      if (effectiveExit != null && effectiveEntry != null) {
        recomputedExact =
          entry.entryType === 'sale'
            ? effectiveExit - effectiveEntry
            : effectiveEntry - effectiveExit;
        if (recomputedExact < 0) recomputedExact = 0;
        updates.exactWeight = recomputedExact;
        updates.quantity = recomputedExact;
      }

      if (entry.entryType === 'purchase' && recomputedExact != null) {
        const mPct = updates.moisture ?? entry.moisture;
        const dPct = updates.dust ?? entry.dust;
        if (typeof mPct === 'number')
          updates.moistureWeight = (recomputedExact * Math.max(0, Math.min(100, mPct))) / 100;
        if (typeof dPct === 'number')
          updates.dustWeight = (recomputedExact * Math.max(0, Math.min(100, dPct))) / 100;
        if (typeof mPct === 'number' || typeof dPct === 'number') {
          const dw = updates.dustWeight ?? entry.dustWeight ?? 0;
          const mw = updates.moistureWeight ?? entry.moistureWeight ?? 0;
          updates.finalWeight = Math.max(0, recomputedExact - (dw + mw));
        }
      }

      // totalAmount if quantity or rate updated/available
      const nextQty = updates.quantity ?? entry.quantity;
      const nextRate = updates.rate ?? entry.rate ?? 0;
      updates.totalAmount = Number(nextQty) * Number(nextRate);

      (updates as any).updatedBy = (req as any).user?.id;

      const updatedEntry = await Entry.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      });

      if (!updatedEntry) throw new CustomError('Entry not found', 404);

      logger.info(`Entry updated: ${id}`);
      await (EntryService as unknown as IEntryServiceWithInvalidation).invalidateCachesOnMutation(
        id,
      );
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
      await (EntryService as unknown as IEntryServiceWithInvalidation).invalidateCachesOnMutation(
        id,
      );
      return { message: 'Entry deleted successfully' };
    } catch (error) {
      logger.error('Error deleting entry:', error);
      throw error;
    }
  }

  /**
   * Generate receipt PDF for an entry and return as buffer
   */
  static async generateReceiptPdf(req: Request): Promise<{ filename: string; buffer: Buffer }> {
    const { id } = req.params;
    const requester = (req as any).user as { role?: string; plantId?: string } | undefined;

    const entry = await Entry.findById(id)
      .populate('vendor', 'name code')
      .populate('vehicle', 'vehicleNumber vehicleType')
      .populate('plant', 'name code')
      .lean();

    if (!entry) {
      throw new CustomError('Entry not found', 404);
    }

    // Enforce plant scope for operator/supervisor
    if (requester && (requester.role === 'operator' || requester.role === 'supervisor')) {
      if (
        requester.plantId &&
        String(entry.plant?._id || entry.plant) !== String(requester.plantId)
      ) {
        throw new CustomError('Forbidden: entry not in your plant', 403);
      }
    }

    if (entry.varianceFlag === true) {
      throw new CustomError('Receipt not available due to variance failure', 403);
    }

    // Build PDF in-memory
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    const filename = `${entry.entryNumber}-receipt.pdf`;

    return await new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => {
        resolve({ filename, buffer: Buffer.concat(chunks) });
      });
      doc.on('error', reject);

      // Content
      doc.fontSize(22).text('RECEIPT', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Entry Number: ${entry.entryNumber}`);
      doc.text(`Entry Type: ${entry.entryType}`);
      doc.text(`Date: ${new Date(entry.entryDate).toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(14).text('VENDOR', { underline: true });
      doc.fontSize(10);
      if (entry.vendor && typeof entry.vendor === 'object') {
        // @ts-expect-error - vendor is an object
        doc.text(`Name: ${entry.vendor.name}`);
        // @ts-expect-error - vendor is an object
        doc.text(`Code: ${entry.vendor.code}`);
      }
      doc.moveDown();

      doc.fontSize(14).text('PLANT', { underline: true });
      doc.fontSize(10);
      if (entry.plant && typeof entry.plant === 'object') {
        // @ts-expect-error - plant is an object
        doc.text(`Name: ${entry.plant.name}`);
        // @ts-expect-error - plant is an object
        doc.text(`Code: ${entry.plant.code}`);
      }
      doc.moveDown();

      doc.fontSize(14).text('VEHICLE', { underline: true });
      doc.fontSize(10);
      if (entry.vehicle && typeof entry.vehicle === 'object') {
        // @ts-expect-error - vehicle is an object
        doc.text(`Vehicle Number: ${entry.vehicle.vehicleNumber}`);
        // @ts-expect-error - vehicle is an object
        doc.text(`Vehicle Type: ${entry.vehicle.vehicleType}`);
      }
      doc.text(`Driver Name: ${entry.driverName || '-'}`);
      doc.text(`Driver Phone: ${entry.driverPhone || '-'}`);
      doc.moveDown();

      doc.fontSize(14).text('WEIGHTS', { underline: true });
      doc.fontSize(10);
      doc.text(`Entry Weight: ${entry.entryWeight ?? '-'}`);
      doc.text(`Exit Weight: ${entry.exitWeight ?? '-'}`);
      doc.text(`Expected Weight: ${entry.expectedWeight ?? '-'}`);
      doc.text(`Exact Weight: ${entry.exactWeight ?? '-'}`);
      // Quality
      if (entry.entryType === 'purchase') {
        doc.moveDown();
        doc.fontSize(14).text('QUALITY (PURCHASE)', { underline: true });
        doc.fontSize(10);
        doc.text(`Moisture (%): ${entry.moisture ?? '-'}`);
        doc.text(`Dust (%): ${entry.dust ?? '-'}`);
        doc.text(`Moisture Weight: ${entry.moistureWeight ?? '-'}`);
        doc.text(`Dust Weight: ${entry.dustWeight ?? '-'}`);
        doc.text(`Final Weight: ${entry.finalWeight ?? '-'}`);
      }
      doc.moveDown(2);

      doc.fontSize(10).text('Generated by Biofuel Management System', { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();
    });
  }
}

// Helper invalidation for entries and reports dependent on entries
// Using ES module style only; removed namespace per lint suggestion

export type IEntryServiceWithInvalidation = typeof EntryService & {
  invalidateCachesOnMutation: (id: string) => Promise<void>;
};

const entryServiceWithInvalidation: IEntryServiceWithInvalidation = Object.assign(EntryService, {
  async invalidateCachesOnMutation(id: string): Promise<void> {
    // Include version prefix in patterns
    await CacheService.delByPattern('v1:entries:list:*');
    await CacheService.del(ENTRY_BY_ID_KEY(id));
    await CacheService.delByPattern('v1:reports:*');
    await CacheService.delByPattern('v1:dashboard:*');
  },
});

export const EntryServiceWithInvalidation = entryServiceWithInvalidation;
