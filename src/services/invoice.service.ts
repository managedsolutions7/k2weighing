import { Request } from 'express';
import PDFDocument from 'pdfkit';
import CryptoJS from 'crypto-js';
import QRCode from 'qrcode';
import { S3Service } from './s3.service';
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
import mongoose from 'mongoose';

export class InvoiceService {
  /**
   * Format date to DD-MMM-YYYY format
   */
  private static formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
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
      }).populate('materialType', 'name');

      if (entries.length !== invoiceData.entries.length) {
        throw new CustomError('Some entries not found or do not match vendor/plant', 404);
      }

      // Check for flagged entries (both isFlagged and varianceFlag)
      const flaggedEntries = entries.filter(
        (entry: any) => entry.flagged === true || entry.varianceFlag === true,
      );

      if (flaggedEntries.length > 0) {
        const entryNumbers = flaggedEntries.map((e: any) => e.entryNumber).join(', ');
        throw new CustomError(
          `Cannot create invoice. The following entries are flagged and need to be unflagged first: ${entryNumbers}`,
          400,
        );
      }

      // Validate entries are within the specified date range
      const startDate = new Date(invoiceData.startDate);
      const endDate = new Date(invoiceData.endDate);

      const outOfRangeEntries = entries.filter((entry: any) => {
        const entryDate = new Date(entry.entryDate);
        return entryDate < startDate || entryDate > endDate;
      });

      if (outOfRangeEntries.length > 0) {
        const entryNumbers = outOfRangeEntries.map((e: any) => e.entryNumber).join(', ');
        throw new CustomError(`Entries outside the specified date range: ${entryNumbers}`, 400);
      }

      let totalQuantity = 0;
      let totalAmount = 0;
      let materialBreakdown: any[] = [];
      let paletteBreakdown: any = {};

      if (invoiceData.invoiceType === 'purchase') {
        // Purchase invoice logic
        if (!invoiceData.materialRates || Object.keys(invoiceData.materialRates).length === 0) {
          throw new CustomError('Material rates are required for purchase invoices', 400);
        }

        // Group entries by material type
        const materialGroups = new Map();

        for (const entry of entries) {
          if (!entry.materialType) {
            throw new CustomError(`Entry ${entry.entryNumber} is missing material type`, 400);
          }

          const materialId = String(entry.materialType._id);
          const rate = invoiceData.materialRates[materialId];

          if (!rate) {
            throw new CustomError(
              `Rate not provided for material: ${entry.materialType.name}`,
              400,
            );
          }

          const exactWeight = this.computeWeightForInvoice(entry);

          if (!materialGroups.has(materialId)) {
            materialGroups.set(materialId, {
              materialType: entry.materialType._id,
              materialName: entry.materialType.name,
              totalQuantity: 0,
              totalMoistureQuantity: 0,
              totalDustQuantity: 0,
              finalQuantity: 0,
              rate: rate,
              totalAmount: 0,
              entries: [],
            });
          }

          const group = materialGroups.get(materialId);
          group.totalQuantity += exactWeight;
          group.totalMoistureQuantity += entry.moistureWeight || 0;
          group.totalDustQuantity += entry.dustWeight || 0;
          group.finalQuantity += entry.finalWeight || exactWeight;
          group.totalAmount += (entry.finalWeight || exactWeight) * rate; // Use final weight for amount calculation
          group.entries.push(entry);
        }

        // Convert to array and calculate totals
        materialBreakdown = Array.from(materialGroups.values());
        totalQuantity = materialBreakdown.reduce((sum, item) => sum + item.finalQuantity, 0); // Use final quantity
        totalAmount = materialBreakdown.reduce((sum, item) => sum + item.totalAmount, 0);
      } else if (invoiceData.invoiceType === 'sale') {
        // Sale invoice logic
        if (!invoiceData.paletteRates) {
          throw new CustomError('Palette rates are required for sale invoices', 400);
        }

        let totalBags = 0;
        let totalPackedWeight = 0;

        for (const entry of entries) {
          const exactWeight = this.computeWeightForInvoice(entry);
          totalQuantity += exactWeight;

          if (entry.palletteType === 'packed') {
            totalBags += entry.noOfBags || 0;
            totalPackedWeight += entry.packedWeight || 0;
          }
        }

        // Calculate amount based on palette type distribution
        const packedEntries = entries.filter((e: any) => e.palletteType === 'packed');
        const looseEntries = entries.filter((e: any) => e.palletteType === 'loose');

        const packedAmount = packedEntries.reduce((sum, entry) => {
          const weight = this.computeWeightForInvoice(entry);
          return sum + weight * invoiceData.paletteRates!.packed;
        }, 0);

        const looseAmount = looseEntries.reduce((sum, entry) => {
          const weight = this.computeWeightForInvoice(entry);
          return sum + weight * invoiceData.paletteRates!.loose;
        }, 0);

        totalAmount = packedAmount + looseAmount;

        paletteBreakdown = {
          totalBags,
          weightPerBag: totalBags > 0 ? totalPackedWeight / totalBags : 0,
          totalPackedWeight,
        };
      }

      const invoice = new Invoice({
        vendor: invoiceData.vendor,
        plant: invoiceData.plant,
        entries: invoiceData.entries,
        invoiceType: invoiceData.invoiceType,
        startDate: startDate,
        endDate: endDate,
        materialRates: invoiceData.materialRates,
        paletteRates: invoiceData.paletteRates,
        totalQuantity,
        totalAmount,
        materialBreakdown,
        paletteBreakdown,
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
   * Helper method for invoice calculations using the same weight logic as reports
   */
  private static computeWeightForInvoice(entry: any): number {
    // Priority order: exactWeight > finalWeight > exitWeight > entryWeight > quantity
    if (entry.exactWeight && entry.exactWeight > 0) return entry.exactWeight;
    if (entry.finalWeight && entry.finalWeight > 0) return entry.finalWeight;
    if (entry.exitWeight && entry.exitWeight > 0) return entry.exitWeight;
    if (entry.entryWeight && entry.entryWeight > 0) return entry.entryWeight;
    if (entry.quantity && entry.quantity > 0) return entry.quantity;
    return 0;
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

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));

      // Generate PDF content
      await this.generatePdfContent(doc, invoice as any);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const key = S3Service.buildKey(['invoices', `${invoice.invoiceNumber}.pdf`]);
            await S3Service.putObject(key, buffer, 'application/pdf');
            await Invoice.findByIdAndUpdate(id, { pdfPath: key });
            const downloadUrl = `/api/invoices/${id}/download`;
            logger.info(`PDF generated and uploaded for invoice: ${invoice.invoiceNumber}`);
            resolve({ pdfPath: key, downloadUrl });
          } catch (error) {
            reject(error);
          }
        });
        doc.on('error', reject);
      });
    } catch (error) {
      logger.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Generate secure digital signature
   */
  private static generateDigitalSignature(invoice: any): {
    signature: string;
    qrData: string;
    timestamp: string;
  } {
    const timestamp = new Date().toISOString();
    const secretKey = process.env.INVOICE_SIGNATURE_SECRET;

    // Create signature data
    const signatureData = {
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      vendor: invoice.vendor.name,
      plant: invoice.plant.name,
      timestamp: timestamp,
      invoiceType: invoice.invoiceType,
    };

    // Generate HMAC signature
    const dataString = JSON.stringify(signatureData);
    if (!secretKey) {
      throw new CustomError('Invoice signature secret key not found', 500);
    }
    const signature = CryptoJS.HmacSHA256(dataString, secretKey).toString();

    // Generate QR code data for verification
    const qrData = `${invoice.invoiceNumber}|${signature.substring(0, 16)}|${timestamp}`;

    return { signature, qrData, timestamp };
  }

  /**
   * Check if there's enough space on current page and add new page if needed
   */
  private static checkPageBreak(
    doc: PDFKit.PDFDocument,
    currentY: number,
    requiredSpace: number,
  ): number {
    const pageHeight = 841.89; // A4 height in points
    const margin = 40;

    if (currentY + requiredSpace > pageHeight - margin) {
      doc.addPage();
      return margin + 20; // Return new Y position after page break
    }
    return currentY;
  }

  /**
   * Generate PDF content with improved layout and e-signature
   */
  private static async generatePdfContent(doc: PDFKit.PDFDocument, invoice: any): Promise<void> {
    // Generate digital signature
    const digitalSig = this.generateDigitalSignature(invoice);

    // Set consistent page settings
    const pageWidth = 595.28; // A4 width in points
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // Set modern fonts
    doc.font('Helvetica');

    // Header with modern design
    doc.rect(margin, margin, contentWidth, 70).stroke('#2c3e50');
    doc.fillColor('#2c3e50');
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('INVOICE', margin + contentWidth / 2, margin + 20, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#34495e');
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, margin + contentWidth / 2, margin + 45, {
      align: 'center',
    });
    doc.text(
      `Date: ${this.formatDate(invoice.invoiceDate)}`,
      margin + contentWidth / 2,
      margin + 58,
      { align: 'center' },
    );

    // Reset colors
    doc.fillColor('#000000');

    // Invoice Type Badge
    const badgeWidth = 70;
    const badgeHeight = 20;
    const badgeX = pageWidth - margin - badgeWidth - 10;
    const badgeY = margin + 10;

    doc.rect(badgeX, badgeY, badgeWidth, badgeHeight).fill('#3498db');
    doc.fillColor('#ffffff');
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(invoice.invoiceType.toUpperCase(), badgeX + badgeWidth / 2, badgeY + 6, {
        align: 'center',
      });
    doc.fillColor('#000000');

    let currentY = margin + 130;

    // Date Range
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Period:', margin, currentY);
    doc.font('Helvetica');
    doc.text(
      `${this.formatDate(invoice.startDate)} - ${this.formatDate(invoice.endDate)}`,
      margin + 50,
      currentY,
    );

    currentY += 25;

    // Vendor and Plant Information (side by side)
    const boxWidth = (contentWidth - 20) / 2;

    // Vendor Information Box
    doc.rect(margin, currentY, boxWidth, 70).stroke('#bdc3c7');
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('VENDOR', margin + 10, currentY + 8);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Name: ${invoice.vendor.name}`, margin + 10, currentY + 22);
    doc.text(`Code: ${invoice.vendor.code}`, margin + 10, currentY + 34);
    doc.text(`Contact: ${invoice.vendor.contactPerson}`, margin + 10, currentY + 46);
    doc.text(`GST: ${invoice.vendor.gstNumber}`, margin + 10, currentY + 58);

    // Plant Information Box
    const plantBoxX = margin + boxWidth + 20;
    doc.rect(plantBoxX, currentY, boxWidth, 70).stroke('#bdc3c7');
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('PLANT', plantBoxX + 10, currentY + 8);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Name: ${invoice.plant.name}`, plantBoxX + 10, currentY + 22);
    doc.text(`Code: ${invoice.plant.code}`, plantBoxX + 10, currentY + 34);
    doc.text(`Address: ${invoice.plant.address}`, plantBoxX + 10, currentY + 46);

    currentY += 90;

    // Check if there's enough space for the breakdown section
    currentY = this.checkPageBreak(doc, currentY, 200);

    if (invoice.invoiceType === 'purchase') {
      // Purchase Invoice - Material Breakdown Table
      doc.fontSize(12).font('Helvetica-Bold').text('MATERIAL BREAKDOWN', margin, currentY);
      currentY += 20;

      // Table setup
      const tableLeft = margin;
      const colWidths = [100, 70, 60, 60, 70, 80];
      const headers = ['Material', 'Total Qty', 'Moisture', 'Dust', 'Final Qty', 'Amount'];

      // Header row
      doc.rect(tableLeft, currentY, contentWidth, 20).fill('#ecf0f1');
      doc.fillColor('#2c3e50');
      doc.fontSize(8).font('Helvetica-Bold');
      let xPos = tableLeft + 5;
      headers.forEach((header, index) => {
        doc.text(header, xPos, currentY + 6);
        xPos += colWidths[index];
      });
      doc.fillColor('#000000');
      currentY += 20;

      // Table content
      doc.fontSize(7).font('Helvetica');
      invoice.materialBreakdown?.forEach((material: any) => {
        doc.rect(tableLeft, currentY, contentWidth, 18).stroke('#bdc3c7');
        xPos = tableLeft + 5;
        doc.text(material.materialName, xPos, currentY + 5);
        xPos += colWidths[0];
        doc.text(material.totalQuantity.toFixed(2), xPos, currentY + 5);
        xPos += colWidths[1];
        doc.text(material.totalMoistureQuantity.toFixed(2), xPos, currentY + 5);
        xPos += colWidths[2];
        doc.text(material.totalDustQuantity.toFixed(2), xPos, currentY + 5);
        xPos += colWidths[3];
        doc.text(material.finalQuantity.toFixed(2), xPos, currentY + 5);
        xPos += colWidths[4];
        doc.text(`₹${material.totalAmount.toFixed(2)}`, xPos, currentY + 5);

        currentY += 18;
      });

      currentY += 15;
    } else if (invoice.invoiceType === 'sale') {
      // Sale Invoice - Improved Palette Breakdown
      doc.fontSize(12).font('Helvetica-Bold').text('PALETTE BREAKDOWN', margin, currentY);
      currentY += 20;

      // Calculate palette distribution from entries
      let looseQuantity = 0;
      let packedQuantity = 0;
      let looseAmount = 0;
      let packedAmount = 0;

      // Get loose and packed entries data from the service calculation
      if (invoice.entries && Array.isArray(invoice.entries)) {
        invoice.entries.forEach((entry: any) => {
          const weight = this.computeWeightForInvoice(entry);
          if (entry.palletteType === 'loose') {
            looseQuantity += weight;
            looseAmount += weight * (invoice.paletteRates?.loose || 0);
          } else if (entry.palletteType === 'packed') {
            packedQuantity += weight;
            packedAmount += weight * (invoice.paletteRates?.packed || 0);
          }
        });
      }

      // Palette Types Table
      const paletteTableLeft = margin;
      const paletteColWidths = [120, 100, 80, 100];
      const paletteHeaders = ['Palette Type', 'Quantity (kg)', 'Rate (₹/kg)', 'Amount (₹)'];

      // Header row
      doc.rect(paletteTableLeft, currentY, 400, 20).fill('#ecf0f1');
      doc.fillColor('#2c3e50');
      doc.fontSize(8).font('Helvetica-Bold');
      let xPos = paletteTableLeft + 5;
      paletteHeaders.forEach((header, index) => {
        doc.text(header, xPos, currentY + 6);
        xPos += paletteColWidths[index];
      });
      doc.fillColor('#000000');
      currentY += 20;

      // Loose palette row
      if (looseQuantity > 0) {
        doc.rect(paletteTableLeft, currentY, 400, 18).stroke('#bdc3c7');
        doc.fontSize(8).font('Helvetica');
        xPos = paletteTableLeft + 5;
        doc.text('Loose Palette', xPos, currentY + 5);
        xPos += paletteColWidths[0];
        doc.text(looseQuantity.toFixed(2), xPos, currentY + 5);
        xPos += paletteColWidths[1];
        doc.text(`₹${(invoice.paletteRates?.loose || 0).toFixed(2)}`, xPos, currentY + 5);
        xPos += paletteColWidths[2];
        doc.text(`₹${looseAmount.toFixed(2)}`, xPos, currentY + 5);
        currentY += 18;
      }

      // Packed palette row
      if (packedQuantity > 0) {
        doc.rect(paletteTableLeft, currentY, 400, 18).stroke('#bdc3c7');
        doc.fontSize(8).font('Helvetica');
        xPos = paletteTableLeft + 5;
        doc.text('Packed Palette', xPos, currentY + 5);
        xPos += paletteColWidths[0];
        doc.text(packedQuantity.toFixed(2), xPos, currentY + 5);
        xPos += paletteColWidths[1];
        doc.text(`₹${(invoice.paletteRates?.packed || 0).toFixed(2)}`, xPos, currentY + 5);
        xPos += paletteColWidths[2];
        doc.text(`₹${packedAmount.toFixed(2)}`, xPos, currentY + 5);
        currentY += 18;
      }

      currentY += 15;

      // Packed Palette Details (if applicable)
      if (invoice.paletteBreakdown?.totalBags && invoice.paletteBreakdown.totalBags > 0) {
        doc.fontSize(10).font('Helvetica-Bold').text('PACKED PALETTE DETAILS', margin, currentY);
        currentY += 15;

        doc.rect(margin, currentY, contentWidth, 50).stroke('#bdc3c7');
        doc.fontSize(8).font('Helvetica');
        doc.text(`Total Bags: ${invoice.paletteBreakdown.totalBags}`, margin + 10, currentY + 10);
        doc.text(
          `Weight per Bag: ${invoice.paletteBreakdown.weightPerBag.toFixed(2)} kg`,
          margin + 10,
          currentY + 25,
        );
        doc.text(
          `Total Packed Weight: ${invoice.paletteBreakdown.totalPackedWeight.toFixed(2)} kg`,
          margin + 10,
          currentY + 40,
        );

        currentY += 65;
      }
    }

    // Check if there's enough space for the summary section
    currentY = this.checkPageBreak(doc, currentY, 100);

    // Summary section
    const summaryY = currentY;
    doc.rect(margin, summaryY, boxWidth, 50).stroke('#3498db');
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('SUMMARY', margin + 10, summaryY + 8);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Total Quantity: ${invoice.totalQuantity.toFixed(2)} kg`, margin + 10, summaryY + 22);
    doc.text(`Total Amount: ₹${invoice.totalAmount.toFixed(2)}`, margin + 10, summaryY + 34);

    // Final Amount Box
    const finalAmountX = margin + boxWidth + 20;
    doc.rect(finalAmountX, summaryY, boxWidth, 50).fill('#27ae60');
    doc.fillColor('#ffffff');
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('FINAL AMOUNT', finalAmountX + boxWidth / 2, summaryY + 8, { align: 'center' });
    doc
      .fontSize(16)
      .text(`₹${invoice.totalAmount.toFixed(2)}`, finalAmountX + boxWidth / 2, summaryY + 25, {
        align: 'center',
      });
    doc.fillColor('#000000');

    currentY = summaryY + 70;

    // Check if there's enough space for the signature section
    currentY = this.checkPageBreak(doc, currentY, 120);

    // Digital Signature Section
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('DIGITAL SIGNATURE & VERIFICATION', margin, currentY);
    currentY += 15;

    // Generate QR code for signature verification
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(digitalSig.qrData, { width: 60, margin: 1 });
      const qrBuffer = Buffer.from(qrCodeDataUrl.replace('data:image/png;base64,', ''), 'base64');

      // Signature box
      doc.rect(margin, currentY, contentWidth, 60).stroke('#bdc3c7');

      // QR Code
      doc.image(qrBuffer, margin + 10, currentY + 5, { width: 50, height: 50 });

      // Signature details
      doc.fontSize(7).font('Helvetica');
      doc.text('Digital Signature:', margin + 70, currentY + 8);
      doc.text(digitalSig.signature.substring(0, 40), margin + 70, currentY + 18);
      doc.text(digitalSig.signature.substring(40, 80), margin + 70, currentY + 26);
      doc.text(`Timestamp: ${digitalSig.timestamp}`, margin + 70, currentY + 38);
      doc.text('Scan QR code to verify authenticity', margin + 70, currentY + 48);

      // Authorized by
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Authorized by:', margin + 350, currentY + 8);
      doc.font('Helvetica');
      doc.text(invoice.createdBy?.name || 'System', margin + 350, currentY + 18);
      doc.text('Biofuel Management System', margin + 350, currentY + 28);
    } catch (error) {
      logger.error('Error generating QR code:', error);
      // Fallback signature without QR code
      doc.rect(margin, currentY, contentWidth, 40).stroke('#bdc3c7');
      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Digital Signature: ${digitalSig.signature.substring(0, 64)}`,
        margin + 10,
        currentY + 8,
      );
      doc.text(`Timestamp: ${digitalSig.timestamp}`, margin + 10, currentY + 20);
      doc.text('Authorized by Biofuel Management System', margin + 10, currentY + 32);
    }

    currentY += 80;

    // Remove footer to prevent extra pages - footer information is already in the digital signature section
  }

  /**
   * Get available entries for invoice generation
   */
  static async getAvailableEntries(req: Request): Promise<{
    entries: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        vendor,
        plant,
        invoiceType,
        startDate,
        endDate,
        page = PaginationDefaults.PAGE,
        limit = PaginationDefaults.LIMIT,
      } = req.query;

      const filter: any = { isActive: true };

      if (vendor) filter.vendor = vendor;
      if (plant) filter.plant = plant;
      if (invoiceType) filter.entryType = invoiceType;

      // Date range filtering
      if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) {
          const start = new Date(startDate as string);
          start.setHours(0, 0, 0, 0); // Start of day
          filter.entryDate.$gte = start;
        }
        if (endDate) {
          const end = new Date(endDate as string);
          end.setHours(23, 59, 59, 999); // End of day
          filter.entryDate.$lte = end;
        }
      }

      // Only show entries that are not already in invoices
      filter._id = { $nin: await this.getEntriesInInvoices() };

      // Check for flagged entries
      filter.flagged = { $ne: true };
      filter.varianceFlag = { $ne: true };

      const skip = (Number(page) - 1) * Number(limit);
      const total = await Invoice.db.models.Entry.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      const entries = await Invoice.db.models.Entry.find(filter)
        .populate('vendor', 'name code')
        .populate('plant', 'name code')
        .populate('vehicle', 'vehicleNumber driverName')
        .populate('materialType', 'name')
        .sort({ entryDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      logger.info(`Retrieved ${entries.length} available entries out of ${total}`);
      return {
        entries: entries as any[],
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      };
    } catch (error) {
      logger.error('Error retrieving available entries:', error);
      throw error;
    }
  }

  /**
   * Get entries that are already in invoices
   */
  private static async getEntriesInInvoices(): Promise<mongoose.Types.ObjectId[]> {
    const invoices = await Invoice.find({ isActive: true }).select('entries');
    const entryIds: mongoose.Types.ObjectId[] = [];
    invoices.forEach((invoice) => {
      entryIds.push(...invoice.entries);
    });
    return entryIds;
  }

  /**
   * Generate invoice from date range and filters
   */
  static async generateInvoiceFromRange(req: Request): Promise<IInvoice> {
    try {
      const {
        vendor,
        plant,
        invoiceType,
        startDate,
        endDate,
        materialRates,
        paletteRates,
        invoiceDate,
        dueDate,
      } = req.body;

      const userId = (req as any).user?.id;
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      // Validate required fields
      if (!vendor || !plant || !invoiceType || !startDate || !endDate) {
        throw new CustomError('Missing required fields', 400);
      }

      // Validate vendor exists
      const vendorDoc = await Invoice.db.models.Vendor.findById(vendor);
      if (!vendorDoc) {
        throw new CustomError('Vendor not found', 404);
      }

      // Validate plant exists
      const plantDoc = await Invoice.db.models.Plant.findById(plant);
      if (!plantDoc) {
        throw new CustomError('Plant not found', 404);
      }

      // Get entries within date range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day

      const entries = await Invoice.db.models.Entry.find({
        vendor,
        plant,
        entryType: invoiceType,
        entryDate: {
          $gte: start,
          $lte: end,
        },
        isActive: true,
        flagged: { $ne: true },
        varianceFlag: { $ne: true },
        _id: { $nin: await this.getEntriesInInvoices() },
      }).populate('materialType', 'name');

      if (entries.length === 0) {
        throw new CustomError('No entries found for the specified criteria', 404);
      }

      // Check for flagged entries
      const flaggedEntries = entries.filter(
        (entry: any) => entry.flagged === true || entry.varianceFlag === true,
      );

      if (flaggedEntries.length > 0) {
        const entryNumbers = flaggedEntries.map((e: any) => e.entryNumber).join(', ');
        throw new CustomError(
          `Cannot create invoice. The following entries are flagged and need to be unflagged first: ${entryNumbers}`,
          400,
        );
      }

      let totalQuantity = 0;
      let totalAmount = 0;
      let materialBreakdown: any[] = [];
      let paletteBreakdown: any = {};
      let validEntries: any[] = []; // For purchase invoices

      if (invoiceType === 'purchase') {
        // Purchase invoice logic
        if (!materialRates || Object.keys(materialRates).length === 0) {
          throw new CustomError('Material rates are required for purchase invoices', 400);
        }

        // Filter entries to only include materials that have rates provided
        validEntries = entries.filter((entry) => {
          if (!entry.materialType) {
            logger.warn(`Entry ${entry.entryNumber} is missing material type, skipping`);
            return false;
          }

          const materialId = String(entry.materialType._id);
          const hasRate = materialRates[materialId];

          if (!hasRate) {
            logger.info(`Skipping material ${entry.materialType.name} - no rate provided`);
            return false;
          }

          return true;
        });

        if (validEntries.length === 0) {
          throw new CustomError(
            'No entries found with the provided material rates. Please check your material rate selection.',
            400,
          );
        }

        // Group entries by material type (only for materials with rates)
        const materialGroups = new Map();

        for (const entry of validEntries) {
          const materialId = String(entry.materialType._id);
          const rate = materialRates[materialId];

          const exactWeight = this.computeWeightForInvoice(entry);

          if (!materialGroups.has(materialId)) {
            materialGroups.set(materialId, {
              materialType: entry.materialType._id,
              materialName: entry.materialType.name,
              totalQuantity: 0,
              totalMoistureQuantity: 0,
              totalDustQuantity: 0,
              finalQuantity: 0,
              rate: rate,
              totalAmount: 0,
              entries: [],
            });
          }

          const group = materialGroups.get(materialId);
          group.totalQuantity += exactWeight;
          group.totalMoistureQuantity += entry.moistureWeight || 0;
          group.totalDustQuantity += entry.dustWeight || 0;
          group.finalQuantity += entry.finalWeight || exactWeight;
          group.totalAmount += (entry.finalWeight || exactWeight) * rate; // Use final weight for amount calculation
          group.entries.push(entry);
        }

        // Convert to array and calculate totals
        materialBreakdown = Array.from(materialGroups.values());
        totalQuantity = materialBreakdown.reduce((sum, item) => sum + item.finalQuantity, 0); // Use final quantity
        totalAmount = materialBreakdown.reduce((sum, item) => sum + item.totalAmount, 0);

        // Log which materials are included/excluded
        const includedMaterials = materialBreakdown.map((item) => item.materialName);
        const excludedMaterials = entries
          .filter((e) => e.materialType && !materialRates[String(e.materialType._id)])
          .map((e) => e.materialType.name);

        if (excludedMaterials.length > 0) {
          logger.info(
            `Materials excluded from invoice (no rates provided): ${excludedMaterials.join(', ')}`,
          );
        }

        logger.info(`Materials included in invoice: ${includedMaterials.join(', ')}`);
        logger.info(`Total entries processed: ${validEntries.length} out of ${entries.length}`);
      } else if (invoiceType === 'sale') {
        // Sale invoice logic
        if (!paletteRates) {
          throw new CustomError('Palette rates are required for sale invoices', 400);
        }

        let totalBags = 0;
        let totalPackedWeight = 0;

        for (const entry of entries) {
          const exactWeight = this.computeWeightForInvoice(entry);
          totalQuantity += exactWeight;

          if (entry.palletteType === 'packed') {
            totalBags += entry.noOfBags || 0;
            totalPackedWeight += entry.packedWeight || 0;
          }
        }

        // Calculate amount based on palette type distribution
        const packedEntries = entries.filter((e: any) => e.palletteType === 'packed');
        const looseEntries = entries.filter((e: any) => e.palletteType === 'loose');

        const packedAmount = packedEntries.reduce((sum, entry) => {
          const weight = this.computeWeightForInvoice(entry);
          return sum + weight * paletteRates.packed;
        }, 0);

        const looseAmount = looseEntries.reduce((sum, entry) => {
          const weight = this.computeWeightForInvoice(entry);
          return sum + weight * paletteRates.loose;
        }, 0);

        totalAmount = packedAmount + looseAmount;

        paletteBreakdown = {
          totalBags,
          weightPerBag: totalBags > 0 ? totalPackedWeight / totalBags : 0,
          totalPackedWeight,
        };
      }

      const invoice = new Invoice({
        vendor,
        plant,
        entries:
          invoiceType === 'purchase' ? validEntries.map((e) => e._id) : entries.map((e) => e._id),
        invoiceType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        materialRates: materialRates,
        paletteRates: paletteRates,
        totalQuantity,
        totalAmount,
        materialBreakdown,
        paletteBreakdown,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        createdBy: userId,
      });

      const savedInvoice = await invoice.save();

      logger.info(`Invoice generated from range: ${savedInvoice.invoiceNumber} by user: ${userId}`);
      return savedInvoice;
    } catch (error) {
      logger.error('Error generating invoice from range:', error);
      throw error;
    }
  }
}
