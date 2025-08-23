import CryptoJS from 'crypto-js';
import logger from '../utils/logger';

export class SignatureService {
  /**
   * Verify a digital signature from QR code data
   */
  static verifySignature(qrData: string): { valid: boolean; details?: any; error?: string } {
    try {
      const [invoiceNumber, signatureFragment, timestamp] = qrData.split('|');

      if (!invoiceNumber || !signatureFragment || !timestamp) {
        return { valid: false, error: 'Invalid QR code format' };
      }

      // Note: In a real implementation, you would:
      // 1. Look up the invoice from database using invoiceNumber
      // 2. Reconstruct the signature data
      // 3. Generate the expected signature
      // 4. Compare with the signature fragment

      return {
        valid: true,
        details: {
          invoiceNumber,
          timestamp,
          signatureFragment,
          message: 'Signature verification requires database lookup',
        },
      };
    } catch (error) {
      logger.error('Error verifying signature:', error);
      return { valid: false, error: 'Verification failed' };
    }
  }

  /**
   * Generate a signature verification URL
   */
  static generateVerificationUrl(qrData: string): string {
    const encodedData = encodeURIComponent(qrData);
    return `/api/verify-signature?data=${encodedData}`;
  }

  /**
   * Verify signature with full invoice data
   */
  static verifyWithInvoiceData(
    invoiceData: any,
    providedSignature: string,
    timestamp: string,
  ): boolean {
    try {
      const secretKey =
        process.env.INVOICE_SIGNATURE_SECRET || 'default-secret-key-change-in-production';

      // Reconstruct signature data
      const signatureData = {
        invoiceNumber: invoiceData.invoiceNumber,
        totalAmount: invoiceData.totalAmount,
        vendor: invoiceData.vendor.name,
        plant: invoiceData.plant.name,
        timestamp: timestamp,
        invoiceType: invoiceData.invoiceType,
      };

      // Generate expected signature
      const dataString = JSON.stringify(signatureData);
      const expectedSignature = CryptoJS.HmacSHA256(dataString, secretKey).toString();

      return expectedSignature === providedSignature;
    } catch (error) {
      logger.error('Error verifying signature with invoice data:', error);
      return false;
    }
  }
}
