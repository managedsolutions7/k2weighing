import { z } from 'zod';
import { ValidationMessages } from '../constants';

export const createVendorSchema = z.object({
  body: z.object({
    name: z.string().min(1, ValidationMessages.REQUIRED).max(100, 'Vendor name too long'),
    code: z
      .string()
      .max(20, 'Vendor code too long')
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
    contactPerson: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(100, 'Contact person name too long'),
    phone: z.string().min(10, ValidationMessages.INVALID_PHONE).max(15, 'Phone number too long'),
    email: z.preprocess(
      (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
      z.email(ValidationMessages.INVALID_EMAIL).optional(),
    ),
    address: z.string().min(1, ValidationMessages.REQUIRED).max(500, 'Address too long'),
    gstNumber: z.preprocess(
      (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
      z
        .string()
        .min(15, ValidationMessages.INVALID_GST)
        .max(15, ValidationMessages.INVALID_GST)
        .optional(),
    ),
    linkedPlants: z.array(z.string().min(1, 'Plant ID is required')),
  }),
});

export const updateVendorSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Vendor ID is required'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(100, 'Vendor name too long')
      .optional(),
    code: z
      .string()
      .max(20, 'Vendor code too long')
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
    contactPerson: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(100, 'Contact person name too long')
      .optional(),
    phone: z
      .string()
      .min(10, ValidationMessages.INVALID_PHONE)
      .max(15, 'Phone number too long')
      .optional(),
    email: z.preprocess(
      (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
      z.string().email(ValidationMessages.INVALID_EMAIL).optional(),
    ),
    address: z.string().min(1, ValidationMessages.REQUIRED).max(500, 'Address too long').optional(),
    gstNumber: z.preprocess(
      (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
      z
        .string()
        .min(15, ValidationMessages.INVALID_GST)
        .max(15, ValidationMessages.INVALID_GST)
        .optional(),
    ),
    linkedPlants: z.array(z.string().min(1, 'Plant ID is required')).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getVendorSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Vendor ID is required'),
  }),
});

export const deleteVendorSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Vendor ID is required'),
  }),
});

export const getVendorsSchema = z.object({
  query: z.object({
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        if (val === 'true') return true;
        if (val === 'false') return false;
        throw new Error('isActive must be "true" or "false"');
      }),
    plantId: z.string().optional(),
    q: z.string().optional(),
  }),
});
