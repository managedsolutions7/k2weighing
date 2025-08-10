import { IEntry } from '../types/entry.types';
import mongoose, { Schema } from 'mongoose';

const entrySchema = new Schema<IEntry>(
  {
    entryType: {
      type: String,
      enum: ['purchase', 'sale'],
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    plant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    entryWeight: { type: Number, required: true, min: 0 },
    exitWeight: { type: Number, required: false, min: 0 },
    expectedWeight: { type: Number, required: false },
    exactWeight: { type: Number, required: false },
    varianceFlag: { type: Boolean, required: false, default: null },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    entryDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Pre-save middleware to calculate total amount
entrySchema.pre('save', function (next) {
  if (this.quantity && this.rate) {
    this.totalAmount = this.quantity * this.rate;
  }
  next();
});

// Index for better query performance
entrySchema.index({ entryType: 1, plant: 1, entryDate: -1 });
entrySchema.index({ vendor: 1, entryDate: -1 });
entrySchema.index({ createdBy: 1, entryDate: -1 });

export default mongoose.model<IEntry>('Entry', entrySchema);
