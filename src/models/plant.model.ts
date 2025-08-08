import { IPlant } from '../types/plant.types';
import mongoose, { Schema } from 'mongoose';

const plantSchema = new Schema<IPlant>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    location: { type: String, required: true },
    address: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<IPlant>('Plant', plantSchema);
