import { Request } from 'express';
import Entry from '../models/entry.model';
import {
  ReportFilters,
  SummaryReport,
  DetailedReport,
  VendorReport,
  PlantReport,
  TimeSeriesReport,
  ExportOptions,
} from '../types/report.types';
import CustomError from '../utils/customError';
import logger from '../utils/logger';
import { PaginationDefaults } from '../constants';

export class ReportService {
  /**
   * Generate summary report
   */
  static async generateSummaryReport(req: Request): Promise<SummaryReport> {
    try {
      const { entryType, vendor, plant, startDate, endDate } = req.query;

      const filter: any = { isActive: true };

      if (entryType) filter.entryType = entryType;
      if (vendor) filter.vendor = vendor;
      if (plant) filter.plant = plant;

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            totalAmount: { $sum: '$totalAmount' },
            averageRate: { $avg: '$rate' },
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
      ];

      const result = await Entry.aggregate(pipeline);
      const summary = result[0] || {
        totalEntries: 0,
        totalQuantity: 0,
        totalAmount: 0,
        averageRate: 0,
        purchaseEntries: 0,
        purchaseQuantity: 0,
        purchaseAmount: 0,
        saleEntries: 0,
        saleQuantity: 0,
        saleAmount: 0,
      };

      const dateRange = {
        start: startDate ? new Date(startDate as string) : new Date(0),
        end: endDate ? new Date(endDate as string) : new Date(),
      };

      logger.info(`Summary report generated with ${summary.totalEntries} entries`);
      return {
        ...summary,
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
        .populate('vendor', 'name code')
        .populate('plant', 'name code')
        .populate('vehicle', 'vehicleNumber driverName')
        .sort({ entryDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      // Generate summary for the filtered data
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

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      const pipeline = [
        { $match: filter },
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
            totalQuantity: { $sum: '$quantity' },
            totalAmount: { $sum: '$totalAmount' },
            averageRate: { $avg: '$rate' },
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
        { $sort: { totalAmount: -1 } },
      ];

      const results = await Entry.aggregate(pipeline);

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

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate as string);
        if (endDate) filter.entryDate.$lte = new Date(endDate as string);
      }

      const pipeline = [
        { $match: filter },
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
            totalQuantity: { $sum: '$quantity' },
            totalAmount: { $sum: '$totalAmount' },
            averageRate: { $avg: '$rate' },
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
        { $sort: { totalAmount: -1 } },
      ];

      const results = await Entry.aggregate(pipeline);

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

      const pipeline = [
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

      const results = await Entry.aggregate(pipeline);

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
      const { format, includeDetails, groupBy } = req.query;

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
