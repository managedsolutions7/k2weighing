import mongoose from 'mongoose';

export interface IInvoice {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  vendor: mongoose.Types.ObjectId;
  plant: mongoose.Types.ObjectId;
  entries: mongoose.Types.ObjectId[];
  invoiceType: 'purchase' | 'sale';
  startDate: Date;
  endDate: Date;
  // For purchase invoices
  materialRates?: Map<string, number>; // key: materialTypeId, value: rate
  // For sale invoices
  paletteRates?: {
    loose: number;
    packed: number;
  };
  totalQuantity: number;
  totalAmount: number;
  // For purchase invoices - material-wise breakdown
  materialBreakdown?: Array<{
    materialType: mongoose.Types.ObjectId;
    materialName: string;
    totalQuantity: number;
    totalMoistureQuantity: number;
    totalDustQuantity: number;
    finalQuantity: number;
    rate: number;
    totalAmount: number;
  }>;
  // For sale invoices - palette breakdown
  paletteBreakdown?: {
    totalBags?: number;
    weightPerBag?: number;
    totalPackedWeight?: number;
  };
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
  invoiceType: 'purchase' | 'sale';
  startDate: string;
  endDate: string;
  // For purchase invoices
  materialRates?: Record<string, number>; // key: materialTypeId, value: rate
  // For sale invoices
  paletteRates?: {
    loose: number;
    packed: number;
  };
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
    exactWeight?: number;
    finalWeight?: number;
    exitWeight?: number;
    entryWeight?: number;
    quantity: number;
    rate?: number;
    totalAmount?: number;
    entryDate: Date;
    materialType?: {
      _id: mongoose.Types.ObjectId;
      name: string;
    };
    palletteType?: 'loose' | 'packed';
    noOfBags?: number;
    weightPerBag?: number;
    packedWeight?: number;
    moisture?: number;
    dust?: number;
    moistureWeight?: number;
    dustWeight?: number;
    vehicle: {
      _id: mongoose.Types.ObjectId;
      vehicleNumber: string;
      driverName: string;
    };
  }>;
  invoiceType: 'purchase' | 'sale';
  startDate: Date;
  endDate: Date;
  materialRates?: Record<string, number>;
  paletteRates?: {
    loose: number;
    packed: number;
  };
  totalQuantity: number;
  totalAmount: number;
  materialBreakdown?: Array<{
    materialType: mongoose.Types.ObjectId;
    materialName: string;
    totalQuantity: number;
    totalMoistureQuantity: number;
    totalDustQuantity: number;
    finalQuantity: number;
    rate: number;
    totalAmount: number;
  }>;
  paletteBreakdown?: {
    totalBags?: number;
    weightPerBag?: number;
    totalPackedWeight?: number;
  };
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
  invoiceType?: 'purchase' | 'sale';
  status?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}
