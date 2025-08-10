import { z } from 'zod';

const dateStringToDate = z.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) {
    const date = new Date(arg);
    if (!isNaN(date.getTime())) return date;
  }
  return undefined;
}, z.date());

export const createInvoiceSchema = z.object({
  body: z.object({
    vendor: z.string().min(1, 'Vendor ID is required'),
    plant: z.string().min(1, 'Plant ID is required'),
    entries: z
      .array(z.string().min(1, 'Entry ID is required'))
      .min(1, 'At least one entry is required')
      .max(100, 'Too many entries'),
    invoiceDate: dateStringToDate.optional().default(() => new Date()),
    dueDate: dateStringToDate.optional(),
  }),
});

export const updateInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
  body: z.object({
    status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional(),
    dueDate: dateStringToDate.optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        if (val === 'true') return true;
        if (val === 'false') return false;
        // throw error or return undefined if invalid string
        throw new Error('isActive must be "true" or "false"');
      }),
  }),
});

export const getInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});

export const deleteInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});

export const getInvoicesSchema = z.object({
  query: z.object({
    vendor: z.string().optional(),
    plant: z.string().optional(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional(),
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        if (val === 'true') return true;
        if (val === 'false') return false;
        // throw error or return undefined if invalid string
        throw new Error('isActive must be "true" or "false"');
      }),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});

export const generatePdfSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});
