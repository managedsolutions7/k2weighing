import { z } from 'zod';

const dateStringToDate = z.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) {
    const date = new Date(arg);
    if (!isNaN(date.getTime())) return date;
  }
  return undefined;
}, z.date());

export const summaryReportSchema = z.object({
  query: z.object({
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    vendor: z.string().optional(),
    plant: z.string().optional(),
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
  }),
});

export const detailedReportSchema = z.object({
  query: z.object({
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    vendor: z.string().optional(),
    plant: z.string().optional(),
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
  }),
});

export const vendorReportSchema = z.object({
  query: z.object({
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    plant: z.string().optional(),
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
  }),
});

export const plantReportSchema = z.object({
  query: z.object({
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    vendor: z.string().optional(),
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
  }),
});

export const timeSeriesReportSchema = z.object({
  query: z.object({
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    vendor: z.string().optional(),
    plant: z.string().optional(),
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
    groupBy: z.enum(['day', 'week', 'month'] as const).optional(),
  }),
});

export const exportReportSchema = z.object({
  query: z.object({
    format: z.literal('csv').optional(),
    groupBy: z.enum(['vendor', 'plant'] as const).optional(),
    entryType: z.enum(['purchase', 'sale'] as const).optional(),
    vendor: z.string().optional(),
    plant: z.string().optional(),
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
  }),
});
