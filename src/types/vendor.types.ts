import mongoose from 'mongoose';

export interface IVendor {
  _id: mongoose.Types.ObjectId;
  vendorNumber: string;
  name: string;
  code?: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  gstNumber?: string;
  linkedPlants: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVendorRequest {
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  gstNumber?: string;
  linkedPlants: string[];
}

export interface UpdateVendorRequest {
  name?: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  linkedPlants?: string[];
  isActive?: boolean;
}
