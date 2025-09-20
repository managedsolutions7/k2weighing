import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import CryptoJS from 'crypto-js';
import { S3Service } from './s3.service';
import logger from '../utils/logger';

export class HtmlPdfService {
  /**
   * Generate digital signature
   */
  private static generateDigitalSignature(invoice: any): {
    signature: string;
    qrData: string;
    timestamp: string;
  } {
    const timestamp = new Date().toISOString();
    const secretKey = process.env.INVOICE_SIGNATURE_SECRET;

    const signatureData = {
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      vendor: invoice.vendor.name,
      plant: invoice.plant.name,
      timestamp: timestamp,
      invoiceType: invoice.invoiceType,
    };

    const dataString = JSON.stringify(signatureData);
    if (!secretKey) {
      throw new Error('Invoice signature secret key not found');
    }
    const signature = CryptoJS.HmacSHA256(dataString, secretKey).toString();
    const qrData = `${invoice.invoiceNumber}|${signature.substring(0, 16)}|${timestamp}`;

    return { signature, qrData, timestamp };
  }

  /**
   * Format date to DD-MMM-YYYY format
   */
  private static formatDate(date: Date | string | undefined): string {
    if (!date) {
      return 'N/A';
    }

    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }

    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Register Handlebars helpers
   */
  private static registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (date: Date | string | undefined) => {
      return HtmlPdfService.formatDate(date);
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });
  }

  /**
   * Generate PDF using HTML template
   */
  static async generateInvoicePdf(invoice: any): Promise<{ pdfPath: string; downloadUrl: string }> {
    try {
      // Register helpers first
      this.registerHelpers();

      // Generate digital signature
      const digitalSig = this.generateDigitalSignature(invoice);

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(digitalSig.qrData, { width: 60, margin: 1 });

      // Calculate GST details
      let gstDetails = null;
      let grandTotal = invoice.totalAmount;
      let cgstRate = 0;
      let sgstRate = 0;

      if (invoice.gstApplicable && invoice.gstRate && invoice.gstType) {
        const { calculateGST } = await import('./gst.util');
        gstDetails = calculateGST({
          taxableAmount: invoice.totalAmount,
          gstApplicable: invoice.gstApplicable,
          gstType: invoice.gstType,
          gstRate: invoice.gstRate,
        });
        grandTotal = gstDetails.grandTotal;

        if (invoice.gstType === 'CGST_SGST') {
          cgstRate = invoice.gstRate / 2;
          sgstRate = invoice.gstRate / 2;
        }
      }

      // Convert Mongoose document to plain object
      const invoiceData = invoice.toObject ? invoice.toObject() : invoice;

      // Prepare template data
      const templateData = {
        ...invoiceData,
        gstDetails,
        grandTotal,
        finalAmount: invoiceData.finalAmount || grandTotal, // Use finalAmount from DB or fallback to grandTotal
        cgstRate,
        sgstRate,
        totalGST: gstDetails?.totalGST || 0,
        signature: digitalSig.signature,
        qrCodeDataUrl,
        timestamp: digitalSig.timestamp,
        generatedAt: new Date(),
        // Ensure dates are properly formatted
        invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : new Date(),
        startDate: invoiceData.startDate ? new Date(invoiceData.startDate) : new Date(),
        endDate: invoiceData.endDate ? new Date(invoiceData.endDate) : new Date(),
      };

      // Load and compile template
      const templatePath = path.join(__dirname, '../templates/invoice.hbs');

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      const templateSource = fs.readFileSync(templatePath, 'utf8');

      let template, html;
      try {
        template = Handlebars.compile(templateSource);
        html = template(templateData);
      } catch (error) {
        logger.error('Template compilation error:', error);
        throw new Error(
          `Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Generate PDF with Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
        printBackground: true,
      });

      await browser.close();

      // Upload to S3
      const key = S3Service.buildKey(['invoices', `${invoice.invoiceNumber}.pdf`]);
      await S3Service.putObject(key, pdfBuffer, 'application/pdf');

      logger.info(`HTML PDF generated and uploaded for invoice: ${invoice.invoiceNumber}`);
      return { pdfPath: key, downloadUrl: `/api/invoices/${invoice._id}/download` };
    } catch (error) {
      logger.error('Error generating HTML PDF:', error);
      throw error;
    }
  }
}
