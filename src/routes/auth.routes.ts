// File: src/routes/auth.routes.ts
import { Router } from 'express';
import { login } from '../controllers/auth.controller';
import { validate } from '@middlewares/validator';
import { loginSchema } from 'validations/auth.schema';

const router = Router();

router.post('/login', validate(loginSchema), login);

export default router;
