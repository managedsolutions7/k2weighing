import { IVendor } from '../types/vendor.types';
import mongoose, { Schema } from 'mongoose';
import Counter from './counter.model';

const vendorSchema = new Schema<IVendor>(
  {
    vendorNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    code: { type: String, required: false, unique: true, sparse: true },
    contactPerson: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: false },
    address: { type: String, required: true },
    gstNumber: { type: String, required: false },
    linkedPlants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plant' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Indexes to support search
vendorSchema.index({ name: 'text', code: 'text' });
vendorSchema.index({ name: 1 });

// Auto-generate vendorNumber (VEN-YYYY-XXXX)
vendorSchema.pre('validate', async function (next) {
  try {
    // Normalize empty code to undefined to avoid unique index collisions on ""
    if (typeof (this as any).code === 'string' && (this as any).code.trim().length === 0) {
      (this as any).code = undefined;
    }
    // Normalize empty email/gstNumber to undefined
    if (typeof (this as any).email === 'string' && (this as any).email.trim().length === 0) {
      (this as any).email = undefined;
    }
    if (
      typeof (this as any).gstNumber === 'string' &&
      (this as any).gstNumber.trim().length === 0
    ) {
      (this as any).gstNumber = undefined;
    }
    if (this.isNew && !this.vendorNumber) {
      const year = new Date().getFullYear();
      const counterKey = `VEN-${year}`;
      const ctr = await Counter.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      const seq = ctr.seq;
      (this as any).vendorNumber = `VEN-${year}-${String(seq).padStart(4, '0')}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

export default mongoose.model<IVendor>('Vendor', vendorSchema);
