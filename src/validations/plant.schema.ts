import { z } from 'zod';
import { ValidationMessages } from '../constants';

export const createPlantSchema = z.object({
  body: z.object({
    name: z.string().min(1, ValidationMessages.REQUIRED).max(100, 'Plant name too long'),
    code: z.string().min(1, ValidationMessages.REQUIRED).max(20, 'Plant code too long'),
    location: z.string().min(1, ValidationMessages.REQUIRED).max(200, 'Location too long'),
    address: z.string().min(1, ValidationMessages.REQUIRED).max(500, 'Address too long'),
  }),
});

export const updatePlantSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plant ID is required'),
  }),
  body: z.object({
    name: z.string().min(1, ValidationMessages.REQUIRED).max(100, 'Plant name too long').optional(),
    code: z.string().min(1, ValidationMessages.REQUIRED).max(20, 'Plant code too long').optional(),
    location: z
      .string()
      .min(1, ValidationMessages.REQUIRED)
      .max(200, 'Location too long')
      .optional(),
    address: z.string().min(1, ValidationMessages.REQUIRED).max(500, 'Address too long').optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getPlantSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plant ID is required'),
  }),
});

export const deletePlantSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plant ID is required'),
  }),
});
