import { Request } from 'express';
import Entry from '../models/entry.model';
import {
  SummaryReport,
  DetailedReport,
  VendorReport,
  PlantReport,
  TimeSeriesReport,
} from '../types/report.types';
import logger from '../utils/logger';
import { PaginationDefaults } from '../constants';
import { CacheService } from './cache.service';
import {
  REPORTS_CACHE_TTL,
  REPORT_SUMMARY_KEY,
  REPORT_DETAILED_KEY,
  REPORT_VENDOR_KEY,
  REPORT_PLANT_KEY,
  REPORT_TIMESERIES_KEY,
  serializeFilters,
} from '@constants/cache.constants';

export class ReportService {
  /**
   * Generate summary report
   */
  static async generateSummaryReport(req: Request): Promise<SummaryReport> {
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

      // Entry-based KPIs for counts and quantity
      const entryPipeline: any[] = [
        { $match: entryFilter },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            purchaseEntries: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] },
            },
            purchaseQuantity: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$quantity', 0] },
            },
            saleEntries: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] },
            },
            saleQuantity: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$quantity', 0] },
            },
          },
        },
      ];

      // Invoice-based totals and amounts
      const invoiceMatch: any = {};
      if (vendor) invoiceMatch.vendor = vendor;
      if (plant) invoiceMatch.plant = plant;
      if (startDate || endDate) {
        invoiceMatch.invoiceDate = {};
        if (startDate) invoiceMatch.invoiceDate.$gte = new Date(startDate as string);
        if (endDate) invoiceMatch.invoiceDate.$lte = new Date(endDate as string);
      }

      const filterString = serializeFilters({ entryType, vendor, plant, startDate, endDate });
      const cacheKey = REPORT_SUMMARY_KEY(filterString);
      const [entryAgg, amountAgg] = await CacheService.getOrSet<any[]>(
        cacheKey,
        REPORTS_CACHE_TTL,
        async () => {
          const [eAgg, aAgg] = await Promise.all([
            Entry.aggregate(entryPipeline),
            // compute totalAmount and type-wise amounts via invoices + lookup entries
            Entry.db.models.Invoice.aggregate([
              { $match: invoiceMatch },
              {
                $lookup: {
                  from: 'entries',
                  localField: 'entries',
                  foreignField: '_id',
                  as: 'entryDocs',
                },
              },
              { $unwind: '$entryDocs' },
              // optional filter by entryType
              ...(entryType ? [{ $match: { 'entryDocs.entryType': entryType } }] : []),
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
                      {
                        $ifNull: [
                          { $getField: { input: '$materialRates', field: '$materialKey' } },
                          0,
                        ],
                      },
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
              {
                $group: {
                  _id: null,
                  totalAmount: { $sum: '$lineAmount' },
                  purchaseAmount: {
                    $sum: {
                      $cond: [{ $eq: ['$entryDocs.entryType', 'purchase'] }, '$lineAmount', 0],
                    },
                  },
                  saleAmount: {
                    $sum: {
                      $cond: [{ $eq: ['$entryDocs.entryType', 'sale'] }, '$lineAmount', 0],
                    },
                  },
                },
              },
            ]),
          ]);
          return [eAgg, aAgg];
        },
      );

      const e = (entryAgg && entryAgg[0]) || {
        totalEntries: 0,
        totalQuantity: 0,
        purchaseEntries: 0,
        purchaseQuantity: 0,
        saleEntries: 0,
        saleQuantity: 0,
      };
      const a = (amountAgg && amountAgg[0]) || {
        totalAmount: 0,
        purchaseAmount: 0,
        saleAmount: 0,
      };

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(0),
        end: endDate ? new Date(endDate as string) : new Date(),
      };

      const averageRate = e.totalQuantity > 0 ? a.totalAmount / e.totalQuantity : 0;
      logger.info(`Summary report generated with ${e.totalEntries} entries`);
      return {
        totalEntries: e.totalEntries,
        totalQuantity: e.totalQuantity,
        totalAmount: a.totalAmount,
        averageRate,
        purchaseEntries: e.purchaseEntries,
        purchaseQuantity: e.purchaseQuantity,
        purchaseAmount: a.purchaseAmount,
        saleEntries: e.saleEntries,
        saleQuantity: e.saleQuantity,
        saleAmount: a.saleAmount,
        dateRange,
      };
    } catch (error) {
      logger.error('Error generating summary report:', error);
      throw error;
    }
  }

  /**
   * Generate detailed report with pagination
   */
  static async generateDetailedReport(req: Request): Promise<DetailedReport> {
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

      const filter: any = { isActive: true };

      if (entryType) filter.entryType = entryType;
      if (vendor) filter.vendor = vendor;
      if (plant) filter.plant = plant;
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        filter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
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
        page,
        limit,
      });
      const cacheKey = REPORT_DETAILED_KEY(filterString);
      const entries = await CacheService.getOrSet<any[]>(cacheKey, REPORTS_CACHE_TTL, async () => {
        const data = await Entry.find(filter)
          .populate('vendor', 'name code')
          .populate('plant', 'name code')
          .populate('vehicle', 'vehicleNumber driverName')
          .sort({ entryDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(Number(limit));
        return data as any[];
      });

      // Generate summary (now computes amounts from invoices)
      const summary = await this.generateSummaryReport(req);

      logger.info(`Detailed report generated with ${entries.length} entries out of ${total}`);
      return {
        entries: entries as any,
        summary,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error generating detailed report:', error);
      throw error;
    }
  }

  /**
   * Generate vendor-wise report
   */
  static async generateVendorReport(req: Request): Promise<VendorReport[]> {
    try {
      const { entryType, plant, startDate, endDate } = req.query;

      const filter: any = { isActive: true };

      if (entryType) filter.entryType = entryType;
      if (plant) filter.plant = plant;
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        filter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      // Compute vendor report amounts using invoices joined with entries
      const pipeline: any[] = [
        { $match: { isActive: true, ...(plant ? { plant } : {}) } },
        {
          $lookup: {
            from: 'entries',
            localField: 'entries',
            foreignField: '_id',
            as: 'entryDocs',
          },
        },
        { $unwind: '$entryDocs' },
        ...(entryType ? [{ $match: { 'entryDocs.entryType': entryType } }] : []),
        {
          $addFields: {
            materialKey: { $toString: '$entryDocs.materialType' },
            rate: {
              $ifNull: [
                {
                  $getField: {
                    input: '$materialRates',
                    field: { $toString: '$entryDocs.materialType' },
                  },
                },
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
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendor',
            foreignField: '_id',
            as: 'vendorInfo',
          },
        },
        { $unwind: '$vendorInfo' },
        {
          $group: {
            _id: '$vendor',
            vendor: { $first: '$vendorInfo' },
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$entryDocs.quantity' },
            totalAmount: { $sum: '$lineAmount' },
            averageRate: {
              $avg: {
                $cond: [
                  { $gt: ['$entryDocs.quantity', 0] },
                  { $divide: ['$lineAmount', '$entryDocs.quantity'] },
                  0,
                ],
              },
            },
            purchaseEntries: {
              $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'purchase'] }, 1, 0] },
            },
            purchaseQuantity: {
              $sum: {
                $cond: [{ $eq: ['$entryDocs.entryType', 'purchase'] }, '$entryDocs.quantity', 0],
              },
            },
            purchaseAmount: {
              $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'purchase'] }, '$lineAmount', 0] },
            },
            saleEntries: { $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'sale'] }, 1, 0] } },
            saleQuantity: {
              $sum: {
                $cond: [{ $eq: ['$entryDocs.entryType', 'sale'] }, '$entryDocs.quantity', 0],
              },
            },
            saleAmount: {
              $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'sale'] }, '$lineAmount', 0] },
            },
          },
        },
        { $sort: { totalAmount: -1 } },
      ];

      const filterString = serializeFilters({ entryType, plant, startDate, endDate });
      const cacheKey = REPORT_VENDOR_KEY(filterString);
      const results = await CacheService.getOrSet<any[]>(cacheKey, REPORTS_CACHE_TTL, async () => {
        const data = await Entry.aggregate(pipeline);
        return data;
      });

      logger.info(`Vendor report generated for ${results.length} vendors`);
      return results;
    } catch (error) {
      logger.error('Error generating vendor report:', error);
      throw error;
    }
  }

  /**
   * Generate plant-wise report
   */
  static async generatePlantReport(req: Request): Promise<PlantReport[]> {
    try {
      const { entryType, vendor, startDate, endDate } = req.query;

      const filter: any = { isActive: true };

      if (entryType) filter.entryType = entryType;
      if (vendor) filter.vendor = vendor;
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        filter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      const pipeline: any[] = [
        { $match: { isActive: true, ...(vendor ? { vendor } : {}) } },
        {
          $lookup: {
            from: 'entries',
            localField: 'entries',
            foreignField: '_id',
            as: 'entryDocs',
          },
        },
        { $unwind: '$entryDocs' },
        ...(entryType ? [{ $match: { 'entryDocs.entryType': entryType } }] : []),
        {
          $addFields: {
            rate: {
              $ifNull: [
                {
                  $getField: {
                    input: '$materialRates',
                    field: { $toString: '$entryDocs.materialType' },
                  },
                },
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
        {
          $lookup: {
            from: 'plants',
            localField: 'plant',
            foreignField: '_id',
            as: 'plantInfo',
          },
        },
        { $unwind: '$plantInfo' },
        {
          $group: {
            _id: '$plant',
            plant: { $first: '$plantInfo' },
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$entryDocs.quantity' },
            totalAmount: { $sum: '$lineAmount' },
            averageRate: {
              $avg: {
                $cond: [
                  { $gt: ['$entryDocs.quantity', 0] },
                  { $divide: ['$lineAmount', '$entryDocs.quantity'] },
                  0,
                ],
              },
            },
            purchaseEntries: {
              $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'purchase'] }, 1, 0] },
            },
            purchaseQuantity: {
              $sum: {
                $cond: [{ $eq: ['$entryDocs.entryType', 'purchase'] }, '$entryDocs.quantity', 0],
              },
            },
            purchaseAmount: {
              $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'purchase'] }, '$lineAmount', 0] },
            },
            saleEntries: { $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'sale'] }, 1, 0] } },
            saleQuantity: {
              $sum: {
                $cond: [{ $eq: ['$entryDocs.entryType', 'sale'] }, '$entryDocs.quantity', 0],
              },
            },
            saleAmount: {
              $sum: { $cond: [{ $eq: ['$entryDocs.entryType', 'sale'] }, '$lineAmount', 0] },
            },
          },
        },
        { $sort: { totalAmount: -1 } },
      ];

      const filterString = serializeFilters({ entryType, vendor, startDate, endDate });
      const cacheKey = REPORT_PLANT_KEY(filterString);
      const results = await CacheService.getOrSet<any[]>(cacheKey, REPORTS_CACHE_TTL, async () => {
        const data = await Entry.aggregate(pipeline);
        return data;
      });

      logger.info(`Plant report generated for ${results.length} plants`);
      return results;
    } catch (error) {
      logger.error('Error generating plant report:', error);
      throw error;
    }
  }

  /**
   * Generate time series report
   */
  static async generateTimeSeriesReport(req: Request): Promise<TimeSeriesReport[]> {
    try {
      const { entryType, vendor, plant, startDate, endDate, groupBy = 'day' } = req.query;

      const filter: any = { isActive: true };

      if (entryType) filter.entryType = entryType;
      if (vendor) filter.vendor = vendor;
      if (plant) filter.plant = plant;
      const requester = (req as any).user as { role?: string; plantId?: string } | undefined;
      if (requester?.role === 'supervisor' && requester.plantId) {
        filter.plant = requester.plantId;
      }

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      let dateFormat: string;
      switch (groupBy) {
        case 'week':
          dateFormat = '%Y-%U'; // Year-Week
          break;
        case 'month':
          dateFormat = '%Y-%m'; // Year-Month
          break;
        default:
          dateFormat = '%Y-%m-%d'; // Year-Month-Day
      }

      const pipeline: any[] = [
        { $match: filter },
        {
          $group: {
            _id: {
              $dateToString: {
                format: dateFormat,
                date: '$entryDate',
              },
            },
            entries: { $sum: 1 },
            quantity: { $sum: '$quantity' },
            amount: { $sum: '$totalAmount' },
            purchaseEntries: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, 1, 0] },
            },
            purchaseQuantity: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$quantity', 0] },
            },
            purchaseAmount: {
              $sum: { $cond: [{ $eq: ['$entryType', 'purchase'] }, '$totalAmount', 0] },
            },
            saleEntries: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, 1, 0] },
            },
            saleQuantity: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$quantity', 0] },
            },
            saleAmount: {
              $sum: { $cond: [{ $eq: ['$entryType', 'sale'] }, '$totalAmount', 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const filterString = serializeFilters({
        entryType,
        vendor,
        plant,
        startDate,
        endDate,
        groupBy,
      });
      const cacheKey = REPORT_TIMESERIES_KEY(filterString);
      const results = await CacheService.getOrSet<any[]>(cacheKey, REPORTS_CACHE_TTL, async () => {
        const data = await Entry.aggregate(pipeline);
        return data;
      });

      logger.info(`Time series report generated for ${results.length} time periods`);
      return results.map((item) => ({
        date: item._id,
        ...item,
      }));
    } catch (error) {
      logger.error('Error generating time series report:', error);
      throw error;
    }
  }

  /**
   * Export report to CSV
   */
  static async exportToCSV(req: Request): Promise<string> {
    try {
      const { groupBy } = req.query;

      let data: any;
      let headers: string[];
      let rows: string[][];

      if (groupBy === 'vendor') {
        data = await this.generateVendorReport(req);
        headers = [
          'Vendor Name',
          'Vendor Code',
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
        ];
        rows = data.map((item: any) => [
          item.vendor.name,
          item.vendor.code,
          item.totalEntries.toString(),
          item.totalQuantity.toString(),
          item.totalAmount.toString(),
          item.averageRate.toFixed(2),
          item.purchaseEntries.toString(),
          item.purchaseQuantity.toString(),
          item.purchaseAmount.toString(),
          item.saleEntries.toString(),
          item.saleQuantity.toString(),
          item.saleAmount.toString(),
        ]);
      } else if (groupBy === 'plant') {
        data = await this.generatePlantReport(req);
        headers = [
          'Plant Name',
          'Plant Code',
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
        ];
        rows = data.map((item: any) => [
          item.plant.name,
          item.plant.code,
          item.totalEntries.toString(),
          item.totalQuantity.toString(),
          item.totalAmount.toString(),
          item.averageRate.toFixed(2),
          item.purchaseEntries.toString(),
          item.purchaseQuantity.toString(),
          item.purchaseAmount.toString(),
          item.saleEntries.toString(),
          item.saleQuantity.toString(),
          item.saleAmount.toString(),
        ]);
      } else {
        data = await this.generateDetailedReport(req);
        headers = [
          'Date',
          'Type',
          'Vendor',
          'Plant',
          'Vehicle',
          'Driver',
          'Quantity',
          'Rate',
          'Amount',
        ];
        rows = data.entries.map((entry: any) => [
          entry.entryDate.toLocaleDateString(),
          entry.entryType,
          entry.vendor.name,
          entry.plant.name,
          entry.vehicle.vehicleNumber,
          entry.vehicle.driverName,
          entry.quantity.toString(),
          entry.rate.toString(),
          entry.totalAmount.toString(),
        ]);
      }

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      logger.info(`CSV export generated with ${rows.length} rows`);
      return csvContent;
    } catch (error) {
      logger.error('Error exporting to CSV:', error);
      throw error;
    }
  }
}
