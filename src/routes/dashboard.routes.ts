import { Router } from 'express';
import { DashboardController } from '@controllers/dashboard.controller';
import { verifyToken } from '@middlewares/auth';
import { allowRoles } from '@middlewares/roleGuard';
import { validate } from '@middlewares/validator';
import { dashboardQuerySchema } from '@validations/dashboard.schema';

const router = Router();

router.use(verifyToken);

router.get(
  '/admin',
  allowRoles('admin'),
  validate(dashboardQuerySchema),
  DashboardController.admin,
);
router.get(
  '/supervisor',
  allowRoles('admin', 'supervisor'),
  validate(dashboardQuerySchema),
  DashboardController.supervisor,
);
router.get(
  '/operator',
  allowRoles('admin', 'supervisor', 'operator'),
  validate(dashboardQuerySchema),
  DashboardController.operator,
);

export default router;
