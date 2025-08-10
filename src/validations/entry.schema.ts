import { z } from 'zod';

export const createEntrySchema = z.object({
  body: z.object({
    entryType: z.enum(['purchase', 'sale'] as const),
    vendor: z.string().min(1, 'Vendor ID is required'),
    vehicle: z.string().min(1, 'Vehicle ID is required'),
    plant: z.string().min(1, 'Plant ID is required'),
    quantity: z.number().positive('Quantity must be positive').max(1000000, 'Quantity too high'),
    entryWeight: z
      .number()
      .positive('Entry weight must be positive')
      .max(1000000, 'Entry weight too high'),
    rate: z.number().positive('Rate must be positive').max(100000, 'Rate too high'),
    entryDate: z
      .string()
      .datetime('Invalid date format')
      .optional()
      .default(() => new Date().toISOString()),
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
    startDate: z.string().datetime('Invalid start date').optional(),
    endDate: z.string().datetime('Invalid end date').optional(),
    isActive: z.boolean().optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});
