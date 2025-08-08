import mongoose from 'mongoose';
import { Role } from '../constants';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  username: string;
  password: string;
  name: string;
  empId: string;
  role: Role;
  isActive: boolean;
  plantId?: mongoose.Types.ObjectId; // for supervisors
  createdAt: Date;
  updatedAt: Date;
}
