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
    // Map of materialType -> rate for this invoice
    materialRates: {
      type: Map,
      of: Number,
      required: true,
      default: new Map(),
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
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdBy: 1, invoiceDate: -1 });

export default mongoose.model<IInvoice>('Invoice', invoiceSchema);
