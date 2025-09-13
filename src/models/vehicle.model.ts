import { IVehicle } from '../types/vehicle.types';
import mongoose, { Schema } from 'mongoose';
import Counter from './counter.model';

const vehicleSchema = new Schema<IVehicle>(
  {
    vehicleCode: { type: String, required: true, unique: true },
    vehicleNumber: { type: String, required: false },
    // Allow both types but do not restrict usage by flow
    vehicleType: { type: String, enum: ['buy', 'sell'] },
    capacity: { type: Number, required: false },
    tareWeight: { type: Number, required: false },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// No manual schema.index for vehicleCode to avoid duplicate with unique on path
vehicleSchema.index({ vehicleNumber: 1, vehicleType: 1 }, { unique: true });

// Auto-generate vehicleCode (VEH-YYYY-XXXX)
vehicleSchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !(this as any).vehicleCode) {
      const year = new Date().getFullYear();
      const counterKey = `VEH-${year}`;

      const ctr = await Counter.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      const seq = ctr.seq;
      (this as any).vehicleCode = `VEH-${year}-${String(seq).padStart(4, '0')}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

export default mongoose.model<IVehicle>('Vehicle', vehicleSchema);
