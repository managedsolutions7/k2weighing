import mongoose, { Schema } from 'mongoose';

interface ICounterDocument extends mongoose.Document {
  key: string;
  seq: number;
}

const counterSchema = new Schema<ICounterDocument>(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.models.Counter ||
  mongoose.model<ICounterDocument>('Counter', counterSchema);
