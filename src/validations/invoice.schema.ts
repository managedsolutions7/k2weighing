import { z } from 'zod';
import { ValidationMessages } from '../constants';

export const createInvoiceSchema = z.object({
  body: z.object({
    vendor: z.string().min(1, 'Vendor ID is required'),
    plant: z.string().min(1, 'Plant ID is required'),
    entries: z
      .array(z.string().min(1, 'Entry ID is required'))
      .min(1, 'At least one entry is required')
      .max(100, 'Too many entries'),
    invoiceDate: z
      .string()
      .datetime('Invalid invoice date format')
      .optional()
      .default(() => new Date().toISOString()),
    dueDate: z.string().datetime('Invalid due date format').optional(),
  }),
});

export const updateInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
  body: z.object({
    status: z.enum(['draft', 'sent', 'paid', 'overdue'] as const).optional(),
    dueDate: z.string().datetime('Invalid due date format').optional(),
    isActive: z.boolean().optional(),
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
    status: z.enum(['draft', 'sent', 'paid', 'overdue'] as const).optional(),
    startDate: z.string().datetime('Invalid start date').optional(),
    endDate: z.string().datetime('Invalid end date').optional(),
    isActive: z.boolean().optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});

export const generatePdfSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});
