import { IVehicle } from '../types/vehicle.types';
import mongoose, { Schema } from 'mongoose';

const vehicleSchema = new Schema<IVehicle>(
  {
    vehicleNumber: { type: String, required: true, unique: true },
    vehicleType: { type: String, enum: ['buy', 'sell'], required: true },
    capacity: { type: Number, required: true },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<IVehicle>('Vehicle', vehicleSchema);
