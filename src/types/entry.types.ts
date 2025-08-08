import mongoose from 'mongoose';
import { EntryType } from '../constants';

export interface IEntry {
  _id: mongoose.Types.ObjectId;
  entryType: EntryType;
  vendor: mongoose.Types.ObjectId;
  vehicle: mongoose.Types.ObjectId;
  plant: mongoose.Types.ObjectId;
  quantity: number;
  rate: number;
  totalAmount: number;
  entryDate: Date;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEntryRequest {
  entryType: EntryType;
  vendor: string;
  vehicle: string;
  plant: string;
  quantity: number;
  rate: number;
  entryDate: string;
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
}

export interface EntryFilters {
  entryType?: EntryType;
  vendor?: string;
  plant?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface EntryWithRelations {
  _id: mongoose.Types.ObjectId;
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
