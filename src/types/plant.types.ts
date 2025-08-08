import mongoose from 'mongoose';

export interface IPlant {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  location: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlantRequest {
  name: string;
  code: string;
  location: string;
  address: string;
}

export interface UpdatePlantRequest {
  name?: string;
  code?: string;
  location?: string;
  address?: string;
  isActive?: boolean;
}
