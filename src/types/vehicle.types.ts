import mongoose from 'mongoose';
import { VehicleType } from '../constants';

export interface IVehicle {
  _id: mongoose.Types.ObjectId;
  vehicleCode: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  capacity: number;
  tareWeight?: number;
  driverName: string;
  driverPhone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleRequest {
  vehicleNumber: string;
  vehicleType: VehicleType;
  capacity: number;
  driverName: string;
  driverPhone: string;
}

export interface UpdateVehicleRequest {
  vehicleNumber?: string;
  vehicleType?: VehicleType;
  capacity?: number;
  tareWeight?: number;
  driverName?: string;
  driverPhone?: string;
  isActive?: boolean;
}
