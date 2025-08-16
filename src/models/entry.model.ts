import { IEntry } from '../types/entry.types';
import mongoose, { Schema } from 'mongoose';

const entrySchema = new Schema<IEntry>(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
    },
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
      required: false,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
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
    // Review & flag workflow
    isReviewed: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    reviewedAt: { type: Date, required: false },
    reviewNotes: { type: String, required: false },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, required: false },
    // Manual weight indicator
    manualWeight: { type: Boolean, default: false },
    // New fields for enhanced logic
    palletteType: {
      type: String,
      enum: ['loose', 'packed'],
      required: false, // Will be finalized at exit for sale flows
    },
    noOfBags: { type: Number, required: false },
    weightPerBag: { type: Number, required: false },
    packedWeight: { type: Number },
    materialType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: function (this: any) {
        return this.entryType === 'purchase';
      },
    },
  },
  { timestamps: true },
);

// Pre-save middleware to calculate total amount
entrySchema.pre('save', function (next) {
  if (this.quantity && this.rate) {
    this.totalAmount = this.quantity * this.rate;
  }
  // Auto-calc packedWeight for packed sale
  if (this.entryType === 'sale' && this.palletteType === 'packed') {
    if (typeof this.noOfBags === 'number' && typeof this.weightPerBag === 'number') {
      this.packedWeight = this.noOfBags * this.weightPerBag;
    }
  }
  next();
});

// Ensure entryNumber exists before validation (pattern ENT-YYYY-XXXX)
entrySchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !this.entryNumber) {
      const year = new Date().getFullYear();
      const count = await mongoose.model('Entry').countDocuments({
        entryNumber: new RegExp(`^ENT-${year}-`),
      });
      this.entryNumber = `ENT-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

// Index for better query performance
entrySchema.index({ entryType: 1, plant: 1, entryDate: -1 });
entrySchema.index({ vendor: 1, entryDate: -1 });
entrySchema.index({ createdBy: 1, entryDate: -1 });
entrySchema.index({ plant: 1, createdAt: -1 });
entrySchema.index({ vehicle: 1, createdAt: -1 });
entrySchema.index({ flagged: 1, createdAt: -1 });

export default mongoose.model<IEntry>('Entry', entrySchema);
