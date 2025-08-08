import { IUser } from '../types/user.types';
import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    empId: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'supervisor', 'operator'], required: true },
    isActive: { type: Boolean, default: true },
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant' },
  },
  { timestamps: true },
);

export default mongoose.model<IUser>('User', userSchema);
