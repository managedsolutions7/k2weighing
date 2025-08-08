// File: src/types/auth.types.ts
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: string;
  name: string;
}

interface ValidationError {
  message: string;
  field: string;
}
export interface ErrorResponse {
  error: string | ValidationError[];
}
