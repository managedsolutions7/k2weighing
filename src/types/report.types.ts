import mongoose from 'mongoose';
import { EntryType } from '../constants';

export interface ReportFilters {
  entryType?: EntryType;
  vendor?: string;
  plant?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'vendor' | 'plant';
}

export interface SummaryReport {
  totalEntries: number;
  totalQuantity: number;
  totalAmount: number;
  averageRate: number;
  purchaseEntries: number;
  purchaseQuantity: number;
  purchaseAmount: number;
  saleEntries: number;
  saleQuantity: number;
  saleAmount: number;
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface DetailedReport {
  entries: Array<{
    _id: mongoose.Types.ObjectId;
    entryType: EntryType;
    quantity: number;
    rate: number;
    totalAmount: number;
    entryDate: Date;
    vendor: {
      _id: mongoose.Types.ObjectId;
      name: string;
      code: string;
    };
    plant: {
      _id: mongoose.Types.ObjectId;
      name: string;
      code: string;
    };
    vehicle: {
      _id: mongoose.Types.ObjectId;
      vehicleNumber: string;
      driverName: string;
    };
  }>;
  summary: SummaryReport;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface VendorReport {
  vendor: {
    _id: mongoose.Types.ObjectId;
    name: string;
    code: string;
  };
  totalEntries: number;
  totalQuantity: number;
  totalAmount: number;
  averageRate: number;
  purchaseEntries: number;
  purchaseQuantity: number;
  purchaseAmount: number;
  saleEntries: number;
  saleQuantity: number;
  saleAmount: number;
}

export interface PlantReport {
  plant: {
    _id: mongoose.Types.ObjectId;
    name: string;
    code: string;
  };
  totalEntries: number;
  totalQuantity: number;
  totalAmount: number;
  averageRate: number;
  purchaseEntries: number;
  purchaseQuantity: number;
  purchaseAmount: number;
  saleEntries: number;
  saleQuantity: number;
  saleAmount: number;
}

export interface TimeSeriesReport {
  date: string;
  entries: number;
  quantity: number;
  amount: number;
  purchaseEntries: number;
  purchaseQuantity: number;
  purchaseAmount: number;
  saleEntries: number;
  saleQuantity: number;
  saleAmount: number;
}

export interface ExportOptions {
  format: 'csv' | 'pdf';
  includeDetails?: boolean;
  groupBy?: 'day' | 'week' | 'month' | 'vendor' | 'plant';
}
