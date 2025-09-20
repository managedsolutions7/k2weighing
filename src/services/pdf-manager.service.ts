import { S3Service } from './s3.service';
import logger from '../utils/logger';

export class PdfManagerService {
  /**
   * Delete a PDF from S3 and return success status
   */
  static async deletePdf(pdfPath: string | null | undefined): Promise<boolean> {
    if (!pdfPath) {
      return true; // No PDF to delete
    }

    try {
      await S3Service.deleteObject(pdfPath);
      logger.info(`PDF deleted from S3: ${pdfPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete PDF from S3: ${pdfPath}`, error);
      return false;
    }
  }

  /**
   * Clean up old PDF and update entry with new PDF path
   */
  static async updateEntryPdf(
    entryId: string,
    newPdfPath: string,
    oldPdfPath?: string | null,
  ): Promise<void> {
    try {
      // Delete old PDF if it exists
      if (oldPdfPath) {
        await this.deletePdf(oldPdfPath);
      }

      // Update entry with new PDF path
      const Entry = (await import('../models/entry.model')).default;
      await Entry.findByIdAndUpdate(entryId, { pdfPath: newPdfPath });

      logger.info(`Entry PDF updated: ${entryId} -> ${newPdfPath}`);
    } catch (error) {
      logger.error(`Failed to update entry PDF: ${entryId}`, error);
      throw error;
    }
  }

  /**
   * Clean up old PDF and update invoice with new PDF path
   */
  static async updateInvoicePdf(
    invoiceId: string,
    newPdfPath: string,
    oldPdfPath?: string | null,
  ): Promise<void> {
    try {
      // Delete old PDF if it exists
      if (oldPdfPath) {
        await this.deletePdf(oldPdfPath);
      }

      // Update invoice with new PDF path
      const Invoice = (await import('../models/invoice.model')).default;
      await Invoice.findByIdAndUpdate(invoiceId, { pdfPath: newPdfPath });

      logger.info(`Invoice PDF updated: ${invoiceId} -> ${newPdfPath}`);
    } catch (error) {
      logger.error(`Failed to update invoice PDF: ${invoiceId}`, error);
      throw error;
    }
  }

  /**
   * Invalidate entry PDF (set path to null and delete from S3)
   */
  static async invalidateEntryPdf(entryId: string): Promise<void> {
    try {
      const Entry = (await import('../models/entry.model')).default;
      const entry = await Entry.findById(entryId);

      if (entry?.pdfPath) {
        await this.deletePdf(entry.pdfPath);
        await Entry.findByIdAndUpdate(entryId, { pdfPath: null });
        logger.info(`Entry PDF invalidated: ${entryId}`);
      }
    } catch (error) {
      logger.error(`Failed to invalidate entry PDF: ${entryId}`, error);
      throw error;
    }
  }

  /**
   * Invalidate invoice PDF (set path to null and delete from S3)
   */
  static async invalidateInvoicePdf(invoiceId: string): Promise<void> {
    try {
      const Invoice = (await import('../models/invoice.model')).default;
      const invoice = await Invoice.findById(invoiceId);

      if (invoice?.pdfPath) {
        await this.deletePdf(invoice.pdfPath);
        await Invoice.findByIdAndUpdate(invoiceId, { pdfPath: null });
        logger.info(`Invoice PDF invalidated: ${invoiceId}`);
      }
    } catch (error) {
      logger.error(`Failed to invalidate invoice PDF: ${invoiceId}`, error);
      throw error;
    }
  }
}
