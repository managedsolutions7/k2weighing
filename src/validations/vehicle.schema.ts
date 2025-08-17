import { z } from 'zod';
import { ValidationMessages } from '../constants';

export const createVehicleSchema = z.object({
  body: z.object({
    vehicleNumber: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(20, 'Vehicle number too long'),
    vehicleType: z.enum(['buy', 'sell'] as const),
    capacity: z.number().positive('Capacity must be positive').max(100000, 'Capacity too high'),
    tareWeight: z
      .number()
      .positive('Tare weight must be positive')
      .max(100000, 'Tare too high')
      .optional(),
    driverName: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(100, 'Driver name too long')
      .optional(),
    driverPhone: z
      .string()
      .min(10, ValidationMessages.INVALID_PHONE)
      .max(15, 'Phone number too long')
      .optional(),
  }),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Vehicle ID is required'),
  }),
  body: z.object({
    vehicleNumber: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(20, 'Vehicle number too long')
      .optional(),
    vehicleType: z.enum(['buy', 'sell'] as const).optional(),
    capacity: z
      .number()
      .positive('Capacity must be positive')
      .max(100000, 'Capacity too high')
      .optional(),
    tareWeight: z
      .number()
      .positive('Tare weight must be positive')
      .max(100000, 'Tare too high')
      .optional(),
    driverName: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(100, 'Driver name too long')
      .optional(),
    driverPhone: z
      .string()
      .min(10, ValidationMessages.INVALID_PHONE)
      .max(15, 'Phone number too long')
      .optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getVehicleSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Vehicle ID is required'),
  }),
});

export const deleteVehicleSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Vehicle ID is required'),
  }),
});

export const getVehiclesSchema = z.object({
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
    vehicleType: z.enum(['buy', 'sell'] as const).optional(),
    q: z.string().optional(),
  }),
});
