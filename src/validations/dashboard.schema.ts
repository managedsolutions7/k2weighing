import { z } from 'zod';

const dateStringToDate = z.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) {
    const date = new Date(arg);
    if (!isNaN(date.getTime())) return date;
  }
  return undefined;
}, z.date());

export const dashboardQuerySchema = z.object({
  query: z.object({
    startDate: dateStringToDate.optional(),
    endDate: dateStringToDate.optional(),
    topVendorsLimit: z.string().transform(Number).optional(),
    recentEntriesLimit: z.string().transform(Number).optional(),
    recentInvoicesLimit: z.string().transform(Number).optional(),
  }),
});
