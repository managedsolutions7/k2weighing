import { Request } from 'express';
import Entry from '@models/entry.model';
import Invoice from '@models/invoice.model';
import Vendor from '@models/vendor.model';
import Plant from '@models/plant.model';
import { CacheService } from './cache.service';
import { serializeFilters } from '@constants/cache.constants';

type Range = { startDate?: string | Date; endDate?: string | Date };

export class DashboardService {
  static async getAdminDashboard(req: Request) {
    const {
      startDate,
      endDate,
      topVendorsLimit = '5',
      recentEntriesLimit = '10',
      recentInvoicesLimit = '10',
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
      // Entry based counts/quantities
      const [entryKpis] = await Promise.all([
        Entry.aggregate([
          { $match: { isActive: true, ...filter } },
          {
            $group: {
              _id: null,
              totalEntries: { $sum: 1 },
              totalQuantity: { $sum: '$quantity' },
              purchaseEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] } },
              purchaseQuantity: {
                $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$quantity', 0] },
              },
              saleEntries: { $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] } },
              saleQuantity: { $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$quantity', 0] } },
            },
          },
        ]),
      ]);

      // Invoice amounts by joining entries
      const invoiceAmountAgg = await Invoice.aggregate([
        { $match: {} },
        {
          $lookup: { from: 'entries', localField: 'entries', foreignField: '_id', as: 'entryDocs' },
        },
        { $unwind: '$entryDocs' },
        ...(filter.entryDate ? [{ $match: { 'entryDocs.entryDate': filter.entryDate } }] : []),
        {
          $addFields: {
            materialKey: {
              $cond: [
                { $ne: ['$entryDocs.materialType', null] },
                { $toString: '$entryDocs.materialType' },
                null,
              ],
            },
          },
        },
        {
          $addFields: {
            rate: {
              $cond: [
                { $ne: ['$materialKey', null] },
                { $ifNull: [{ $getField: { input: '$materialRates', field: '$materialKey' } }, 0] },
                0,
              ],
            },
          },
        },
        {
          $addFields: {
            lineAmount: { $multiply: [{ $ifNull: ['$entryDocs.quantity', 0] }, '$rate'] },
          },
        },
        { $group: { _id: '$entryDocs.entryType', amount: { $sum: '$lineAmount' } } },
      ]);
      const byTypeAmount: Record<string, number> = { purchase: 0, sale: 0 };
      for (const a of invoiceAmountAgg) byTypeAmount[a._id] = a.amount;

      const topVendors = await Entry.aggregate([
        { $match: { isActive: true, ...filter } },
        {
          $group: {
            _id: '$vendor',
            totalAmount: { $sum: '$totalAmount' },
            totalQuantity: { $sum: '$quantity' },
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
        purchaseEntries: 0,
        purchaseQuantity: 0,
        saleEntries: 0,
        saleQuantity: 0,
      };
      const totalAmount = byTypeAmount.purchase + byTypeAmount.sale;
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
            amount: byTypeAmount.purchase,
          },
          sale: { entries: c.saleEntries, quantity: c.saleQuantity, amount: byTypeAmount.sale },
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

    const filter: any = { plant: plantId };
    if (startDate || endDate) {
      filter.entryDate = {};
      if (startDate) filter.entryDate.$gte = new Date(startDate as string);
      if (endDate) filter.entryDate.$lte = new Date(endDate as string);
    }

    const filterString = serializeFilters({
      startDate,
      endDate,
      plantId,
      recentEntriesLimit,
      recentInvoicesLimit,
    });
    const cacheKey = `dashboard:supervisor:${filterString}`;

    return CacheService.getOrSet(cacheKey, 300, async () => {
      const [totals, byType] = await Promise.all([
        Entry.aggregate([
          { $match: { isActive: true, ...filter } },
          {
            $group: { _id: null, totalEntries: { $sum: 1 }, totalQuantity: { $sum: '$quantity' } },
          },
        ]),
        Entry.aggregate([
          { $match: { isActive: true, ...filter } },
          { $group: { _id: '$entryType', entries: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
        ]),
      ]);

      const byTypeMap: any = {
        purchase: { entries: 0, quantity: 0, amount: 0 },
        sale: { entries: 0, quantity: 0, amount: 0 },
      };
      for (const item of byType)
        byTypeMap[item._id] = {
          entries: item.entries,
          quantity: item.quantity,
          amount: item.amount,
        };

      const [recentEntries, recentInvoices] = await Promise.all([
        Entry.find({ isActive: true, ...filter })
          .populate('vendor', 'name code')
          .populate('vehicle', 'vehicleNumber driverName')
          .sort({ createdAt: -1 })
          .limit(Number(recentEntriesLimit) || 10),
        Invoice.find({ isActive: true, plant: plantId })
          .populate('vendor', 'name code')
          .sort({ createdAt: -1 })
          .limit(Number(recentInvoicesLimit) || 10),
      ]);

      // Compute amounts via invoices for this plant
      const amountAgg = await Invoice.aggregate([
        { $match: { plant: plantId } },
        {
          $lookup: { from: 'entries', localField: 'entries', foreignField: '_id', as: 'entryDocs' },
        },
        { $unwind: '$entryDocs' },
        { $match: { 'entryDocs.plant': plantId } },
        {
          $addFields: {
            materialKey: {
              $cond: [
                { $ne: ['$entryDocs.materialType', null] },
                { $toString: '$entryDocs.materialType' },
                null,
              ],
            },
          },
        },
        {
          $addFields: {
            rate: {
              $cond: [
                { $ne: ['$materialKey', null] },
                { $ifNull: [{ $getField: { input: '$materialRates', field: '$materialKey' } }, 0] },
                0,
              ],
            },
          },
        },
        {
          $addFields: {
            lineAmount: { $multiply: [{ $ifNull: ['$entryDocs.quantity', 0] }, '$rate'] },
          },
        },
        { $group: { _id: '$entryDocs.entryType', amount: { $sum: '$lineAmount' } } },
      ]);
      const t = totals[0] || { totalEntries: 0, totalQuantity: 0 };
      const byTypeAmount: Record<string, number> = { purchase: 0, sale: 0 };
      for (const a of amountAgg) byTypeAmount[a._id] = a.amount;
      const totalAmount = byTypeAmount.purchase + byTypeAmount.sale;
      const averageRate = t.totalQuantity > 0 ? totalAmount / t.totalQuantity : 0;
      return {
        totals: { ...t, totalAmount, averageRate },
        byType: {
          purchase: { ...byTypeMap.purchase, amount: byTypeAmount.purchase },
          sale: { ...byTypeMap.sale, amount: byTypeAmount.sale },
        },
        recentEntries,
        recentInvoices,
      };
    });
  }

  static async getOperatorDashboard(req: Request) {
    const { startDate, endDate, recentEntriesLimit = '20' } = req.query as any;
    const userId = (req as any).user?.id;
    const plantId = (req as any).user?.plantId;

    const filter: any = { createdBy: userId };
    if (plantId) filter.plant = plantId;
    if (startDate || endDate) {
      filter.entryDate = {};
      if (startDate) filter.entryDate.$gte = new Date(startDate as string);
      if (endDate) filter.entryDate.$lte = new Date(endDate as string);
    }

    const filterString = serializeFilters({
      startDate,
      endDate,
      userId,
      plantId,
      recentEntriesLimit,
    });
    const cacheKey = `dashboard:operator:${filterString}`;

    return CacheService.getOrSet(cacheKey, 120, async () => {
      const [totals, pendingReviews, flagged] = await Promise.all([
        Entry.aggregate([
          { $match: { isActive: true, ...filter } },
          {
            $group: { _id: null, totalEntries: { $sum: 1 }, totalQuantity: { $sum: '$quantity' } },
          },
        ]),
        Entry.countDocuments({ isActive: true, ...filter, isReviewed: false }),
        Entry.countDocuments({ isActive: true, ...filter, flagged: true }),
      ]);

      const recentEntries = await Entry.find({ isActive: true, ...filter })
        .populate('vendor', 'name code')
        .populate('vehicle', 'vehicleNumber driverName')
        .populate('plant', 'name code')
        .sort({ createdAt: -1 })
        .limit(Number(recentEntriesLimit) || 20);

      return {
        totals: totals[0] || { totalEntries: 0, totalQuantity: 0 },
        counters: {
          pendingReviews,
          flagged,
        },
        recentEntries,
      };
    });
  }
}

export default DashboardService;
