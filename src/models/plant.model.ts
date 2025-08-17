import { IPlant } from '../types/plant.types';
import mongoose, { Schema } from 'mongoose';
import Counter from './counter.model';

const plantSchema = new Schema<IPlant>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    address: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Auto-generate plant code (PLT-YYYY-XXXXXXX)
plantSchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !(this as any).code) {
      const year = new Date().getFullYear();
      const counterKey = `PLT-${year}`;
      const ctr = await Counter.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      const seq = ctr.seq;
      (this as any).code = `PLT-${year}-${String(seq).padStart(2, '0')}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

export default mongoose.model<IPlant>('Plant', plantSchema);
