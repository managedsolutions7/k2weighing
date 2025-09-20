import mongoose from 'mongoose';
import { EntryType } from '../constants';

export interface IEntry {
  _id: mongoose.Types.ObjectId;
  entryNumber: string;
  entryType: EntryType;
  vendor: mongoose.Types.ObjectId;
  vehicle: mongoose.Types.ObjectId;
  plant: mongoose.Types.ObjectId;
  quantity: number;
  rate: number;
  totalAmount: number;
  entryDate: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  entryWeight?: number;
  exitWeight?: number;
  // Store initial values for audit purposes
  initialEntryWeight?: number;
  initialExitWeight?: number;
  expectedWeight?: number | null;
  exactWeight?: number | null;
  varianceFlag?: boolean | null;
  // Review/flag workflow
  isReviewed?: boolean;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  flagged?: boolean;
  flagReason?: string | null;
  // Manual weight entry marker
  manualWeight?: boolean;
  // New sale/purchase fields
  palletteType?: 'loose' | 'packed';
  noOfBags?: number;
  weightPerBag?: number;
  packedWeight?: number;
  materialType?: mongoose.Types.ObjectId;
  driverName?: string;
  driverPhone?: string;
  // Quality/deductions
  moisture?: number;
  dust?: number;
  moistureWeight?: number;
  dustWeight?: number;
  finalWeight?: number;
  // PDF receipt path
  pdfPath?: string;
}

export interface CreateEntryRequest {
  entryType: EntryType;
  vendor: string;
  vehicle: string;
  plant: string;
  quantity?: number;
  rate: number;
  entryDate: string;
  entryWeight: number;
  manualWeight?: boolean;
  palletteType?: 'loose' | 'packed';
  noOfBags?: number;
  weightPerBag?: number;
  packedWeight?: number;
  materialType?: string;
  driverName?: string;
  driverPhone?: string;
  moisture?: number;
  dust?: number;
}

export interface UpdateEntryRequest {
  entryType?: EntryType;
  vendor?: string;
  vehicle?: string;
  plant?: string;
  quantity?: number;
  rate?: number;
  entryDate?: string;
  isActive?: boolean;
  totalAmount?: number;
  exitWeight?: number;
  entryWeight?: number;
  // review/flag updates
  isReviewed?: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  flagged?: boolean;
  flagReason?: string | null;
  driverName?: string;
  driverPhone?: string;
  moisture?: number;
  dust?: number;
  moistureWeight?: number;
  dustWeight?: number;
  finalWeight?: number;
  varianceFlag?: boolean;
}

export interface EntryFilters {
  entryType?: EntryType;
  vendor?: string;
  plant?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  flagged?: boolean;
  isReviewed?: boolean;
}

export interface EntryWithRelations {
  _id: mongoose.Types.ObjectId;
  entryNumber: string;
  entryType: EntryType;
  vendor: {
    _id: mongoose.Types.ObjectId;
    name: string;
    code: string;
    contactPerson: string;
  };
  vehicle: {
    _id: mongoose.Types.ObjectId;
    vehicleNumber: string;
    vehicleType: string;
    driverName: string;
  };
  plant: {
    _id: mongoose.Types.ObjectId;
    name: string;
    code: string;
  };
  quantity: number;
  rate: number;
  totalAmount: number;
  entryDate: Date;
  createdBy: {
    _id: mongoose.Types.ObjectId;
    name: string;
    username: string;
  };
  updatedBy?: {
    _id: mongoose.Types.ObjectId;
    name: string;
    username: string;
  } | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Weight fields
  entryWeight?: number;
  exitWeight?: number;
  initialEntryWeight?: number;
  initialExitWeight?: number;
  expectedWeight?: number | null;
  exactWeight?: number | null;
  varianceFlag?: boolean | null;
  // Quality/deductions
  moisture?: number;
  dust?: number;
  moistureWeight?: number;
  dustWeight?: number;
  finalWeight?: number;
  // Review/flag workflow
  isReviewed?: boolean;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  flagged?: boolean;
  flagReason?: string | null;
  // Manual weight entry marker
  manualWeight?: boolean;
  // New sale/purchase fields
  palletteType?: 'loose' | 'packed';
  noOfBags?: number;
  weightPerBag?: number;
  packedWeight?: number;
  materialType?: mongoose.Types.ObjectId;
  driverName?: string;
  driverPhone?: string;
  // PDF receipt path
  pdfPath?: string;
}
