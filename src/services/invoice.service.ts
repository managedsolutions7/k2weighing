import { Request } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import Invoice from '../models/invoice.model';
import {
  IInvoice,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  InvoiceWithRelations,
} from '../types/invoice.types';
import CustomError from '../utils/customError';
import logger from '../utils/logger';
import { PaginationDefaults } from '../constants';

export class InvoiceService {
  /**
   * Create a new invoice
   */
  static async createInvoice(req: Request): Promise<IInvoice> {
    try {
      const invoiceData: CreateInvoiceRequest = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      // Validate vendor exists
      const vendor = await Invoice.db.models.Vendor.findById(invoiceData.vendor);
      if (!vendor) {
        throw new CustomError('Vendor not found', 404);
      }

      // Validate plant exists
      const plant = await Invoice.db.models.Plant.findById(invoiceData.plant);
      if (!plant) {
        throw new CustomError('Plant not found', 404);
      }

      // Validate entries exist and belong to the same vendor and plant
      const entries = await Invoice.db.models.Entry.find({
        _id: { $in: invoiceData.entries },
        vendor: invoiceData.vendor,
        plant: invoiceData.plant,
        isActive: true,
      });

      if (entries.length !== invoiceData.entries.length) {
        throw new CustomError('Some entries not found or do not match vendor/plant', 404);
      }

      // Calculate totals
      const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
      const totalAmount = entries.reduce((sum, entry) => sum + entry.totalAmount, 0);

      const invoice = new Invoice({
        vendor: invoiceData.vendor,
        plant: invoiceData.plant,
        entries: invoiceData.entries,
        totalQuantity,
        totalAmount,
        invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date(),
        dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
        createdBy: userId,
      });

      const savedInvoice = await invoice.save();

      logger.info(`Invoice created: ${savedInvoice.invoiceNumber} by user: ${userId}`);
      return savedInvoice;
    } catch (error) {
      logger.error('Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Get all invoices with filtering and pagination
   */
  static async getInvoices(req: Request): Promise<{
    invoices: InvoiceWithRelations[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        vendor,
        plant,
        status,
        startDate,
        endDate,
        isActive,
        page = PaginationDefaults.PAGE,
        limit = PaginationDefaults.LIMIT,
      } = req.query;

      const filter: any = {};

      if (vendor) filter.vendor = vendor;
      if (plant) filter.plant = plant;
      if (status) filter.status = status;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      // Date range filtering
      if (startDate || endDate) {
        filter.invoiceDate = {};
        if (startDate) filter.invoiceDate.$gte = new Date(startDate as string);
        if (endDate) filter.invoiceDate.$lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const total = await Invoice.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      const invoices = await Invoice.find(filter)
        .populate('vendor', 'name code contactPerson address gstNumber')
        .populate('plant', 'name code address')
        .populate({
          path: 'entries',
          populate: {
            path: 'vehicle',
            select: 'vehicleNumber driverName',
          },
        })
        .populate('createdBy', 'name username')
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      logger.info(`Retrieved ${invoices.length} invoices out of ${total}`);
      return {
        invoices: invoices as unknown as InvoiceWithRelations[],
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      logger.error('Error retrieving invoices:', error);
      throw error;
    }
  }

  /**
   * Get a single invoice by ID
   */
  static async getInvoiceById(req: Request): Promise<InvoiceWithRelations> {
    try {
      const { id } = req.params;
      const invoice = await Invoice.findById(id)
        .populate('vendor', 'name code contactPerson address gstNumber')
        .populate('plant', 'name code address')
        .populate({
          path: 'entries',
          populate: {
            path: 'vehicle',
            select: 'vehicleNumber driverName',
          },
        })
        .populate('createdBy', 'name username');

      if (!invoice) {
        throw new CustomError('Invoice not found', 404);
      }

      logger.info(`Invoice retrieved: ${id}`);
      return invoice as unknown as InvoiceWithRelations;
    } catch (error) {
      logger.error('Error retrieving invoice:', error);
      throw error;
    }
  }

  /**
   * Update an invoice
   */
  static async updateInvoice(req: Request): Promise<IInvoice> {
    try {
      const { id } = req.params;
      const updateData: UpdateInvoiceRequest = req.body;

      const updatedInvoice = await Invoice.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedInvoice) {
        throw new CustomError('Invoice not found', 404);
      }

      logger.info(`Invoice updated: ${id}`);
      return updatedInvoice;
    } catch (error) {
      logger.error('Error updating invoice:', error);
      throw error;
    }
  }

  /**
   * Delete an invoice (soft delete)
   */
  static async deleteInvoice(req: Request): Promise<{ message: string }> {
    try {
      const { id } = req.params;
      const invoice = await Invoice.findByIdAndUpdate(id, { isActive: false }, { new: true });

      if (!invoice) {
        throw new CustomError('Invoice not found', 404);
      }

      logger.info(`Invoice deleted: ${id}`);
      return { message: 'Invoice deleted successfully' };
    } catch (error) {
      logger.error('Error deleting invoice:', error);
      throw error;
    }
  }

  /**
   * Generate PDF for an invoice
   */
  static async generatePdf(req: Request): Promise<{ pdfPath: string; downloadUrl: string }> {
    try {
      const { id } = req.params;
      const invoice = await Invoice.findById(id)
        .populate('vendor', 'name code contactPerson address gstNumber')
        .populate('plant', 'name code address')
        .populate({
          path: 'entries',
          populate: {
            path: 'vehicle',
            select: 'vehicleNumber driverName',
          },
        })
        .populate('createdBy', 'name username');

      if (!invoice) {
        throw new CustomError('Invoice not found', 404);
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const pdfPath = path.join(uploadsDir, `${invoice.invoiceNumber}.pdf`);
      const doc = new PDFDocument({ margin: 50 });

      // Pipe PDF to file
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // Generate PDF content
      this.generatePdfContent(doc, invoice as any);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', async () => {
          try {
            // Update invoice with PDF path
            await Invoice.findByIdAndUpdate(id, { pdfPath });

            const downloadUrl = `/api/invoices/${id}/download`;
            logger.info(`PDF generated for invoice: ${invoice.invoiceNumber}`);
            resolve({ pdfPath, downloadUrl });
          } catch (error) {
            reject(error);
          }
        });

        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Generate PDF content
   */
  private static generatePdfContent(doc: PDFKit.PDFDocument, invoice: any): void {
    // Header
    doc.fontSize(24).text('INVOICE', { align: 'center' });
    doc.moveDown();

    // Company and Invoice Info
    doc.fontSize(12);
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Invoice Date: ${invoice.invoiceDate.toLocaleDateString()}`);
    doc.text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`);
    doc.text(`Status: ${invoice.status.toUpperCase()}`);
    doc.moveDown();

    // Vendor Information
    doc.fontSize(14).text('VENDOR INFORMATION', { underline: true });
    doc.fontSize(10);
    doc.text(`Name: ${invoice.vendor.name}`);
    doc.text(`Code: ${invoice.vendor.code}`);
    doc.text(`Contact: ${invoice.vendor.contactPerson}`);
    doc.text(`Address: ${invoice.vendor.address}`);
    doc.text(`GST: ${invoice.vendor.gstNumber}`);
    doc.moveDown();

    // Plant Information
    doc.fontSize(14).text('PLANT INFORMATION', { underline: true });
    doc.fontSize(10);
    doc.text(`Name: ${invoice.plant.name}`);
    doc.text(`Code: ${invoice.plant.code}`);
    doc.text(`Address: ${invoice.plant.address}`);
    doc.moveDown();

    // Entries Table
    doc.fontSize(14).text('ENTRIES', { underline: true });
    doc.moveDown();

    // Table headers
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidth = 80;

    doc.fontSize(10);
    doc.text('Date', tableLeft, tableTop);
    doc.text('Vehicle', tableLeft + colWidth, tableTop);
    doc.text('Type', tableLeft + colWidth * 2, tableTop);
    doc.text('Quantity', tableLeft + colWidth * 3, tableTop);
    doc.text('Rate', tableLeft + colWidth * 4, tableTop);
    doc.text('Amount', tableLeft + colWidth * 5, tableTop);

    // Table content
    let yPosition = tableTop + 20;
    invoice.entries.forEach((entry: any) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      doc.text(entry.entryDate.toLocaleDateString(), tableLeft, yPosition);
      doc.text(entry.vehicle.vehicleNumber, tableLeft + colWidth, yPosition);
      doc.text(entry.entryType, tableLeft + colWidth * 2, yPosition);
      doc.text(entry.quantity.toString(), tableLeft + colWidth * 3, yPosition);
      doc.text(`₹${entry.rate}`, tableLeft + colWidth * 4, yPosition);
      doc.text(`₹${entry.totalAmount}`, tableLeft + colWidth * 5, yPosition);
      yPosition += 15;
    });

    // Totals
    doc.moveDown(2);
    doc.fontSize(12);
    doc.text(`Total Quantity: ${invoice.totalQuantity} liters`, { align: 'right' });
    doc.text(`Total Amount: ₹${invoice.totalAmount}`, { align: 'right' });
    doc.moveDown();

    // Footer
    doc.fontSize(10);
    doc.text('Generated by Biofuel Management System', { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
  }
}
