// File: src/validations/auth.schema.ts
import { z } from 'zod';
import { ValidationMessages } from '../constants';

export const loginSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, ValidationMessages.USERNAME_TOO_SHORT)
      .max(50, ValidationMessages.USERNAME_TOO_LONG)
      .trim(),
    password: z
      .string()
      .min(6, ValidationMessages.PASSWORD_TOO_SHORT)
      .max(100, ValidationMessages.PASSWORD_TOO_LONG),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, ValidationMessages.USERNAME_TOO_SHORT)
      .max(50, ValidationMessages.USERNAME_TOO_LONG)
      .trim(),
    password: z
      .string()
      .min(6, ValidationMessages.PASSWORD_TOO_SHORT)
      .max(100, ValidationMessages.PASSWORD_TOO_LONG),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').trim(),
    empId: z
      .string()
      .min(3, 'Employee ID must be at least 3 characters')
      .max(20, 'Employee ID too long')
      .trim(),
    role: z.enum(['admin', 'supervisor', 'operator'] as const),
    plantId: z.string().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(6, ValidationMessages.PASSWORD_TOO_SHORT),
    newPassword: z
      .string()
      .min(6, ValidationMessages.PASSWORD_TOO_SHORT)
      .max(100, ValidationMessages.PASSWORD_TOO_LONG),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    role: z.enum(['admin', 'supervisor', 'operator'] as const).optional(),
    plantId: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});
