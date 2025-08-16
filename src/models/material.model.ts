import { Schema, model } from 'mongoose';

const materialSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default model('Material', materialSchema);
