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
  // Enhanced metrics
  quality?: {
    totalMoistureWeight: number;
    totalDustWeight: number;
    moistureDeductionPercentage: number;
    dustDeductionPercentage: number;
  };
  review?: {
    reviewedEntries: number;
    pendingReview: number;
    reviewRate: number;
    flaggedEntries: number;
    varianceFlaggedEntries: number;
    manualWeightEntries: number;
    flagRate: number;
  };
  materials?: string[];
  palettes?: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface DetailedReport {
  entries: Array<{
    _id: mongoose.Types.ObjectId;
    entryNumber: string;
    entryType: EntryType;
    entryDate: Date;
    vendor: {
      _id: mongoose.Types.ObjectId;
      name: string;
      code: string;
      contactPerson?: string;
    };
    plant: {
      _id: mongoose.Types.ObjectId;
      name: string;
      code: string;
      address?: string;
    };
    vehicle: {
      _id: mongoose.Types.ObjectId;
      vehicleNumber: string;
      driverName: string;
    };
    materialType?: {
      _id: mongoose.Types.ObjectId;
      name: string;
      code: string;
    };
    palletteType?: string;
    // Weight fields
    quantity: number;
    entryWeight: number;
    exitWeight?: number;
    expectedWeight?: number;
    exactWeight?: number;
    finalWeight?: number;
    computedWeight: number;
    // Quality fields
    moisture?: number;
    dust?: number;
    moistureWeight?: number;
    dustWeight?: number;
    // Palette fields
    noOfBags?: number;
    weightPerBag?: number;
    packedWeight?: number;
    // Financial fields
    rate?: number;
    totalAmount?: number;
    computedAmount: number;
    // Review and flag fields
    isReviewed: boolean;
    reviewedBy?: {
      _id: mongoose.Types.ObjectId;
      name: string;
      username: string;
    };
    reviewedAt?: Date;
    reviewNotes?: string;
    flagged: boolean;
    flagReason?: string;
    varianceFlag?: boolean;
    manualWeight: boolean;
    // Metadata
    createdBy: {
      _id: mongoose.Types.ObjectId;
      name: string;
      username: string;
    };
    createdAt: Date;
    updatedAt: Date;
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
    contactPerson?: string;
    gstNumber?: string;
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
  // Enhanced metrics
  quality?: {
    totalMoistureWeight: number;
    totalDustWeight: number;
    moistureDeductionPercentage: number;
    dustDeductionPercentage: number;
  };
  review?: {
    reviewedEntries: number;
    pendingReview: number;
    reviewRate: number;
    flaggedEntries: number;
    varianceFlaggedEntries: number;
    manualWeightEntries: number;
    flagRate: number;
  };
  materials?: string[];
  palettes?: string[];
}

export interface PlantReport {
  plant: {
    _id: mongoose.Types.ObjectId;
    name: string;
    code: string;
    address?: string;
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
  // Enhanced metrics
  quality?: {
    totalMoistureWeight: number;
    totalDustWeight: number;
    moistureDeductionPercentage: number;
    dustDeductionPercentage: number;
  };
  review?: {
    reviewedEntries: number;
    pendingReview: number;
    reviewRate: number;
    flaggedEntries: number;
    varianceFlaggedEntries: number;
    manualWeightEntries: number;
    flagRate: number;
  };
  materials?: string[];
  palettes?: string[];
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
