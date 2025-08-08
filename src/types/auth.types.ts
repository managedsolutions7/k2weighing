// File: src/types/auth.types.ts

// Request Types
export interface LoginRequest {
  username: string;
  password: string;
}

import { Role } from '../constants';

export interface RegisterRequest {
  username: string;
  password: string;
  name: string;
  empId: string;
  role: Role;
  plantId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Response Types
export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    refreshToken: string;
    user: {
      id: string;
      username: string;
      name: string;
      role: string;
      empId: string;
      plantId?: string;
    };
  };
  message: string;
}

export interface RegisterResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      username: string;
      name: string;
      role: string;
      empId: string;
      plantId?: string;
    };
  };
  message: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  data: {
    token: string;
  };
  message: string;
}

export interface ProfileResponse {
  success: boolean;
  data: {
    id: string;
    username: string;
    name: string;
    role: string;
    empId: string;
    plantId?: string;
    createdAt: Date;
  };
  message: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  message?: string;
}

// User Profile Type
export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: string;
  empId: string;
  plantId?: string;
  createdAt: Date;
}
