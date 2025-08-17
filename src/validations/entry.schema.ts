import { z } from 'zod';

export const createEntrySchema = z.object({
  body: z.object({
    entryType: z.enum(['purchase', 'sale'] as const),
    vendor: z.string().min(1, 'Vendor ID is required'),
    vehicle: z.string().min(1, 'Vehicle ID is required'),
    // plant is derived from operator's profile (server-side)
    plant: z.string().optional(),
    quantity: z.number().min(0).max(1000000).optional(),
    entryWeight: z.number().positive('Entry weight must be positive').max(1000000),
    manualWeight: z.boolean().optional().default(false),
    // rate is invoice-level; not part of entry create
    rate: z.number().optional(),
    entryDate: z
      .date()
      .optional()
      .default(() => new Date()),
    // New sale fields (optional at creation; finalized on exit)
    palletteType: z.enum(['loose', 'packed']).optional(),
    noOfBags: z.number().positive().optional(),
    weightPerBag: z.number().positive().optional(),
    packedWeight: z.number().positive().optional(),
    // New purchase field
    materialType: z.string().optional(),
    // Optional at create; mainly applied on exit for purchase
    moisture: z.number().min(0).max(100).optional(),
    dust: z.number().min(0).max(100).optional(),
    driverName: z.string().min(1, 'Driver name is required').max(100, 'Driver name too long'),
    driverPhone: z
      .string()
      .min(10, 'Invalid driver phone')
      .max(15, 'Driver phone too long')
      .optional(),
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
    isReviewed: z.boolean().optional(),
    reviewedBy: z.string().nullable().optional(),
    reviewedAt: z.string().datetime('Invalid date').nullable().optional(),
    reviewNotes: z.string().max(1000).nullable().optional(),
    flagged: z.boolean().optional(),
    flagReason: z.string().max(500).nullable().optional(),
    driverName: z.string().max(100).optional(),
    driverPhone: z
      .string()
      .min(10, 'Invalid driver phone')
      .max(15, 'Driver phone too long')
      .optional(),
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
    palletteType: z.enum(['loose', 'packed']).optional(),
    noOfBags: z.number().positive().optional(),
    weightPerBag: z.number().positive().optional(),
    // Purchase quality inputs on exit
    moisture: z.number().min(0).max(100).optional(),
    dust: z.number().min(0).max(100).optional(),
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
    flagged: z
      .string()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        if (val === 'true') return true;
        if (val === 'false') return false;
        throw new Error('flagged must be "true" or "false"');
      }),
    isReviewed: z
      .string()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        if (val === 'true') return true;
        if (val === 'false') return false;
        throw new Error('isReviewed must be "true" or "false"');
      }),
    q: z.string().optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});

export const reviewEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Entry ID is required'),
  }),
  body: z.object({
    isReviewed: z.boolean(),
    reviewNotes: z.string().max(1000).nullable().optional(),
  }),
});

export const flagEntrySchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Entry ID is required'),
  }),
  body: z.object({
    flagged: z.boolean(),
    flagReason: z.string().max(500).nullable().optional(),
  }),
});
