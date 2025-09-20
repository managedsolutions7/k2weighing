import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import * as CryptoJS from 'crypto-js';
import * as QRCode from 'qrcode';
import logger from '../utils/logger';
import { S3Service } from './s3.service';

export class EntryHtmlPdfService {
  /**
   * Generate entry receipt PDF using Handlebars template
   */
  static async generateEntryReceiptPdf(
    entry: any,
  ): Promise<{ pdfPath: string; downloadUrl: string }> {
    try {
      // Register Handlebars helpers
      this.registerHelpers();

      // Convert Mongoose document to plain object
      const entryData = entry.toObject ? entry.toObject() : entry;

      // Generate digital signature
      const digitalSig = this.generateDigitalSignature(entryData);

      // Generate QR code data URL
      const qrCodeDataUrl = await this.generateQRCode(digitalSig.qrData);

      // Prepare template data
      const templateData = {
        ...entryData,
        signature: digitalSig.signature,
        qrCodeDataUrl,
        timestamp: digitalSig.timestamp,
        generatedAt: new Date(),
        // Ensure dates are properly formatted
        entryDate: entryData.entryDate ? new Date(entryData.entryDate) : new Date(),
      };

      // Load and compile template
      const templatePath = path.join(__dirname, '../templates/entry-receipt.hbs');

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

      // Set A4 page size
      await page.setViewport({ width: 794, height: 1123 }); // A4 dimensions in pixels

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm',
        },
      });

      await browser.close();

      // Upload to S3
      const filename = `${entryData.entryNumber}-receipt.pdf`;
      const s3Key = S3Service.buildKey(['receipts', filename]);
      await S3Service.putObject(s3Key, pdfBuffer, 'application/pdf');

      const downloadUrl = await S3Service.getPresignedGetUrl(s3Key, 3600); // 1 hour expiry

      logger.info(`Entry receipt PDF generated and uploaded: ${filename}`);

      return {
        pdfPath: s3Key,
        downloadUrl,
      };
    } catch (error) {
      logger.error('Error generating entry receipt PDF:', error);
      throw error;
    }
  }

  /**
   * Generate digital signature for entry
   */
  private static generateDigitalSignature(entry: any): {
    signature: string;
    qrData: string;
    timestamp: string;
  } {
    const timestamp = new Date().toISOString();
    const secretKey = process.env.INVOICE_SIGNATURE_SECRET;

    const signatureData = {
      entryNumber: entry.entryNumber,
      entryType: entry.entryType,
      entryDate: entry.entryDate,
      vendor: entry.vendor?.name || 'Unknown',
      plant: entry.plant?.name || 'Unknown',
      vehicle: entry.vehicle?.vehicleNumber || 'Unknown',
      totalAmount: entry.totalAmount || 0,
    };

    const dataString = JSON.stringify(signatureData);
    if (!secretKey) {
      throw new Error('Invoice signature secret key not found');
    }
    const signature = CryptoJS.HmacSHA256(dataString, secretKey).toString();
    const qrData = `${entry.entryNumber}|${signature.substring(0, 16)}|${timestamp}`;

    return { signature, qrData, timestamp };
  }

  /**
   * Generate QR code data URL
   */
  private static async generateQRCode(qrData: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return qrCodeDataUrl;
    } catch (error) {
      logger.error('Error generating QR code:', error);
      return '';
    }
  }

  /**
   * Register Handlebars helpers
   */
  private static registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (date: Date | string | undefined) => {
      return EntryHtmlPdfService.formatDate(date);
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
  }

  /**
   * Format date to DD-MMM-YYYY
   */
  private static formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';

    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (isNaN(dateObj.getTime())) return 'N/A';

    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = dateObj.getFullYear();

    return `${day}-${month}-${year}`;
  }
}
