import { IInvoice } from '../types/invoice.types';
import mongoose, { Schema } from 'mongoose';
import Counter from './counter.model';

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    plant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: true,
    },
    entries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Entry',
        required: true,
      },
    ],
    invoiceType: {
      type: String,
      enum: ['purchase', 'sale'],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    // Map of materialType -> rate for purchase invoices
    materialRates: {
      type: Map,
      of: Number,
      required: false,
    },
    // Palette rates for sale invoices
    paletteRates: {
      loose: { type: Number, required: false },
      packed: { type: Number, required: false },
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: false,
      min: 0,
    },
    // GST configuration (non-breaking, optional)
    gstApplicable: { type: Boolean, default: false },
    gstType: { type: String, enum: ['IGST', 'CGST_SGST'], required: false, default: null },
    gstRate: { type: Number, required: false, default: null, min: 0 },
    gstAmounts: {
      cgst: { type: Number, required: false, default: 0 },
      sgst: { type: Number, required: false, default: 0 },
      igst: { type: Number, required: false, default: 0 },
    },
    // Material-wise breakdown for purchase invoices
    materialBreakdown: [
      {
        materialType: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Material',
          required: false,
        },
        materialName: { type: String, required: false },
        totalQuantity: { type: Number, required: false, min: 0 },
        totalMoistureQuantity: { type: Number, required: false, min: 0 },
        totalDustQuantity: { type: Number, required: false, min: 0 },
        finalQuantity: { type: Number, required: false, min: 0 },
        rate: { type: Number, required: false, min: 0 },
        totalAmount: { type: Number, required: false, min: 0 },
      },
    ],
    // Palette breakdown for sale invoices
    paletteBreakdown: {
      totalBags: { type: Number, required: false, min: 0 },
      weightPerBag: { type: Number, required: false, min: 0 },
      totalPackedWeight: { type: Number, required: false, min: 0 },
    },
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
      default: function () {
        const date = new Date();
        date.setDate(date.getDate() + 30); // 30 days from invoice date
        return date;
      },
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue'],
      default: 'draft',
    },
    pdfPath: {
      type: String,
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

// Ensure invoiceNumber exists before validation to satisfy required constraint
invoiceSchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !this.invoiceNumber) {
      const year = new Date().getFullYear();
      const counterKey = `INV-${year}`;
      const ctr = await Counter.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      const seq = ctr.seq;
      this.invoiceNumber = `INV-${year}-${String(seq).padStart(7, '0')}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

// Index for better query performance
invoiceSchema.index({ vendor: 1, invoiceDate: -1 });
invoiceSchema.index({ plant: 1, invoiceDate: -1 });
invoiceSchema.index({ invoiceType: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdBy: 1, invoiceDate: -1 });
invoiceSchema.index({ startDate: 1, endDate: 1 });

export default mongoose.model<IInvoice>('Invoice', invoiceSchema);
