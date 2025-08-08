import { z } from 'zod';
import { ValidationMessages } from '../constants';

export const createVendorSchema = z.object({
  body: z.object({
    name: z.string().min(1, ValidationMessages.REQUIRED).max(100, 'Vendor name too long'),
    code: z.string().min(1, ValidationMessages.REQUIRED).max(20, 'Vendor code too long'),
    contactPerson: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(100, 'Contact person name too long'),
    phone: z.string().min(10, ValidationMessages.INVALID_PHONE).max(15, 'Phone number too long'),
    email: z.string().email(ValidationMessages.INVALID_EMAIL),
    address: z.string().min(1, ValidationMessages.REQUIRED).max(500, 'Address too long'),
    gstNumber: z
      .string()
      .min(15, ValidationMessages.INVALID_GST)
      .max(15, ValidationMessages.INVALID_GST),
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
    code: z.string().min(1, ValidationMessages.REQUIRED).max(20, 'Vendor code too long').optional(),
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
    email: z.string().email(ValidationMessages.INVALID_EMAIL).optional(),
    address: z.string().min(1, ValidationMessages.REQUIRED).max(500, 'Address too long').optional(),
    gstNumber: z
      .string()
      .min(15, ValidationMessages.INVALID_GST)
      .max(15, ValidationMessages.INVALID_GST)
      .optional(),
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
