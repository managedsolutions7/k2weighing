// File: src/controllers/auth.controller.ts
import { Request, Response } from 'express';

import User from '../models/user.model';
import { loginSchema } from '../validations/auth.schema';
import { ErrorResponse, LoginRequest, LoginResponse } from '../types/auth.types';
import { comparePasswords } from '@services/hash.service';
import { signAccessToken } from '@services/token.service';
import { IUser } from '../types/user.types';

export const login = async (
  req: Request<unknown, unknown, LoginRequest>,
  res: Response<LoginResponse | ErrorResponse>,
) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues });
  }

  const { username, password } = parse.data;

  const user = (await User.findOne({ username })) as IUser | null;
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await comparePasswords(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signAccessToken(user?._id.toString(), user?.role);
  res.status(200).json({ token, role: user.role, name: user.name });
};
