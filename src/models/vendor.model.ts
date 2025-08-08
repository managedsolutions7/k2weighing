import { IVendor } from '../types/vendor.types';
import mongoose, { Schema } from 'mongoose';

const vendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    contactPerson: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    gstNumber: { type: String, required: true },
    linkedPlants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plant' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<IVendor>('Vendor', vendorSchema);
