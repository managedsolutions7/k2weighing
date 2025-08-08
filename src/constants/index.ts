// src/constants/index.ts

export enum Role {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  OPERATOR = 'operator',
}

export enum EntryType {
  PURCHASE = 'purchase',
  SALE = 'sale',
}

export enum VehicleType {
  BUY = 'buy',
  SELL = 'sell',
}

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const ErrorMessages = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  DUPLICATE_ENTRY: 'Duplicate entry',
  INVALID_TOKEN: 'Invalid token',
  TOKEN_EXPIRED: 'Token expired',
} as const;

export const SuccessMessages = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_CHANGED: 'Password changed successfully',
} as const;

export const ValidationMessages = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PHONE: 'Invalid phone number',
  INVALID_GST: 'Invalid GST number',
  PASSWORD_TOO_SHORT: 'Password must be at least 6 characters',
  PASSWORD_TOO_LONG: 'Password too long',
  USERNAME_TOO_SHORT: 'Username must be at least 3 characters',
  USERNAME_TOO_LONG: 'Username too long',
  VEHICLE_NUMBER_EXISTS: 'Vehicle number already exists',
  VENDOR_CODE_EXISTS: 'Vendor code already exists',
  PLANT_CODE_EXISTS: 'Plant code already exists',
  GST_EXISTS: 'GST number already exists',
} as const;

export const PaginationDefaults = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const TokenExpiry = {
  ACCESS_TOKEN: '7d',
  REFRESH_TOKEN: '30d',
} as const;
