import mongoose from 'mongoose';

export interface IInvoice {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  vendor: mongoose.Types.ObjectId;
  plant: mongoose.Types.ObjectId;
  entries: mongoose.Types.ObjectId[];
  materialRates: Map<string, number>;
  totalQuantity: number;
  totalAmount: number;
  invoiceDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  pdfPath?: string;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvoiceRequest {
  vendor: string;
  plant: string;
  entries: string[];
  materialRates: Record<string, number>; // key: materialTypeId, value: rate
  invoiceDate?: string;
  dueDate?: string;
}

export interface UpdateInvoiceRequest {
  status?: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate?: string;
  isActive?: boolean;
}

export interface InvoiceWithRelations {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  vendor: {
    _id: mongoose.Types.ObjectId;
    name: string;
    code: string;
    contactPerson: string;
    address: string;
    gstNumber: string;
  };
  plant: {
    _id: mongoose.Types.ObjectId;
    name: string;
    code: string;
    address: string;
  };
  entries: Array<{
    _id: mongoose.Types.ObjectId;
    entryType: string;
    quantity: number;
    rate?: number;
    totalAmount?: number;
    entryDate: Date;
    vehicle: {
      _id: mongoose.Types.ObjectId;
      vehicleNumber: string;
      driverName: string;
    };
  }>;
  materialRates: Record<string, number>;
  totalQuantity: number;
  totalAmount: number;
  invoiceDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  pdfPath?: string;
  createdBy: {
    _id: mongoose.Types.ObjectId;
    name: string;
    username: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceFilters {
  vendor?: string;
  plant?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}
