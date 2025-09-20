import { IEntry } from '../types/entry.types';
import mongoose, { Schema } from 'mongoose';
import Counter from './counter.model';

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
    // Store initial values for audit purposes
    initialEntryWeight: { type: Number, required: false, min: 0 },
    initialExitWeight: { type: Number, required: false, min: 0 },
    expectedWeight: { type: Number, required: false },
    exactWeight: { type: Number, required: false },
    varianceFlag: { type: Boolean, required: false, default: null },
    // Quality deductions (purchase exit only)
    moisture: { type: Number, required: false, min: 0, max: 100 },
    dust: { type: Number, required: false, min: 0, max: 100 },
    moistureWeight: { type: Number, required: false, min: 0 },
    dustWeight: { type: Number, required: false, min: 0 },
    finalWeight: { type: Number, required: false, min: 0 },
    rate: {
      type: Number,
      required: false,
      min: 0,
    },
    driverName: { type: String, required: false },
    driverPhone: { type: String, required: false },
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
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
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
    // PDF receipt path
    pdfPath: {
      type: String,
      required: false,
    },
  },
  { timestamps: true },
);

// Pre-save middleware to calculate total amount
entrySchema.pre('save', function (next) {
  // Use the most accurate weight for total amount calculation
  let weight = 0;
  if (this.exactWeight && this.exactWeight > 0) weight = this.exactWeight;
  else if (this.finalWeight && this.finalWeight > 0) weight = this.finalWeight;
  else if (this.exitWeight && this.exitWeight > 0) weight = this.exitWeight;
  else if (this.entryWeight && this.entryWeight > 0) weight = this.entryWeight;
  else if (this.quantity && this.quantity > 0) weight = this.quantity;
  else if (this.expectedWeight && this.expectedWeight > 0) weight = this.expectedWeight;

  if (weight > 0 && this.rate) {
    this.totalAmount = weight * this.rate;
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
      const counterKey = `ENT-${year}`;
      const ctr = await Counter.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      const seq = ctr.seq;
      this.entryNumber = `ENT-${year}-${String(seq).padStart(7, '0')}`;
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
