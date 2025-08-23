import { Request } from 'express';
import Entry from '../models/entry.model';
import { SummaryReport, DetailedReport, VendorReport, PlantReport } from '../types/report.types';
import logger from '../utils/logger';
import { PaginationDefaults } from '../constants';
import { CacheService } from './cache.service';
import {
  REPORTS_CACHE_TTL,
  REPORT_SUMMARY_KEY,
  REPORT_VENDOR_KEY,
  REPORT_PLANT_KEY,
  serializeFilters,
} from '../constants/cache.constants';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export class EnhancedReportService {
  /**
   * Helper function to compute the most accurate weight for an entry
   */
  private static computeWeight(entry: any): number {
    // Priority order: exactWeight > finalWeight > exitWeight > entryWeight > quantity
    if (entry.exactWeight && entry.exactWeight > 0) return entry.exactWeight;
    if (entry.finalWeight && entry.finalWeight > 0) return entry.finalWeight;
    if (entry.exitWeight && entry.exitWeight > 0) return entry.exitWeight;
    if (entry.entryWeight && entry.entryWeight > 0) return entry.entryWeight;
    if (entry.quantity && entry.quantity > 0) return entry.quantity;
    if (entry.expectedWeight && entry.expectedWeight > 0) return entry.expectedWeight;
    return 0;
  }

  /**
   * Helper function to compute the most accurate amount for an entry
   */
  private static computeAmount(entry: any): number {
    const weight = this.computeWeight(entry);
    if (entry.rate && entry.rate > 0) {
      return weight * entry.rate;
    }
    return entry.totalAmount || 0;
  }

  /**
   * Enhanced Summary Report with comprehensive metrics
   */
  static async generateEnhancedSummaryReport(req: Request): Promise<SummaryReport> {
    try {
      const { entryType, vendor, plant, startDate, endDate } = req.query;

      const entryFilter: any = { isActive: true };
      if (entryType) entryFilter.entryType = entryType;
      if (vendor) entryFilter.vendor = vendor;
      if (plant) entryFilter.plant = plant;

      // Enforce supervisor plant scoping
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        entryFilter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        entryFilter.entryDate = {};
        if (startDate) entryFilter.entryDate.$gte = new Date(startDate as string);
        if (endDate) entryFilter.entryDate.$lte = new Date(endDate as string);
      }

      // Enhanced Entry-based KPIs with comprehensive metrics
      const entryPipeline: any[] = [
        { $match: entryFilter },
        {
          $lookup: {
            from: 'materials',
            localField: 'materialType',
            foreignField: '_id',
            as: 'materialType',
          },
        },
        { $unwind: { path: '$materialType', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            computedWeight: {
              $let: {
                vars: {
                  exactWeight: { $ifNull: ['$exactWeight', 0] },
                  finalWeight: { $ifNull: ['$finalWeight', 0] },
                  exitWeight: { $ifNull: ['$exitWeight', 0] },
                  entryWeight: { $ifNull: ['$entryWeight', 0] },
                  quantity: { $ifNull: ['$quantity', 0] },
                  expectedWeight: { $ifNull: ['$expectedWeight', 0] },
                },
                in: {
                  $cond: [
                    { $gt: ['$$exactWeight', 0] },
                    '$$exactWeight',
                    {
                      $cond: [
                        { $gt: ['$$finalWeight', 0] },
                        '$$finalWeight',
                        {
                          $cond: [
                            { $gt: ['$$exitWeight', 0] },
                            '$$exitWeight',
                            {
                              $cond: [
                                { $gt: ['$$entryWeight', 0] },
                                '$$entryWeight',
                                {
                                  $cond: [
                                    { $gt: ['$$quantity', 0] },
                                    '$$quantity',
                                    '$$expectedWeight',
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            computedAmount: {
              $cond: [
                { $and: [{ $gt: ['$rate', 0] }, { $gt: ['$computedWeight', 0] }] },
                { $multiply: ['$rate', '$computedWeight'] },
                { $ifNull: ['$totalAmount', 0] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$computedWeight' },
            totalAmount: { $sum: '$computedAmount' },
            purchaseEntries: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] },
            },
            purchaseQuantity: {
              $sum: {
                $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedWeight', 0],
              },
            },
            purchaseAmount: {
              $sum: {
                $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedAmount', 0],
              },
            },
            saleEntries: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] },
            },
            saleQuantity: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedWeight', 0] },
            },
            saleAmount: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedAmount', 0] },
            },
            // Quality metrics
            totalMoistureWeight: { $sum: { $ifNull: ['$moistureWeight', 0] } },
            totalDustWeight: { $sum: { $ifNull: ['$dustWeight', 0] } },
            // Review and flag metrics
            reviewedEntries: { $sum: { $cond: [{ $eq: ['$isReviewed', true] }, 1, 0] } },
            flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
            varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
            manualWeightEntries: { $sum: { $cond: [{ $eq: ['$manualWeight', true] }, 1, 0] } },
            // Material and palette metrics
            purchaseMaterials: { $addToSet: { $ifNull: ['$materialType.name', null] } },
            salePalettes: { $addToSet: { $ifNull: ['$palletteType', null] } },
          },
        },
      ];

      const filterString = serializeFilters({ entryType, vendor, plant, startDate, endDate });
      const cacheKey = `enhanced-${REPORT_SUMMARY_KEY(filterString)}`;
      const results = await CacheService.getOrSet<any[]>(cacheKey, REPORTS_CACHE_TTL, async () => {
        return Entry.aggregate(entryPipeline);
      });

      const result = results?.[0] || {
        totalEntries: 0,
        totalQuantity: 0,
        totalAmount: 0,
        purchaseEntries: 0,
        purchaseQuantity: 0,
        purchaseAmount: 0,
        saleEntries: 0,
        saleQuantity: 0,
        saleAmount: 0,
        totalMoistureWeight: 0,
        totalDustWeight: 0,
        reviewedEntries: 0,
        flaggedEntries: 0,
        varianceFlaggedEntries: 0,
        manualWeightEntries: 0,
        purchaseMaterials: [],
        salePalettes: [],
      };

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(0),
        end: endDate ? new Date(endDate as string) : new Date(),
      };

      const averageRate = result.totalQuantity > 0 ? result.totalAmount / result.totalQuantity : 0;

      return {
        totalEntries: result.totalEntries,
        totalQuantity: result.totalQuantity,
        totalAmount: result.totalAmount,
        averageRate,
        purchaseEntries: result.purchaseEntries,
        purchaseQuantity: result.purchaseQuantity,
        purchaseAmount: result.purchaseAmount,
        saleEntries: result.saleEntries,
        saleQuantity: result.saleQuantity,
        saleAmount: result.saleAmount,
        // Enhanced metrics
        quality: {
          totalMoistureWeight: result.totalMoistureWeight,
          totalDustWeight: result.totalDustWeight,
          moistureDeductionPercentage:
            result.totalQuantity > 0
              ? (result.totalMoistureWeight / result.totalQuantity) * 100
              : 0,
          dustDeductionPercentage:
            result.totalQuantity > 0 ? (result.totalDustWeight / result.totalQuantity) * 100 : 0,
        },
        review: {
          reviewedEntries: result.reviewedEntries,
          pendingReview: result.totalEntries - result.reviewedEntries,
          reviewRate:
            result.totalEntries > 0 ? (result.reviewedEntries / result.totalEntries) * 100 : 0,
          flaggedEntries: result.flaggedEntries,
          varianceFlaggedEntries: result.varianceFlaggedEntries,
          manualWeightEntries: result.manualWeightEntries,
          flagRate:
            result.totalEntries > 0 ? (result.flaggedEntries / result.totalEntries) * 100 : 0,
        },
        materials: result.purchaseMaterials.filter((m: any) => m !== null),
        palettes: result.salePalettes.filter((p: any) => p !== null),
        dateRange,
      };
    } catch (error) {
      logger.error('Error generating enhanced summary report:', error);
      throw error;
    }
  }

  /**
   * Enhanced Detailed Report with comprehensive entry information
   */
  static async generateEnhancedDetailedReport(req: Request): Promise<DetailedReport> {
    try {
      const {
        entryType,
        vendor,
        plant,
        startDate,
        endDate,
        page = PaginationDefaults.PAGE,
        limit = PaginationDefaults.LIMIT,
      } = req.query;

      const entryFilter: any = { isActive: true };
      if (entryType) entryFilter.entryType = entryType;
      if (vendor) entryFilter.vendor = vendor;
      if (plant) entryFilter.plant = plant;

      // Enforce supervisor plant scoping
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        entryFilter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        entryFilter.entryDate = {};
        if (startDate) entryFilter.entryDate.$gte = new Date(startDate as string);
        if (endDate) entryFilter.entryDate.$lte = new Date(endDate as string);
      }

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(0),
        end: endDate ? new Date(endDate as string) : new Date(),
      };

      const skip = (Number(page) - 1) * Number(limit);
      const total = await Entry.countDocuments(entryFilter);
      const totalPages = Math.ceil(total / Number(limit));

      const entries = await Entry.find(entryFilter)
        .populate('vendor', 'name code contactPerson')
        .populate('plant', 'name code address')
        .populate('vehicle', 'vehicleNumber driverName')
        .populate('materialType', 'name code')
        .populate('createdBy', 'name username')
        .populate('reviewedBy', 'name username')
        .sort({ entryDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      // Enhanced summary calculation
      const summaryPipeline = [
        { $match: entryFilter },
        {
          $addFields: {
            computedWeight: {
              $let: {
                vars: {
                  exactWeight: { $ifNull: ['$exactWeight', 0] },
                  finalWeight: { $ifNull: ['$finalWeight', 0] },
                  exitWeight: { $ifNull: ['$exitWeight', 0] },
                  entryWeight: { $ifNull: ['$entryWeight', 0] },
                  quantity: { $ifNull: ['$quantity', 0] },
                  expectedWeight: { $ifNull: ['$expectedWeight', 0] },
                },
                in: {
                  $cond: [
                    { $gt: ['$$exactWeight', 0] },
                    '$$exactWeight',
                    {
                      $cond: [
                        { $gt: ['$$finalWeight', 0] },
                        '$$finalWeight',
                        {
                          $cond: [
                            { $gt: ['$$exitWeight', 0] },
                            '$$exitWeight',
                            {
                              $cond: [
                                { $gt: ['$$entryWeight', 0] },
                                '$$entryWeight',
                                {
                                  $cond: [
                                    { $gt: ['$$quantity', 0] },
                                    '$$quantity',
                                    '$$expectedWeight',
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            computedAmount: {
              $cond: [
                { $and: [{ $gt: ['$rate', 0] }, { $gt: ['$computedWeight', 0] }] },
                { $multiply: ['$rate', '$computedWeight'] },
                { $ifNull: ['$totalAmount', 0] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$computedWeight' },
            totalAmount: { $sum: '$computedAmount' },
            purchaseEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] } },
            purchaseQuantity: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedWeight', 0] },
            },
            purchaseAmount: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedAmount', 0] },
            },
            saleEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] } },
            saleQuantity: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedWeight', 0] },
            },
            saleAmount: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedAmount', 0] },
            },
            // Quality metrics
            totalMoistureWeight: { $sum: { $ifNull: ['$moistureWeight', 0] } },
            totalDustWeight: { $sum: { $ifNull: ['$dustWeight', 0] } },
            // Review and flag metrics
            reviewedEntries: { $sum: { $cond: [{ $eq: ['$isReviewed', true] }, 1, 0] } },
            flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
            varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
            manualWeightEntries: { $sum: { $cond: [{ $eq: ['$manualWeight', true] }, 1, 0] } },
          },
        },
      ];

      const [summaryResult] = await Entry.aggregate(summaryPipeline);
      const summary = summaryResult || {
        totalEntries: 0,
        totalQuantity: 0,
        totalAmount: 0,
        purchaseEntries: 0,
        purchaseQuantity: 0,
        purchaseAmount: 0,
        saleEntries: 0,
        saleQuantity: 0,
        saleAmount: 0,
        totalMoistureWeight: 0,
        totalDustWeight: 0,
        reviewedEntries: 0,
        flaggedEntries: 0,
        varianceFlaggedEntries: 0,
        manualWeightEntries: 0,
      };

      // Enhanced entries with computed values
      const enhancedEntries = entries.map((entry: any) => ({
        _id: entry._id,
        entryNumber: entry.entryNumber,
        entryType: entry.entryType,
        entryDate: entry.entryDate,
        vendor: entry.vendor,
        plant: entry.plant,
        vehicle: entry.vehicle,
        materialType: entry.materialType,
        palletteType: entry.palletteType,
        // Weight fields
        quantity: entry.quantity,
        entryWeight: entry.entryWeight,
        exitWeight: entry.exitWeight,
        expectedWeight: entry.expectedWeight,
        exactWeight: entry.exactWeight,
        finalWeight: entry.finalWeight,
        computedWeight: this.computeWeight(entry),
        // Quality fields
        moisture: entry.moisture,
        dust: entry.dust,
        moistureWeight: entry.moistureWeight,
        dustWeight: entry.dustWeight,
        // Palette fields
        noOfBags: entry.noOfBags,
        weightPerBag: entry.weightPerBag,
        packedWeight: entry.packedWeight,
        // Financial fields
        rate: entry.rate,
        totalAmount: entry.totalAmount,
        computedAmount: this.computeAmount(entry),
        // Review and flag fields
        isReviewed: entry.isReviewed,
        reviewedBy: entry.reviewedBy,
        reviewedAt: entry.reviewedAt,
        reviewNotes: entry.reviewNotes,
        flagged: entry.flagged,
        flagReason: entry.flagReason,
        varianceFlag: entry.varianceFlag,
        manualWeight: entry.manualWeight,
        // Metadata
        createdBy: entry.createdBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));

      return {
        entries: enhancedEntries,
        summary: {
          totalEntries: summary.totalEntries,
          totalQuantity: summary.totalQuantity,
          totalAmount: summary.totalAmount,
          averageRate: summary.totalQuantity > 0 ? summary.totalAmount / summary.totalQuantity : 0,
          purchaseEntries: summary.purchaseEntries,
          purchaseQuantity: summary.purchaseQuantity,
          purchaseAmount: summary.purchaseAmount,
          saleEntries: summary.saleEntries,
          saleQuantity: summary.saleQuantity,
          saleAmount: summary.saleAmount,
          // Enhanced metrics
          quality: {
            totalMoistureWeight: summary.totalMoistureWeight,
            totalDustWeight: summary.totalDustWeight,
            moistureDeductionPercentage:
              summary.totalQuantity > 0
                ? (summary.totalMoistureWeight / summary.totalQuantity) * 100
                : 0,
            dustDeductionPercentage:
              summary.totalQuantity > 0
                ? (summary.totalDustWeight / summary.totalQuantity) * 100
                : 0,
          },
          review: {
            reviewedEntries: summary.reviewedEntries,
            pendingReview: summary.totalEntries - summary.reviewedEntries,
            reviewRate:
              summary.totalEntries > 0 ? (summary.reviewedEntries / summary.totalEntries) * 100 : 0,
            flaggedEntries: summary.flaggedEntries,
            varianceFlaggedEntries: summary.varianceFlaggedEntries,
            manualWeightEntries: summary.manualWeightEntries,
            flagRate:
              summary.totalEntries > 0 ? (summary.flaggedEntries / summary.totalEntries) * 100 : 0,
          },
          dateRange,
        },
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error generating enhanced detailed report:', error);
      throw error;
    }
  }

  /**
   * Enhanced Vendor Report with comprehensive vendor metrics
   */
  static async generateEnhancedVendorReport(req: Request): Promise<VendorReport[]> {
    try {
      const { entryType, plant, startDate, endDate } = req.query;

      const entryFilter: any = { isActive: true };
      if (entryType) entryFilter.entryType = entryType;
      if (plant) entryFilter.plant = plant;

      // Enforce supervisor plant scoping
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        entryFilter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        entryFilter.entryDate = {};
        if (startDate) entryFilter.entryDate.$gte = new Date(startDate as string);
        if (endDate) entryFilter.entryDate.$lte = new Date(endDate as string);
      }

      const filterString = serializeFilters({ entryType, plant, startDate, endDate });
      const cacheKey = `enhanced-${REPORT_VENDOR_KEY(filterString)}`;

      return CacheService.getOrSet(cacheKey, REPORTS_CACHE_TTL, async () => {
        const vendorReport = await Entry.aggregate([
          { $match: entryFilter },
          {
            $lookup: {
              from: 'materials',
              localField: 'materialType',
              foreignField: '_id',
              as: 'materialType',
            },
          },
          { $unwind: { path: '$materialType', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              computedWeight: {
                $let: {
                  vars: {
                    exactWeight: { $ifNull: ['$exactWeight', 0] },
                    finalWeight: { $ifNull: ['$finalWeight', 0] },
                    exitWeight: { $ifNull: ['$exitWeight', 0] },
                    entryWeight: { $ifNull: ['$entryWeight', 0] },
                    quantity: { $ifNull: ['$quantity', 0] },
                    expectedWeight: { $ifNull: ['$expectedWeight', 0] },
                  },
                  in: {
                    $cond: [
                      { $gt: ['$$exactWeight', 0] },
                      '$$exactWeight',
                      {
                        $cond: [
                          { $gt: ['$$finalWeight', 0] },
                          '$$finalWeight',
                          {
                            $cond: [
                              { $gt: ['$$exitWeight', 0] },
                              '$$exitWeight',
                              {
                                $cond: [
                                  { $gt: ['$$entryWeight', 0] },
                                  '$$entryWeight',
                                  {
                                    $cond: [
                                      { $gt: ['$$quantity', 0] },
                                      '$$quantity',
                                      '$$expectedWeight',
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              },
              computedAmount: {
                $cond: [
                  { $and: [{ $gt: ['$rate', 0] }, { $gt: ['$computedWeight', 0] }] },
                  { $multiply: ['$rate', '$computedWeight'] },
                  { $ifNull: ['$totalAmount', 0] },
                ],
              },
            },
          },
          {
            $group: {
              _id: '$vendor',
              totalEntries: { $sum: 1 },
              totalQuantity: { $sum: '$computedWeight' },
              totalAmount: { $sum: '$computedAmount' },
              averageRate: { $avg: { $ifNull: ['$rate', 0] } },
              purchaseEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] } },
              purchaseQuantity: {
                $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedWeight', 0] },
              },
              purchaseAmount: {
                $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedAmount', 0] },
              },
              saleEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] } },
              saleQuantity: {
                $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedWeight', 0] },
              },
              saleAmount: {
                $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedAmount', 0] },
              },
              // Quality metrics
              totalMoistureWeight: { $sum: { $ifNull: ['$moistureWeight', 0] } },
              totalDustWeight: { $sum: { $ifNull: ['$dustWeight', 0] } },
              // Review and flag metrics
              reviewedEntries: { $sum: { $cond: [{ $eq: ['$isReviewed', true] }, 1, 0] } },
              flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
              varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
              manualWeightEntries: { $sum: { $cond: [{ $eq: ['$manualWeight', true] }, 1, 0] } },
              // Material and palette metrics
              purchaseMaterials: { $addToSet: { $ifNull: ['$materialType.name', null] } },
              salePalettes: { $addToSet: { $ifNull: ['$palletteType', null] } },
            },
          },
          { $sort: { totalAmount: -1 } },
          { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'vendor' } },
          { $unwind: '$vendor' },
          {
            $project: {
              _id: 0,
              vendor: {
                _id: '$vendor._id',
                name: '$vendor.name',
                code: '$vendor.code',
                contactPerson: '$vendor.contactPerson',
                gstNumber: '$vendor.gstNumber',
              },
              totalEntries: 1,
              totalQuantity: 1,
              totalAmount: 1,
              averageRate: 1,
              purchaseEntries: 1,
              purchaseQuantity: 1,
              purchaseAmount: 1,
              saleEntries: 1,
              saleQuantity: 1,
              saleAmount: 1,
              // Enhanced metrics
              quality: {
                totalMoistureWeight: '$totalMoistureWeight',
                totalDustWeight: '$totalDustWeight',
                moistureDeductionPercentage: {
                  $cond: [
                    { $gt: ['$totalQuantity', 0] },
                    { $multiply: [{ $divide: ['$totalMoistureWeight', '$totalQuantity'] }, 100] },
                    0,
                  ],
                },
                dustDeductionPercentage: {
                  $cond: [
                    { $gt: ['$totalQuantity', 0] },
                    { $multiply: [{ $divide: ['$totalDustWeight', '$totalQuantity'] }, 100] },
                    0,
                  ],
                },
              },
              review: {
                reviewedEntries: '$reviewedEntries',
                pendingReview: { $subtract: ['$totalEntries', '$reviewedEntries'] },
                reviewRate: {
                  $cond: [
                    { $gt: ['$totalEntries', 0] },
                    { $multiply: [{ $divide: ['$reviewedEntries', '$totalEntries'] }, 100] },
                    0,
                  ],
                },
                flaggedEntries: '$flaggedEntries',
                varianceFlaggedEntries: '$varianceFlaggedEntries',
                manualWeightEntries: '$manualWeightEntries',
                flagRate: {
                  $cond: [
                    { $gt: ['$totalEntries', 0] },
                    { $multiply: [{ $divide: ['$flaggedEntries', '$totalEntries'] }, 100] },
                    0,
                  ],
                },
              },
              materials: {
                $filter: { input: '$purchaseMaterials', cond: { $ne: ['$$this', null] } },
              },
              palettes: { $filter: { input: '$salePalettes', cond: { $ne: ['$$this', null] } } },
            },
          },
        ]);

        return vendorReport;
      });
    } catch (error) {
      logger.error('Error generating enhanced vendor report:', error);
      throw error;
    }
  }

  /**
   * Enhanced Plant Report with comprehensive plant metrics
   */
  static async generateEnhancedPlantReport(req: Request): Promise<PlantReport[]> {
    try {
      const { entryType, vendor, startDate, endDate } = req.query;

      const entryFilter: any = { isActive: true };
      if (entryType) entryFilter.entryType = entryType;
      if (vendor) entryFilter.vendor = vendor;

      // Enforce supervisor plant scoping
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        entryFilter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        entryFilter.entryDate = {};
        if (startDate) entryFilter.entryDate.$gte = new Date(startDate as string);
        if (endDate) entryFilter.entryDate.$lte = new Date(endDate as string);
      }

      const filterString = serializeFilters({ entryType, vendor, startDate, endDate });
      const cacheKey = `enhanced-${REPORT_PLANT_KEY(filterString)}`;

      return CacheService.getOrSet(cacheKey, REPORTS_CACHE_TTL, async () => {
        const plantReport = await Entry.aggregate([
          { $match: entryFilter },
          {
            $lookup: {
              from: 'materials',
              localField: 'materialType',
              foreignField: '_id',
              as: 'materialType',
            },
          },
          { $unwind: { path: '$materialType', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              computedWeight: {
                $let: {
                  vars: {
                    exactWeight: { $ifNull: ['$exactWeight', 0] },
                    finalWeight: { $ifNull: ['$finalWeight', 0] },
                    exitWeight: { $ifNull: ['$exitWeight', 0] },
                    entryWeight: { $ifNull: ['$entryWeight', 0] },
                    quantity: { $ifNull: ['$quantity', 0] },
                    expectedWeight: { $ifNull: ['$expectedWeight', 0] },
                  },
                  in: {
                    $cond: [
                      { $gt: ['$$exactWeight', 0] },
                      '$$exactWeight',
                      {
                        $cond: [
                          { $gt: ['$$finalWeight', 0] },
                          '$$finalWeight',
                          {
                            $cond: [
                              { $gt: ['$$exitWeight', 0] },
                              '$$exitWeight',
                              {
                                $cond: [
                                  { $gt: ['$$entryWeight', 0] },
                                  '$$entryWeight',
                                  {
                                    $cond: [
                                      { $gt: ['$$quantity', 0] },
                                      '$$quantity',
                                      '$$expectedWeight',
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              },
              computedAmount: {
                $cond: [
                  { $and: [{ $gt: ['$rate', 0] }, { $gt: ['$computedWeight', 0] }] },
                  { $multiply: ['$rate', '$computedWeight'] },
                  { $ifNull: ['$totalAmount', 0] },
                ],
              },
            },
          },
          {
            $group: {
              _id: '$plant',
              totalEntries: { $sum: 1 },
              totalQuantity: { $sum: '$computedWeight' },
              totalAmount: { $sum: '$computedAmount' },
              averageRate: { $avg: { $ifNull: ['$rate', 0] } },
              purchaseEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] } },
              purchaseQuantity: {
                $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedWeight', 0] },
              },
              purchaseAmount: {
                $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$computedAmount', 0] },
              },
              saleEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] } },
              saleQuantity: {
                $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedWeight', 0] },
              },
              saleAmount: {
                $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$computedAmount', 0] },
              },
              // Quality metrics
              totalMoistureWeight: { $sum: { $ifNull: ['$moistureWeight', 0] } },
              totalDustWeight: { $sum: { $ifNull: ['$dustWeight', 0] } },
              // Review and flag metrics
              reviewedEntries: { $sum: { $cond: [{ $eq: ['$isReviewed', true] }, 1, 0] } },
              flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
              varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
              manualWeightEntries: { $sum: { $cond: [{ $eq: ['$manualWeight', true] }, 1, 0] } },
              // Material and palette metrics
              purchaseMaterials: { $addToSet: { $ifNull: ['$materialType.name', null] } },
              salePalettes: { $addToSet: { $ifNull: ['$palletteType', null] } },
            },
          },
          { $sort: { totalAmount: -1 } },
          { $lookup: { from: 'plants', localField: '_id', foreignField: '_id', as: 'plant' } },
          { $unwind: '$plant' },
          {
            $project: {
              _id: 0,
              plant: {
                _id: '$plant._id',
                name: '$plant.name',
                code: '$plant.code',
                address: '$plant.address',
              },
              totalEntries: 1,
              totalQuantity: 1,
              totalAmount: 1,
              averageRate: 1,
              purchaseEntries: 1,
              purchaseQuantity: 1,
              purchaseAmount: 1,
              saleEntries: 1,
              saleQuantity: 1,
              saleAmount: 1,
              // Enhanced metrics
              quality: {
                totalMoistureWeight: '$totalMoistureWeight',
                totalDustWeight: '$totalDustWeight',
                moistureDeductionPercentage: {
                  $cond: [
                    { $gt: ['$totalQuantity', 0] },
                    { $multiply: [{ $divide: ['$totalMoistureWeight', '$totalQuantity'] }, 100] },
                    0,
                  ],
                },
                dustDeductionPercentage: {
                  $cond: [
                    { $gt: ['$totalQuantity', 0] },
                    { $multiply: [{ $divide: ['$totalDustWeight', '$totalQuantity'] }, 100] },
                    0,
                  ],
                },
              },
              review: {
                reviewedEntries: '$reviewedEntries',
                pendingReview: { $subtract: ['$totalEntries', '$reviewedEntries'] },
                reviewRate: {
                  $cond: [
                    { $gt: ['$totalEntries', 0] },
                    { $multiply: [{ $divide: ['$reviewedEntries', '$totalEntries'] }, 100] },
                    0,
                  ],
                },
                flaggedEntries: '$flaggedEntries',
                varianceFlaggedEntries: '$varianceFlaggedEntries',
                manualWeightEntries: '$manualWeightEntries',
                flagRate: {
                  $cond: [
                    { $gt: ['$totalEntries', 0] },
                    { $multiply: [{ $divide: ['$flaggedEntries', '$totalEntries'] }, 100] },
                    0,
                  ],
                },
              },
              materials: {
                $filter: { input: '$purchaseMaterials', cond: { $ne: ['$$this', null] } },
              },
              palettes: { $filter: { input: '$salePalettes', cond: { $ne: ['$$this', null] } } },
            },
          },
        ]);

        return plantReport;
      });
    } catch (error) {
      logger.error('Error generating enhanced plant report:', error);
      throw error;
    }
  }

  /**
   * Helper function to create a proper request object with modified query
   */
  private static createModifiedRequest(originalReq: Request, newQuery: any): Request {
    return {
      ...originalReq,
      query: newQuery,
    } as Request;
  }

  /**
   * Enhanced Export to multiple formats with comprehensive metrics
   */
  static async exportEnhancedReport(
    req: Request,
  ): Promise<{ content: string | Buffer | Readable; contentType: string; filename: string }> {
    try {
      const {
        format = 'csv',
        reportType = 'summary',
        groupBy = 'vendor',
        entryType,
        vendor,
        plant,
        startDate,
        endDate,
        includeCharts = false,
        includeSummary = true,
        dateFormat = 'DD/MM/YYYY',
        timezone = 'Asia/Kolkata',
        filename: customFilename,
      } = req.query;

      if (!['csv', 'pdf', 'excel'].includes(format as string)) {
        throw new Error('Only CSV, PDF, and Excel formats are currently supported');
      }

      let content: string | Buffer | Readable;
      let contentType: string;
      let filename: string;

      // Enforce supervisor plant scoping
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      const effectivePlant =
        requester?.role === 'supervisor' && requester.plantId ? requester.plantId : plant;

      // Generate data based on report type
      let reportData: any;
      switch (reportType) {
        case 'summary':
          const summaryQuery: any = { ...req.query };
          if (effectivePlant) summaryQuery.plant = effectivePlant;
          const summaryReq = this.createModifiedRequest(req, summaryQuery);
          reportData = await this.generateEnhancedSummaryReport(summaryReq);
          break;

        case 'detailed':
          const detailedQuery: any = { ...req.query, limit: '10000' };
          if (effectivePlant) detailedQuery.plant = effectivePlant;
          const detailedReq = this.createModifiedRequest(req, detailedQuery);
          reportData = await this.generateEnhancedDetailedReport(detailedReq);
          break;

        case 'vendors':
          const vendorQuery: any = { ...req.query };
          if (effectivePlant) vendorQuery.plant = effectivePlant;
          const vendorReq = this.createModifiedRequest(req, vendorQuery);
          reportData = await this.generateEnhancedVendorReport(vendorReq);
          break;

        case 'plants':
          const plantQuery: any = { ...req.query };
          if (vendor) plantQuery.vendor = vendor;
          const plantReq = this.createModifiedRequest(req, plantQuery);
          reportData = await this.generateEnhancedPlantReport(plantReq);
          break;

        default:
          throw new Error('Invalid report type specified');
      }

      // Generate content based on format
      const includeChartsBool = String(includeCharts) === 'true';
      const includeSummaryBool = String(includeSummary) === 'true';
      const dateFormatStr = typeof dateFormat === 'string' ? dateFormat : 'DD/MM/YYYY';
      const timezoneStr = typeof timezone === 'string' ? timezone : 'Asia/Kolkata';
      const customFilenameStr = typeof customFilename === 'string' ? customFilename : undefined;

      switch (format) {
        case 'csv':
          content = this.generateCSVContent(reportType, reportData);
          contentType = 'text/csv; charset=utf-8';
          filename =
            customFilenameStr ||
            `enhanced-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
          break;

        case 'pdf':
          content = await this.generatePDFContent(reportType, reportData, {
            includeCharts: includeChartsBool,
            includeSummary: includeSummaryBool,
            dateFormat: dateFormatStr,
            timezone: timezoneStr,
          });
          contentType = 'application/pdf';
          filename =
            customFilenameStr ||
            `enhanced-${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;
          break;

        case 'excel':
          content = await this.generateExcelContent(reportType, reportData, {
            includeCharts: includeChartsBool,
            includeSummary: includeSummaryBool,
            dateFormat: dateFormatStr,
            timezone: timezoneStr,
          });
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename =
            customFilenameStr ||
            `enhanced-${reportType}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        default:
          throw new Error('Unsupported format');
      }

      logger.info(`Enhanced ${format.toUpperCase()} export completed for ${reportType} report`);
      return { content, contentType, filename };
    } catch (error) {
      logger.error('Error exporting enhanced report to CSV:', error);
      throw error;
    }
  }

  /**
   * Format enhanced summary report as CSV
   */
  private static formatSummaryCSV(data: any): string {
    const headers = [
      'Report Type',
      'Total Entries',
      'Total Quantity',
      'Total Amount',
      'Average Rate',
      'Purchase Entries',
      'Purchase Quantity',
      'Purchase Amount',
      'Sale Entries',
      'Sale Quantity',
      'Sale Amount',
      'Total Moisture Weight',
      'Total Dust Weight',
      'Moisture Deduction %',
      'Dust Deduction %',
      'Reviewed Entries',
      'Pending Review',
      'Review Rate %',
      'Flagged Entries',
      'Variance Flagged',
      'Manual Weight Entries',
      'Flag Rate %',
      'Materials',
      'Palettes',
      'Date Range Start',
      'Date Range End',
    ];

    const rows = [
      'Enhanced Summary',
      data.totalEntries,
      data.totalQuantity,
      data.totalAmount,
      data.averageRate,
      data.purchaseEntries,
      data.purchaseQuantity,
      data.purchaseAmount,
      data.saleEntries,
      data.saleQuantity,
      data.saleAmount,
      data.quality?.totalMoistureWeight || 0,
      data.quality?.totalDustWeight || 0,
      data.quality?.moistureDeductionPercentage || 0,
      data.quality?.dustDeductionPercentage || 0,
      data.review?.reviewedEntries || 0,
      data.review?.pendingReview || 0,
      data.review?.reviewRate || 0,
      data.review?.flaggedEntries || 0,
      data.review?.varianceFlaggedEntries || 0,
      data.review?.manualWeightEntries || 0,
      data.review?.flagRate || 0,
      data.materials?.join('; ') || '',
      data.palettes?.join('; ') || '',
      data.dateRange?.start || '',
      data.dateRange?.end || '',
    ];

    return [headers.join(','), rows.join(',')].join('\n');
  }

  /**
   * Format enhanced detailed report as CSV
   */
  private static formatDetailedCSV(data: any): string {
    const headers = [
      'Entry Number',
      'Entry Type',
      'Entry Date',
      'Vendor Name',
      'Vendor Code',
      'Plant Name',
      'Plant Code',
      'Vehicle Number',
      'Driver Name',
      'Material Type',
      'Palette Type',
      'Quantity',
      'Entry Weight',
      'Exit Weight',
      'Expected Weight',
      'Exact Weight',
      'Final Weight',
      'Computed Weight',
      'Moisture %',
      'Dust %',
      'Moisture Weight',
      'Dust Weight',
      'No Of Bags',
      'Weight Per Bag',
      'Packed Weight',
      'Rate',
      'Total Amount',
      'Computed Amount',
      'Is Reviewed',
      'Reviewed By',
      'Review Notes',
      'Flagged',
      'Flag Reason',
      'Variance Flag',
      'Manual Weight',
      'Created By',
      'Created At',
    ];

    const rows = data.entries.map((entry: any) =>
      [
        entry.entryNumber || '',
        entry.entryType || '',
        entry.entryDate || '',
        entry.vendor?.name || '',
        entry.vendor?.code || '',
        entry.plant?.name || '',
        entry.plant?.code || '',
        entry.vehicle?.vehicleNumber || '',
        entry.vehicle?.driverName || '',
        entry.materialType?.name || '',
        entry.palletteType || '',
        entry.quantity || 0,
        entry.entryWeight || 0,
        entry.exitWeight || 0,
        entry.expectedWeight || 0,
        entry.exactWeight || 0,
        entry.finalWeight || 0,
        entry.computedWeight || 0,
        entry.moisture || 0,
        entry.dust || 0,
        entry.moistureWeight || 0,
        entry.dustWeight || 0,
        entry.noOfBags || 0,
        entry.weightPerBag || 0,
        entry.packedWeight || 0,
        entry.rate || 0,
        entry.totalAmount || 0,
        entry.computedAmount || 0,
        entry.isReviewed || false,
        entry.reviewedBy?.name || '',
        entry.reviewNotes || '',
        entry.flagged || false,
        entry.flagReason || '',
        entry.varianceFlag || false,
        entry.manualWeight || false,
        entry.createdBy?.name || '',
        entry.createdAt || '',
      ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Format enhanced vendor report as CSV
   */
  private static formatVendorCSV(data: any[]): string {
    const headers = [
      'Vendor Name',
      'Vendor Code',
      'Contact Person',
      'GST Number',
      'Total Entries',
      'Total Quantity',
      'Total Amount',
      'Average Rate',
      'Purchase Entries',
      'Purchase Quantity',
      'Purchase Amount',
      'Sale Entries',
      'Sale Quantity',
      'Sale Amount',
      'Total Moisture Weight',
      'Total Dust Weight',
      'Moisture Deduction %',
      'Dust Deduction %',
      'Reviewed Entries',
      'Pending Review',
      'Review Rate %',
      'Flagged Entries',
      'Variance Flagged',
      'Manual Weight Entries',
      'Flag Rate %',
      'Materials',
      'Palettes',
    ];

    const rows = data.map((vendor: any) =>
      [
        vendor.vendor?.name || '',
        vendor.vendor?.code || '',
        vendor.vendor?.contactPerson || '',
        vendor.vendor?.gstNumber || '',
        vendor.totalEntries || 0,
        vendor.totalQuantity || 0,
        vendor.totalAmount || 0,
        vendor.averageRate || 0,
        vendor.purchaseEntries || 0,
        vendor.purchaseQuantity || 0,
        vendor.purchaseAmount || 0,
        vendor.saleEntries || 0,
        vendor.saleQuantity || 0,
        vendor.saleAmount || 0,
        vendor.quality?.totalMoistureWeight || 0,
        vendor.quality?.totalDustWeight || 0,
        vendor.quality?.moistureDeductionPercentage || 0,
        vendor.quality?.dustDeductionPercentage || 0,
        vendor.review?.reviewedEntries || 0,
        vendor.review?.pendingReview || 0,
        vendor.review?.reviewRate || 0,
        vendor.review?.flaggedEntries || 0,
        vendor.review?.varianceFlaggedEntries || 0,
        vendor.review?.manualWeightEntries || 0,
        vendor.review?.flagRate || 0,
        vendor.materials?.join('; ') || '',
        vendor.palettes?.join('; ') || '',
      ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Format enhanced plant report as CSV
   */
  private static formatPlantCSV(data: any[]): string {
    const headers = [
      'Plant Name',
      'Plant Code',
      'Address',
      'Total Entries',
      'Total Quantity',
      'Total Amount',
      'Average Rate',
      'Purchase Entries',
      'Purchase Quantity',
      'Purchase Amount',
      'Sale Entries',
      'Sale Quantity',
      'Sale Amount',
      'Total Moisture Weight',
      'Total Dust Weight',
      'Moisture Deduction %',
      'Dust Deduction %',
      'Reviewed Entries',
      'Pending Review',
      'Review Rate %',
      'Flagged Entries',
      'Variance Flagged',
      'Manual Weight Entries',
      'Flag Rate %',
      'Materials',
      'Palettes',
    ];

    const rows = data.map((plant: any) =>
      [
        plant.plant?.name || '',
        plant.plant?.code || '',
        plant.plant?.address || '',
        plant.totalEntries || 0,
        plant.totalQuantity || 0,
        plant.totalAmount || 0,
        plant.averageRate || 0,
        plant.purchaseEntries || 0,
        plant.purchaseQuantity || 0,
        plant.purchaseAmount || 0,
        plant.saleEntries || 0,
        plant.saleQuantity || 0,
        plant.saleAmount || 0,
        plant.quality?.totalMoistureWeight || 0,
        plant.quality?.totalDustWeight || 0,
        plant.quality?.moistureDeductionPercentage || 0,
        plant.quality?.dustDeductionPercentage || 0,
        plant.review?.reviewedEntries || 0,
        plant.review?.pendingReview || 0,
        plant.review?.reviewRate || 0,
        plant.review?.flaggedEntries || 0,
        plant.review?.varianceFlaggedEntries || 0,
        plant.review?.manualWeightEntries || 0,
        plant.review?.flagRate || 0,
        plant.materials?.join('; ') || '',
        plant.palettes?.join('; ') || '',
      ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate CSV content for different report types
   */
  private static generateCSVContent(reportType: string, data: any): string {
    const BOM = '\uFEFF'; // UTF-8 BOM for proper encoding

    switch (reportType) {
      case 'summary':
        return BOM + this.formatSummaryCSV(data);
      case 'detailed':
        return BOM + this.formatDetailedCSV(data);
      case 'vendors':
        return BOM + this.formatVendorCSV(data);
      case 'plants':
        return BOM + this.formatPlantCSV(data);
      default:
        throw new Error('Invalid report type for CSV generation');
    }
  }

  /**
   * Generate PDF content for different report types
   */
  private static async generatePDFContent(
    reportType: string,
    data: any,
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Enhanced ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
            Author: 'Weighing App',
            Subject: 'Enhanced Report',
            Keywords: 'weighing, report, analytics',
            CreationDate: new Date(),
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Add header
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(`Enhanced ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, {
            align: 'center',
          });

        doc.moveDown(0.5);
        doc
          .fontSize(12)
          .font('Helvetica')
          .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });

        doc.moveDown(1);

        // Add content based on report type
        switch (reportType) {
          case 'summary':
            this.addSummaryPDFContent(doc, data, options);
            break;
          case 'detailed':
            this.addDetailedPDFContent(doc, data, options);
            break;
          case 'vendors':
            this.addVendorPDFContent(doc, data, options);
            break;
          case 'plants':
            this.addPlantPDFContent(doc, data, options);
            break;
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Excel content for different report types
   */
  private static async generateExcelContent(
    reportType: string,
    data: any,
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Weighing App';
    workbook.lastModifiedBy = 'Weighing App';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ExcelJS properties are set differently, using basic properties only

    // Create worksheet
    const worksheet = workbook.addWorksheet('Report Data');

    // Add content based on report type
    switch (reportType) {
      case 'summary':
        this.addSummaryExcelContent(worksheet, data, options);
        break;
      case 'detailed':
        this.addDetailedExcelContent(worksheet, data, options);
        break;
      case 'vendors':
        this.addVendorExcelContent(worksheet, data, options);
        break;
      case 'plants':
        this.addPlantExcelContent(worksheet, data, options);
        break;
    }

    // Generate buffer
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /**
   * Add summary report content to PDF
   */
  private static addSummaryPDFContent(
    doc: any,
    data: any,
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    // Add generation timestamp with custom formatting
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: options?.timezone || 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    doc.fontSize(10).font('Helvetica').text(`Generated on: ${timestamp}`, { align: 'right' });
    doc.moveDown(0.5);

    doc.fontSize(16).font('Helvetica-Bold').text('Summary Overview');
    doc.moveDown(0.5);

    // Totals section
    doc.fontSize(14).font('Helvetica-Bold').text('Totals');
    doc.fontSize(12).font('Helvetica').text(`Total Entries: ${data.totalEntries}`);
    doc.text(`Total Quantity: ${data.totalQuantity}`);
    doc.text(`Total Amount: ${data.totalAmount}`);
    doc.text(`Average Rate: ${data.averageRate}`);
    doc.moveDown(0.5);

    // By Type section
    doc.fontSize(14).font('Helvetica-Bold').text('By Type');
    doc.fontSize(12).font('Helvetica').text(`Purchase Entries: ${data.purchaseEntries}`);
    doc.text(`Purchase Quantity: ${data.purchaseQuantity}`);
    doc.text(`Purchase Amount: ${data.purchaseAmount}`);
    doc.text(`Sale Entries: ${data.saleEntries}`);
    doc.text(`Sale Quantity: ${data.saleQuantity}`);
    doc.text(`Sale Amount: ${data.saleAmount}`);
    doc.moveDown(0.5);

    // Quality section
    if (data.quality) {
      doc.fontSize(14).font('Helvetica-Bold').text('Quality Metrics');
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Total Moisture Weight: ${data.quality.totalMoistureWeight}`);
      doc.text(`Total Dust Weight: ${data.quality.totalDustWeight}`);
      doc.text(`Moisture Deduction %: ${data.quality.moistureDeductionPercentage?.toFixed(2)}%`);
      doc.text(`Dust Deduction %: ${data.quality.dustDeductionPercentage?.toFixed(2)}%`);
      doc.moveDown(0.5);
    }

    // Review section
    if (data.review) {
      doc.fontSize(14).font('Helvetica-Bold').text('Review & Compliance');
      doc.fontSize(12).font('Helvetica').text(`Reviewed Entries: ${data.review.reviewedEntries}`);
      doc.text(`Pending Review: ${data.review.pendingReview}`);
      doc.text(`Review Rate: ${data.review.reviewRate?.toFixed(2)}%`);
      doc.text(`Flagged Entries: ${data.review.flaggedEntries}`);
      doc.text(`Variance Flagged: ${data.review.varianceFlaggedEntries}`);
      doc.text(`Manual Weight Entries: ${data.review.manualWeightEntries}`);
      doc.text(`Flag Rate: ${data.review.flagRate?.toFixed(2)}%`);
      doc.moveDown(0.5);
    }

    // Add charts if requested
    if (options?.includeCharts) {
      this.addSummaryCharts(doc, data);
    }
  }

  /**
   * Add summary charts to PDF
   */
  private static addSummaryCharts(doc: any, data: any): void {
    doc.fontSize(14).font('Helvetica-Bold').text('Visual Analytics');
    doc.moveDown(0.5);

    // Entry Type Distribution Chart (text-based representation)
    doc.fontSize(12).font('Helvetica-Bold').text('Entry Type Distribution:');
    const totalEntries = data.totalEntries || 1;
    const purchasePercentage = (((data.purchaseEntries || 0) / totalEntries) * 100).toFixed(1);
    const salePercentage = (((data.saleEntries || 0) / totalEntries) * 100).toFixed(1);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Purchase: ${'█'.repeat(Math.round(Number(purchasePercentage) / 2))} ${purchasePercentage}%`,
      );
    doc.text(`Sale: ${'█'.repeat(Math.round(Number(salePercentage) / 2))} ${salePercentage}%`);
    doc.moveDown(0.5);

    // Quality Metrics Chart
    if (data.quality) {
      doc.fontSize(12).font('Helvetica-Bold').text('Quality Metrics:');
      const totalWeight = data.totalQuantity || 1;
      const moisturePercentage = (
        ((data.quality.totalMoistureWeight || 0) / totalWeight) *
        100
      ).toFixed(2);
      const dustPercentage = (((data.quality.totalDustWeight || 0) / totalWeight) * 100).toFixed(2);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Moisture: ${'█'.repeat(Math.round(Number(moisturePercentage) * 2))} ${moisturePercentage}%`,
        );
      doc.text(`Dust: ${'█'.repeat(Math.round(Number(dustPercentage) * 2))} ${dustPercentage}%`);
      doc.moveDown(0.5);
    }

    // Review Status Chart
    if (data.review) {
      doc.fontSize(12).font('Helvetica-Bold').text('Review Status:');
      const reviewPercentage = data.review.reviewRate?.toFixed(1) || '0';
      const flagPercentage = data.review.flagRate?.toFixed(1) || '0';

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Reviewed: ${'█'.repeat(Math.round(Number(reviewPercentage) / 2))} ${reviewPercentage}%`,
        );
      doc.text(`Flagged: ${'█'.repeat(Math.round(Number(flagPercentage) / 2))} ${flagPercentage}%`);
    }
  }

  /**
   * Add detailed report content to PDF
   */
  private static addDetailedPDFContent(
    doc: any,
    data: any,
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    doc.fontSize(16).font('Helvetica-Bold').text('Detailed Entries');
    doc.moveDown(0.5);

    // Add summary first
    this.addSummaryPDFContent(doc, data.summary, options);
    doc.moveDown(1);

    // Add entries table
    doc.fontSize(14).font('Helvetica-Bold').text('Entry Details');
    doc.moveDown(0.5);

    // Table headers
    const headers = ['Entry #', 'Type', 'Date', 'Vendor', 'Plant', 'Material', 'Weight', 'Amount'];
    let yPosition = doc.y;

    headers.forEach((header, index) => {
      const xPosition = 50 + index * 60;
      doc.fontSize(10).font('Helvetica-Bold').text(header, xPosition, yPosition);
    });

    yPosition += 20;
    doc.moveDown(0.5);

    // Add entries (limit to first 50 for PDF readability)
    const entries = data.entries.slice(0, 50);
    entries.forEach((entry: any, index: number) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(entry.entryNumber || `#${index + 1}`, 50, yPosition);
      doc.text(entry.entryType || '', 110, yPosition);
      doc.text(new Date(entry.entryDate).toLocaleDateString(), 170, yPosition);
      doc.text(entry.vendor?.name || '', 230, yPosition);
      doc.text(entry.plant?.name || '', 290, yPosition);
      doc.text(entry.materialType?.name || '', 350, yPosition);
      doc.text(entry.computedWeight?.toFixed(2) || '0', 410, yPosition);
      doc.text(entry.computedAmount?.toFixed(2) || '0', 470, yPosition);

      yPosition += 15;
    });

    if (data.entries.length > 50) {
      doc.moveDown(1);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`... and ${data.entries.length - 50} more entries`);
    }
  }

  /**
   * Add vendor report content to PDF
   */
  private static addVendorPDFContent(
    doc: any,
    data: any[],
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    doc.fontSize(16).font('Helvetica-Bold').text('Vendor Analytics');
    doc.moveDown(0.5);

    data.forEach((vendor: any, index: number) => {
      if (index > 0 && doc.y > 700) {
        doc.addPage();
      }

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(vendor.vendor?.name || 'Unknown Vendor');
      doc.moveDown(0.5);

      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Code: ${vendor.vendor?.code || 'N/A'}`);
      doc.text(`Total Entries: ${vendor.totalEntries}`);
      doc.text(`Total Quantity: ${vendor.totalQuantity}`);
      doc.text(`Total Amount: ${vendor.totalAmount}`);
      doc.text(`Average Rate: ${vendor.averageRate}`);

      if (vendor.quality) {
        doc.text(`Moisture Weight: ${vendor.quality.totalMoistureWeight}`);
        doc.text(`Dust Weight: ${vendor.quality.totalDustWeight}`);
      }

      doc.moveDown(1);
    });
  }

  /**
   * Add plant report content to PDF
   */
  private static addPlantPDFContent(
    doc: any,
    data: any[],
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    doc.fontSize(16).font('Helvetica-Bold').text('Plant Analytics');
    doc.moveDown(0.5);

    data.forEach((plant: any, index: number) => {
      if (index > 0 && doc.y > 700) {
        doc.addPage();
      }

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(plant.plant?.name || 'Unknown Plant');
      doc.moveDown(0.5);

      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Code: ${plant.plant?.code || 'N/A'}`);
      doc.text(`Total Entries: ${plant.totalEntries}`);
      doc.text(`Total Quantity: ${plant.totalQuantity}`);
      doc.text(`Total Amount: ${plant.totalAmount}`);
      doc.text(`Average Rate: ${plant.averageRate}`);

      if (plant.quality) {
        doc.text(`Moisture Weight: ${plant.quality.totalMoistureWeight}`);
        doc.text(`Dust Weight: ${plant.quality.totalDustWeight}`);
      }

      doc.moveDown(1);
    });
  }

  /**
   * Add summary report content to Excel
   */
  private static addSummaryExcelContent(
    worksheet: ExcelJS.Worksheet,
    data: any,
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    // Title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'Enhanced Summary Report';
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Summary section
    worksheet.getCell('A3').value = 'Summary Overview';
    worksheet.getCell('A3').font = { bold: true, size: 14 };

    const summaryData = [
      ['Total Entries', data.totalEntries],
      ['Total Quantity', data.totalQuantity],
      ['Total Amount', data.totalAmount],
      ['Average Rate', data.averageRate],
    ];

    summaryData.forEach((row, index) => {
      worksheet.getCell(`A${5 + index}`).value = row[0];
      worksheet.getCell(`B${5 + index}`).value = row[1];
    });

    // By Type section
    worksheet.getCell('A10').value = 'By Type';
    worksheet.getCell('A10').font = { bold: true, size: 14 };

    const typeData = [
      ['Purchase Entries', data.purchaseEntries],
      ['Purchase Quantity', data.purchaseQuantity],
      ['Purchase Amount', data.purchaseAmount],
      ['Sale Entries', data.saleEntries],
      ['Sale Quantity', data.saleQuantity],
      ['Sale Amount', data.saleAmount],
    ];

    typeData.forEach((row, index) => {
      worksheet.getCell(`A${12 + index}`).value = row[0];
      worksheet.getCell(`B${12 + index}`).value = row[1];
    });

    // Quality section
    if (data.quality) {
      worksheet.getCell('A18').value = 'Quality Metrics';
      worksheet.getCell('A18').font = { bold: true, size: 14 };

      const qualityData = [
        ['Total Moisture Weight', data.quality.totalMoistureWeight],
        ['Total Dust Weight', data.quality.totalDustWeight],
        ['Moisture Deduction %', data.quality.moistureDeductionPercentage],
        ['Dust Deduction %', data.quality.dustDeductionPercentage],
      ];

      qualityData.forEach((row, index) => {
        worksheet.getCell(`A${20 + index}`).value = row[0];
        worksheet.getCell(`B${20 + index}`).value = row[1];
      });
    }

    // Review section
    if (data.review) {
      worksheet.getCell('A25').value = 'Review & Compliance';
      worksheet.getCell('A25').font = { bold: true, size: 14 };

      const reviewData = [
        ['Reviewed Entries', data.review.reviewedEntries],
        ['Pending Review', data.review.pendingReview],
        ['Review Rate %', data.review.reviewRate],
        ['Flagged Entries', data.review.flaggedEntries],
        ['Variance Flagged', data.review.varianceFlaggedEntries],
        ['Manual Weight Entries', data.review.manualWeightEntries],
        ['Flag Rate %', data.review.flagRate],
      ];

      reviewData.forEach((row, index) => {
        worksheet.getCell(`A${27 + index}`).value = row[0];
        worksheet.getCell(`B${27 + index}`).value = row[1];
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });
  }

  /**
   * Add detailed report content to Excel
   */
  private static addDetailedExcelContent(
    worksheet: ExcelJS.Worksheet,
    data: any,
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    // Add summary first
    this.addSummaryExcelContent(worksheet, data.summary, options);

    // Add entries data starting from row 35
    let startRow = 35;

    // Entries table header
    worksheet.getCell(`A${startRow}`).value = 'Entry Details';
    worksheet.getCell(`A${startRow}`).font = { bold: true, size: 14 };
    startRow += 2;

    const headers = [
      'Entry #',
      'Type',
      'Date',
      'Vendor',
      'Plant',
      'Material',
      'Palette Type',
      'Quantity',
      'Entry Weight',
      'Exit Weight',
      'Exact Weight',
      'Final Weight',
      'Computed Weight',
      'Moisture %',
      'Dust %',
      'Rate',
      'Amount',
    ];

    headers.forEach((header, index) => {
      worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).value = header;
      worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).font = { bold: true };
    });

    startRow += 1;

    // Add entries data
    data.entries.forEach((entry: any) => {
      const rowData = [
        entry.entryNumber || '',
        entry.entryType || '',
        entry.entryDate ? new Date(entry.entryDate).toLocaleDateString() : '',
        entry.vendor?.name || '',
        entry.plant?.name || '',
        entry.materialType?.name || '',
        entry.palletteType || '',
        entry.quantity || 0,
        entry.entryWeight || 0,
        entry.exitWeight || 0,
        entry.exactWeight || 0,
        entry.finalWeight || 0,
        entry.computedWeight || 0,
        entry.moisture || 0,
        entry.dust || 0,
        entry.rate || 0,
        entry.computedAmount || 0,
      ];

      rowData.forEach((value, index) => {
        worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).value = value;
      });

      startRow += 1;
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });
  }

  /**
   * Add vendor report content to Excel
   */
  private static addVendorExcelContent(
    worksheet: ExcelJS.Worksheet,
    data: any[],
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    // Title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'Enhanced Vendor Report';
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Headers
    const headers = [
      'Vendor Name',
      'Vendor Code',
      'Contact Person',
      'GST Number',
      'Total Entries',
      'Total Quantity',
      'Total Amount',
      'Average Rate',
      'Purchase Entries',
      'Purchase Quantity',
      'Purchase Amount',
      'Sale Entries',
      'Sale Quantity',
      'Sale Amount',
      'Moisture Weight',
      'Dust Weight',
      'Reviewed Entries',
      'Flagged Entries',
    ];

    let startRow = 3;
    headers.forEach((header, index) => {
      worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).value = header;
      worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).font = { bold: true };
    });

    startRow += 1;

    // Add vendor data
    data.forEach((vendor: any) => {
      const rowData = [
        vendor.vendor?.name || '',
        vendor.vendor?.code || '',
        vendor.vendor?.contactPerson || '',
        vendor.vendor?.gstNumber || '',
        vendor.totalEntries || 0,
        vendor.totalQuantity || 0,
        vendor.totalAmount || 0,
        vendor.averageRate || 0,
        vendor.purchaseEntries || 0,
        vendor.purchaseQuantity || 0,
        vendor.purchaseAmount || 0,
        vendor.saleEntries || 0,
        vendor.saleQuantity || 0,
        vendor.saleAmount || 0,
        vendor.quality?.totalMoistureWeight || 0,
        vendor.quality?.totalDustWeight || 0,
        vendor.review?.reviewedEntries || 0,
        vendor.review?.flaggedEntries || 0,
      ];

      rowData.forEach((value, index) => {
        worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).value = value;
      });

      startRow += 1;
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 18;
    });
  }

  /**
   * Add plant report content to Excel
   */
  private static addPlantExcelContent(
    worksheet: ExcelJS.Worksheet,
    data: any[],
    options?: {
      includeCharts?: boolean;
      includeSummary?: boolean;
      dateFormat?: string;
      timezone?: string;
    },
  ): void {
    // Title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'Enhanced Plant Report';
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Headers
    const headers = [
      'Plant Name',
      'Plant Code',
      'Address',
      'Total Entries',
      'Total Quantity',
      'Total Amount',
      'Average Rate',
      'Purchase Entries',
      'Purchase Quantity',
      'Purchase Amount',
      'Sale Entries',
      'Sale Quantity',
      'Sale Amount',
      'Moisture Weight',
      'Dust Weight',
      'Reviewed Entries',
      'Flagged Entries',
    ];

    let startRow = 3;
    headers.forEach((header, index) => {
      worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).value = header;
      worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).font = { bold: true };
    });

    startRow += 1;

    // Add plant data
    data.forEach((plant: any) => {
      const rowData = [
        plant.plant?.name || '',
        plant.plant?.code || '',
        plant.plant?.address || '',
        plant.totalEntries || 0,
        plant.totalQuantity || 0,
        plant.totalAmount || 0,
        plant.averageRate || 0,
        plant.purchaseEntries || 0,
        plant.purchaseQuantity || 0,
        plant.purchaseAmount || 0,
        plant.saleEntries || 0,
        plant.saleQuantity || 0,
        plant.saleAmount || 0,
        plant.quality?.totalMoistureWeight || 0,
        plant.quality?.totalDustWeight || 0,
        plant.review?.reviewedEntries || 0,
        plant.review?.flaggedEntries || 0,
      ];

      rowData.forEach((value, index) => {
        worksheet.getCell(`${String.fromCharCode(65 + index)}${startRow}`).value = value;
      });

      startRow += 1;
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 18;
    });
  }
}

export default EnhancedReportService;
