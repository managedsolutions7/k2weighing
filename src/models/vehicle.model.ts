import { IVehicle } from '../types/vehicle.types';
import mongoose, { Schema } from 'mongoose';

const vehicleSchema = new Schema<IVehicle>(
  {
    vehicleCode: { type: String, required: true, unique: true },
    vehicleNumber: { type: String, required: true, unique: true },
    // Allow both types but do not restrict usage by flow
    vehicleType: { type: String, enum: ['buy', 'sell'] },
    capacity: { type: Number, required: true },
    tareWeight: { type: Number, required: false },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// No manual schema.index for vehicleCode to avoid duplicate with unique on path

// Auto-generate vehicleCode (VEH-YYYY-XXXX)
vehicleSchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !(this as any).vehicleCode) {
      const year = new Date().getFullYear();
      const count = await mongoose.model('Vehicle').countDocuments({
        vehicleCode: new RegExp(`^VEH-${year}-`),
      });
      (this as any).vehicleCode = `VEH-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

export default mongoose.model<IVehicle>('Vehicle', vehicleSchema);
