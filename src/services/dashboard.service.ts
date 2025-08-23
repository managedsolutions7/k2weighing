import { Request } from 'express';
import mongoose from 'mongoose';
import Entry from '@models/entry.model';
import Invoice from '@models/invoice.model';
import Vendor from '@models/vendor.model';
import Plant from '@models/plant.model';
import { CacheService } from './cache.service';
import { serializeFilters } from '@constants/cache.constants';

export class DashboardService {
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

  static async getAdminDashboard(req: Request) {
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
    });
    const cacheKey = `dashboard:admin:${filterString}`;

    return CacheService.getOrSet(cacheKey, 300, async () => {
      // Entry based counts/quantities with new weight calculation
      const [entryKpis] = await Promise.all([
        Entry.aggregate([
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
            },
          },
        ]),
      ]);

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
          },
        },
      ]);

      const [recentEntries, recentInvoices, docCounts] = await Promise.all([
        Entry.find({ isActive: true, ...filter })
          .populate('vendor', 'name code')
          .populate('plant', 'name code')
          .populate('materialType', 'name')
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
      };

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

  static async getSupervisorDashboard(req: Request) {
    const {
      startDate,
      endDate,
      recentEntriesLimit = '10',
      recentInvoicesLimit = '10',
    } = req.query as any;
    const plantId = (req as any).user?.plantId;
    const plantObjId = plantId ? new mongoose.Types.ObjectId(plantId) : undefined;

    const filter: any = plantObjId ? { plant: plantObjId } : {};
    if (startDate || endDate) {
      filter.entryDate = {};
      if (startDate) filter.entryDate.$gte = new Date(startDate as string);
      if (endDate) filter.entryDate.$lte = new Date(endDate as string);
    }

    const filterString = serializeFilters({
      startDate,
      endDate,
      recentEntriesLimit,
      recentInvoicesLimit,
    });
    const cacheKey = `dashboard:supervisor:${filterString}`;

    return CacheService.getOrSet(cacheKey, 300, async () => {
      // Entry based counts/quantities with new weight calculation
      const [entryKpis] = await Promise.all([
        Entry.aggregate([
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
            },
          },
        ]),
      ]);

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
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'vendor' } },
        { $unwind: '$vendor' },
        {
          $project: {
            _id: 0,
            vendor: { _id: '$vendor._id', name: '$vendor.name', code: '$vendor.code' },
            totalAmount: 1,
            totalQuantity: 1,
            entries: 1,
          },
        },
      ]);

      const [recentEntries, recentInvoices, docCounts] = await Promise.all([
        Entry.find({ isActive: true, ...filter })
          .populate('vendor', 'name code')
          .populate('plant', 'name code')
          .populate('materialType', 'name')
          .sort({ createdAt: -1 })
          .limit(Number(recentEntriesLimit) || 10),
        Invoice.find({ isActive: true, plant: plantObjId })
          .populate('vendor', 'name code')
          .populate('plant', 'name code')
          .sort({ createdAt: -1 })
          .limit(Number(recentInvoicesLimit) || 10),
        Promise.all([
          Entry.countDocuments({ isActive: true, ...filter }),
          Invoice.countDocuments({ isActive: true, plant: plantObjId }),
        ]),
      ]);

      const [entriesCount, invoicesCount] = docCounts;

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
      };

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
        topVendors,
        recentEntries,
        recentInvoices,
        counts: {
          entries: entriesCount,
          invoices: invoicesCount,
        },
      };
    });
  }

  static async getOperatorDashboard(req: Request) {
    const { startDate, endDate, recentEntriesLimit = '10' } = req.query as any;
    const plantId = (req as any).user?.plantId;
    const plantObjId = plantId ? new mongoose.Types.ObjectId(plantId) : undefined;

    const filter: any = plantObjId ? { plant: plantObjId } : {};
    if (startDate || endDate) {
      filter.entryDate = {};
      if (startDate) filter.entryDate.$gte = new Date(startDate as string);
      if (endDate) filter.entryDate.$lte = new Date(endDate as string);
    }

    const filterString = serializeFilters({
      startDate,
      endDate,
      recentEntriesLimit,
    });
    const cacheKey = `dashboard:operator:${filterString}`;

    return CacheService.getOrSet(cacheKey, 300, async () => {
      // Entry based counts/quantities with new weight calculation
      const [entryKpis] = await Promise.all([
        Entry.aggregate([
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
            },
          },
        ]),
      ]);

      const recentEntries = await Entry.find({ isActive: true, ...filter })
        .populate('vendor', 'name code')
        .populate('plant', 'name code')
        .populate('materialType', 'name')
        .sort({ createdAt: -1 })
        .limit(Number(recentEntriesLimit) || 10);

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
      };

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
        recentEntries,
      };
    });
  }
}

export default DashboardService;
