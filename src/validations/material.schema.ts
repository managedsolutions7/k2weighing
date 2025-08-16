import { z } from 'zod';

export const getMaterialsSchema = z.object({
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
    q: z.string().min(1).optional(),
  }),
});

export const createMaterialSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getMaterialSchema = z.object({
  params: z.object({ id: z.string().min(1, 'Material ID is required') }),
});

export const updateMaterialSchema = z.object({
  params: z.object({ id: z.string().min(1, 'Material ID is required') }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const deleteMaterialSchema = z.object({
  params: z.object({ id: z.string().min(1, 'Material ID is required') }),
});
