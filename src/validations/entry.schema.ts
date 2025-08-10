import { z } from 'zod';

export const createEntrySchema = z.object({
  body: z.object({
    entryType: z.enum(['purchase', 'sale'] as const),
    vendor: z.string().min(1, 'Vendor ID is required'),
    vehicle: z.string().min(1, 'Vehicle ID is required'),
    plant: z.string().min(1, 'Plant ID is required'),
    quantity: z
      .number()
      .positive('Quantity must be positive')
      .max(1000000, 'Quantity too high')
      .optional(),
    entryWeight: z
      .number()
      .positive('Entry weight must be positive')
      .max(1000000, 'Entry weight too high'),
    rate: z.number().positive('Rate must be positive').max(100000, 'Rate too high'),
    entryDate: z
      .date()
      .optional()
      .default(() => new Date()),
  }),
});

export const updateEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Entry ID is required'),
  }),
  body: z.object({
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    vendor: z.string().min(1, 'Vendor ID is required').optional(),
    vehicle: z.string().min(1, 'Vehicle ID is required').optional(),
    plant: z.string().min(1, 'Plant ID is required').optional(),
    quantity: z
      .number()
      .positive('Quantity must be positive')
      .max(1000000, 'Quantity too high')
      .optional(),
    rate: z.number().positive('Rate must be positive').max(100000, 'Rate too high').optional(),
    entryDate: z.string().datetime('Invalid date format').optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Entry ID is required'),
  }),
});

export const deleteEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Entry ID is required'),
  }),
});

export const updateExitWeightSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Entry ID is required'),
  }),
  body: z.object({
    exitWeight: z
      .number()
      .positive('Exit weight must be positive')
      .max(1000000, 'Exit weight too high'),
  }),
});

export const getEntriesSchema = z.object({
  query: z.object({
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    vendor: z.string().optional(),
    plant: z.string().optional(),
    startDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((date) => !date || !isNaN(date.getTime()), {
        message: 'Invalid start date',
      }),
    endDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((date) => !date || !isNaN(date.getTime()), {
        message: 'Invalid end date',
      }),
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
