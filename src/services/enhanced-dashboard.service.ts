import { Request } from 'express';
import mongoose from 'mongoose';
import Entry from '@models/entry.model';
import Invoice from '@models/invoice.model';
import Vendor from '@models/vendor.model';
import Plant from '@models/plant.model';
import { CacheService } from './cache.service';
import { serializeFilters } from '@constants/cache.constants';

export class EnhancedDashboardService {
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
   * Enhanced Admin Dashboard with comprehensive metrics
   */
  static async getEnhancedAdminDashboard(req: Request) {
    const {
      startDate,
      endDate,
      topVendorsLimit = '5',
      recentEntriesLimit = '10',
      recentInvoicesLimit = '10',
      includeFlags = 'true',
    } = req.query as any;

    const filter: any = {};
    if (startDate || endDate) {
      filter.entryDate = {};
      if (startDate) filter.entryDate.$gte = new Date(startDate as string);
      if (endDate) filter.entryDate.$lte = new Date(endDate as string);
    }

    const filterString = serializeFilters({
      startDate,
      endDate,
      topVendorsLimit,
      recentEntriesLimit,
      recentInvoicesLimit,
      includeFlags,
    });
    const cacheKey = `dashboard:enhanced-admin:${filterString}`;

    return CacheService.getOrSet(cacheKey, 300, async () => {
      // Enhanced Entry KPIs with comprehensive metrics
      const [entryKpis] = await Promise.all([
        Entry.aggregate([
          { $match: { isActive: true, ...filter } },
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
        ]),
      ]);

      // Material-wise breakdown for purchase entries
      const materialBreakdown = await Entry.aggregate([
        { $match: { isActive: true, entryType: 'purchase', ...filter } },
        {
          $lookup: {
            from: 'materials',
            localField: 'materialType',
            foreignField: '_id',
            as: 'materialType',
          },
        },
        { $unwind: '$materialType' },
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
          },
        },
        {
          $group: {
            _id: '$materialType._id',
            materialName: { $first: '$materialType.name' },
            materialCode: { $first: '$materialType.code' },
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$computedWeight' },
            totalMoistureWeight: { $sum: { $ifNull: ['$moistureWeight', 0] } },
            totalDustWeight: { $sum: { $ifNull: ['$dustWeight', 0] } },
            averageMoisture: { $avg: { $ifNull: ['$moisture', 0] } },
            averageDust: { $avg: { $ifNull: ['$dust', 0] } },
            flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
            varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
      ]);

      // Palette-wise breakdown for sale entries
      const paletteBreakdown = await Entry.aggregate([
        { $match: { isActive: true, entryType: 'sale', ...filter } },
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
          },
        },
        {
          $group: {
            _id: '$palletteType',
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$computedWeight' },
            totalBags: { $sum: { $ifNull: ['$noOfBags', 0] } },
            totalPackedWeight: { $sum: { $ifNull: ['$packedWeight', 0] } },
            averageBagsPerEntry: { $avg: { $ifNull: ['$noOfBags', 0] } },
            averageWeightPerBag: { $avg: { $ifNull: ['$weightPerBag', 0] } },
            flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
            varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
      ]);

      // Quality analysis
      const qualityAnalysis = await Entry.aggregate([
        { $match: { isActive: true, entryType: 'purchase', ...filter } },
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
          },
        },
        {
          $group: {
            _id: null,
            totalPurchaseWeight: { $sum: '$computedWeight' },
            totalMoistureWeight: { $sum: { $ifNull: ['$moistureWeight', 0] } },
            totalDustWeight: { $sum: { $ifNull: ['$dustWeight', 0] } },
            averageMoisturePercentage: { $avg: { $ifNull: ['$moisture', 0] } },
            averageDustPercentage: { $avg: { $ifNull: ['$dust', 0] } },
          },
        },
      ]);

      // Review and flag analysis
      const reviewAnalysis = await Entry.aggregate([
        { $match: { isActive: true, ...filter } },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            reviewedEntries: { $sum: { $cond: [{ $eq: ['$isReviewed', true] }, 1, 0] } },
            pendingReview: { $sum: { $cond: [{ $eq: ['$isReviewed', false] }, 1, 0] } },
            flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
            varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
            manualWeightEntries: { $sum: { $cond: [{ $eq: ['$manualWeight', true] }, 1, 0] } },
          },
        },
      ]);

      // Top vendors with enhanced metrics
      const topVendors = await Entry.aggregate([
        { $match: { isActive: true, ...filter } },
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
            totalAmount: { $sum: '$computedAmount' },
            totalQuantity: { $sum: '$computedWeight' },
            entries: { $sum: 1 },
            purchaseEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] } },
            saleEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] } },
            flaggedEntries: { $sum: { $cond: [{ $eq: ['$flagged', true] }, 1, 0] } },
            varianceFlaggedEntries: { $sum: { $cond: [{ $eq: ['$varianceFlag', true] }, 1, 0] } },
            averageRate: { $avg: { $ifNull: ['$rate', 0] } },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: Number(topVendorsLimit) || 5 },
        { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'vendor' } },
        { $unwind: '$vendor' },
        {
          $project: {
            _id: 0,
            vendor: { _id: '$vendor._id', name: '$vendor.name', code: '$vendor.code' },
            totalAmount: 1,
            totalQuantity: 1,
            entries: 1,
            purchaseEntries: 1,
            saleEntries: 1,
            flaggedEntries: 1,
            varianceFlaggedEntries: 1,
            averageRate: 1,
          },
        },
      ]);

      // Recent entries with enhanced information
      const [recentEntries, recentInvoices, docCounts] = await Promise.all([
        Entry.find({ isActive: true, ...filter })
          .populate('vendor', 'name code')
          .populate('plant', 'name code')
          .populate('materialType', 'name code')
          .populate('vehicle', 'vehicleNumber driverName')
          .sort({ createdAt: -1 })
          .limit(Number(recentEntriesLimit) || 10),
        Invoice.find({ isActive: true })
          .populate('vendor', 'name code')
          .populate('plant', 'name code')
          .sort({ createdAt: -1 })
          .limit(Number(recentInvoicesLimit) || 10),
        Promise.all([
          Entry.countDocuments({ isActive: true }),
          Invoice.countDocuments({ isActive: true }),
          Vendor.countDocuments({ isActive: true }),
          Plant.countDocuments({ isActive: true }),
        ]),
      ]);

      const [entriesCount, invoicesCount, vendorsCount, plantsCount] = docCounts;

      const c = entryKpis?.[0] || {
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

      const qa = qualityAnalysis?.[0] || {
        totalPurchaseWeight: 0,
        totalMoistureWeight: 0,
        totalDustWeight: 0,
        averageMoisturePercentage: 0,
        averageDustPercentage: 0,
      };

      // Calculate quality percentages in JavaScript
      const moistureDeductionPercentage =
        qa.totalPurchaseWeight > 0 ? (qa.totalMoistureWeight / qa.totalPurchaseWeight) * 100 : 0;
      const dustDeductionPercentage =
        qa.totalPurchaseWeight > 0 ? (qa.totalDustWeight / qa.totalPurchaseWeight) * 100 : 0;

      const ra = reviewAnalysis?.[0] || {
        totalEntries: 0,
        reviewedEntries: 0,
        pendingReview: 0,
        flaggedEntries: 0,
        varianceFlaggedEntries: 0,
        manualWeightEntries: 0,
      };

      // Calculate rates in JavaScript
      const reviewRate = ra.totalEntries > 0 ? (ra.reviewedEntries / ra.totalEntries) * 100 : 0;
      const flagRate = ra.totalEntries > 0 ? (ra.flaggedEntries / ra.totalEntries) * 100 : 0;

      const totalAmount = c.totalAmount;
      const averageRate = c.totalQuantity > 0 ? totalAmount / c.totalQuantity : 0;

      return {
        totals: {
          totalEntries: c.totalEntries,
          totalQuantity: c.totalQuantity,
          totalAmount,
          averageRate,
        },
        byType: {
          purchase: {
            entries: c.purchaseEntries,
            quantity: c.purchaseQuantity,
            amount: c.purchaseAmount,
          },
          sale: { entries: c.saleEntries, quantity: c.saleQuantity, amount: c.saleAmount },
        },
        quality: {
          totalMoistureWeight: c.totalMoistureWeight,
          totalDustWeight: c.totalDustWeight,
          averageMoisturePercentage: qa.averageMoisturePercentage,
          averageDustPercentage: qa.averageDustPercentage,
          moistureDeductionPercentage,
          dustDeductionPercentage,
        },
        review: {
          reviewedEntries: ra.reviewedEntries,
          pendingReview: ra.pendingReview,
          reviewRate,
          flaggedEntries: ra.flaggedEntries,
          varianceFlaggedEntries: ra.varianceFlaggedEntries,
          manualWeightEntries: ra.manualWeightEntries,
          flagRate,
        },
        breakdowns: {
          materials: materialBreakdown,
          palettes: paletteBreakdown,
        },
        topVendors,
        recentEntries,
        recentInvoices,
        counts: {
          entries: entriesCount,
          invoices: invoicesCount,
          vendors: vendorsCount,
          plants: plantsCount,
        },
      };
    });
  }
}

export default EnhancedDashboardService;
