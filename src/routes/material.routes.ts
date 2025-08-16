import { Router } from 'express';
import { verifyToken } from '@middlewares/auth';
import { validate } from '@middlewares/validator';
import {
  getMaterialsSchema,
  createMaterialSchema,
  getMaterialSchema,
  updateMaterialSchema,
  deleteMaterialSchema,
} from '@validations/material.schema';
import { MaterialController } from '@controllers/material.controller';

const router = Router();

router.use(verifyToken);

// GET /api/materials?isActive=true&q=poly
router.get('/', validate(getMaterialsSchema), MaterialController.getMaterials);
router.post('/', validate(createMaterialSchema), MaterialController.createMaterial);
router.get('/:id', validate(getMaterialSchema), MaterialController.getMaterialById);
router.put('/:id', validate(updateMaterialSchema), MaterialController.updateMaterial);
router.delete('/:id', validate(deleteMaterialSchema), MaterialController.deleteMaterial);

export default router;
