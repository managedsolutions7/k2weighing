import mongoose from 'mongoose';

export type UserRole = 'admin' | 'supervisor' | 'operator';
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId; // explicitly defined to fix TS error
  username: string;
  password: string;
  name: string;
  empId: string;
  role: UserRole;
  isActive: boolean;
  plantId?: mongoose.Types.ObjectId; // for supervisors
}
