export const CACHE_VERSION = 'v1';
const withVersion = (key: string) => `${CACHE_VERSION}:${key}`;
// Plants
const PLANTS_ALL_CACHE_KEY = withVersion('plants:all');
const PLANTS_ACTIVE_CACHE_KEY = withVersion('plants:active');
const PLANTS_INACTIVE_CACHE_KEY = withVersion('plants:inactive');
const PLANT_BY_ID_KEY = (id: string) => withVersion(`plant:${id}`);

const getPlantsCacheKey = (queryParams: any): string => {
  if (queryParams.isActive === 'true') {
    return PLANTS_ACTIVE_CACHE_KEY;
  }
  if (queryParams.isActive === 'false') {
    return PLANTS_INACTIVE_CACHE_KEY;
  }
  return PLANTS_ALL_CACHE_KEY;
};

const PLANTS_CACHE_TTL = 3600; // 1 hour
const PLANT_BY_ID_CACHE_TTL = 3600; // 1 hour

// Vendors
const VENDORS_ALL_CACHE_KEY = withVersion('vendors:all');
const VENDORS_ACTIVE_CACHE_KEY = withVersion('vendors:active');
const VENDORS_INACTIVE_CACHE_KEY = withVersion('vendors:inactive');
const VENDORS_BY_PLANT_ALL_KEY = (plantId: string) => withVersion(`vendors:plant:${plantId}:all`);
const VENDORS_BY_PLANT_ACTIVE_KEY = (plantId: string) =>
  withVersion(`vendors:plant:${plantId}:active`);
const VENDORS_BY_PLANT_INACTIVE_KEY = (plantId: string) =>
  withVersion(`vendors:plant:${plantId}:inactive`);
const VENDOR_BY_ID_KEY = (id: string) => withVersion(`vendor:${id}`);
const VENDOR_BY_FILTERS_KEY = (filters: string) => withVersion(`vendors:filters:${filters}`);

const getVendorsCacheKey = (queryParams: any): string => {
  const { isActive, plantId, q } = queryParams || {};
  if (plantId) {
    if (isActive === 'true') return VENDORS_BY_PLANT_ACTIVE_KEY(plantId);
    if (isActive === 'false') return VENDORS_BY_PLANT_INACTIVE_KEY(plantId);
    return VENDORS_BY_PLANT_ALL_KEY(plantId);
  }
  if (isActive === 'true') return VENDORS_ACTIVE_CACHE_KEY;
  if (isActive === 'false') return VENDORS_INACTIVE_CACHE_KEY;
  if (q) return VENDOR_BY_FILTERS_KEY(String(q).trim());
  return VENDORS_ALL_CACHE_KEY;
};

const VENDORS_CACHE_TTL = 3600; // 1 hour
const VENDOR_BY_ID_CACHE_TTL = 3600; // 1 hour

// Vehicles
const VEHICLES_ALL_CACHE_KEY = withVersion('vehicles:all');
const VEHICLES_ACTIVE_CACHE_KEY = withVersion('vehicles:active');
const VEHICLES_INACTIVE_CACHE_KEY = withVersion('vehicles:inactive');
const VEHICLES_BY_TYPE_ALL_KEY = (vehicleType: string) =>
  withVersion(`vehicles:type:${vehicleType}:all`);
const VEHICLES_BY_TYPE_ACTIVE_KEY = (vehicleType: string) =>
  withVersion(`vehicles:type:${vehicleType}:active`);
const VEHICLES_BY_TYPE_INACTIVE_KEY = (vehicleType: string) =>
  withVersion(`vehicles:type:${vehicleType}:inactive`);
const VEHICLE_BY_ID_KEY = (id: string) => withVersion(`vehicle:${id}`);
const VEHICLE_BY_FILTERS_KEY = (filters: string) => withVersion(`vehicles:filters:${filters}`);

const getVehiclesCacheKey = (queryParams: any): string => {
  const params = queryParams || {};
  const normalizedIsActive =
    params.isActive === true || params.isActive === 'true'
      ? 'true'
      : params.isActive === false || params.isActive === 'false'
        ? 'false'
        : undefined;
  const type = params.vehicleType ? String(params.vehicleType) : undefined;

  if (type) {
    if (normalizedIsActive === 'true') return VEHICLES_BY_TYPE_ACTIVE_KEY(type);
    if (normalizedIsActive === 'false') return VEHICLES_BY_TYPE_INACTIVE_KEY(type);
    return VEHICLES_BY_TYPE_ALL_KEY(type);
  }
  if (normalizedIsActive === 'true') return VEHICLES_ACTIVE_CACHE_KEY;
  if (normalizedIsActive === 'false') return VEHICLES_INACTIVE_CACHE_KEY;
  if (params.q) return VEHICLE_BY_FILTERS_KEY(String(params.q).trim());
  return VEHICLES_ALL_CACHE_KEY;
};

const VEHICLES_CACHE_TTL = 3600; // 1 hour
const VEHICLE_BY_ID_CACHE_TTL = 3600; // 1 hour

// User Profile
const USER_PROFILE_KEY = (userId: string) => withVersion(`users:profile:${userId}`);
const USER_PROFILE_CACHE_TTL = 1800; // 30 minutes

// Reports (short-term cache)
const REPORTS_CACHE_TTL = 600; // 10 minutes
const REPORT_SUMMARY_KEY = (filters: string) => withVersion(`reports:summary:${filters}`);
const REPORT_DETAILED_KEY = (filters: string) => withVersion(`reports:detailed:${filters}`);
const REPORT_VENDOR_KEY = (filters: string) => withVersion(`reports:vendors:${filters}`);
const REPORT_PLANT_KEY = (filters: string) => withVersion(`reports:plants:${filters}`);
const REPORT_TIMESERIES_KEY = (filters: string) => withVersion(`reports:timeseries:${filters}`);

// Entries (purchases/sales) listing
const ENTRIES_CACHE_TTL = 300; // 5 minutes
const ENTRY_BY_ID_CACHE_TTL = 300; // 5 minutes
const ENTRIES_LIST_KEY = (filters: string) => withVersion(`entries:list:${filters}`);
const ENTRY_BY_ID_KEY = (id: string) => withVersion(`entry:${id}`);

// Static data
const STATIC_PLANTS_DROPDOWN_KEY = withVersion('static:plants:dropdown');
const STATIC_VEHICLE_TYPES_KEY = withVersion('static:vehicles:types');
const STATIC_LONG_TTL = 21600; // 6 hours

// Materials
const MATERIALS_CACHE_TTL = 3600; // 1 hour
const MATERIALS_LIST_KEY = (filters: string) => withVersion(`materials:list:${filters}`);
const MATERIAL_BY_ID_KEY = (id: string) => withVersion(`materials:item:${id}`);

// Helper to build stable filter strings
const serializeFilters = (obj: any): string => {
  if (!obj || typeof obj !== 'object') return 'none';
  const keys = Object.keys(obj).sort();
  const normalized: Record<string, string> = {};
  for (const key of keys) {
    const value = (obj as any)[key];
    if (value === undefined) continue;
    normalized[key] = String(value);
  }
  return JSON.stringify(normalized);
};

export {
  // plants
  PLANTS_ALL_CACHE_KEY,
  PLANTS_ACTIVE_CACHE_KEY,
  PLANTS_INACTIVE_CACHE_KEY,
  PLANT_BY_ID_KEY,
  getPlantsCacheKey,
  PLANTS_CACHE_TTL,
  PLANT_BY_ID_CACHE_TTL,
  // vendors
  VENDORS_ALL_CACHE_KEY,
  VENDORS_ACTIVE_CACHE_KEY,
  VENDORS_INACTIVE_CACHE_KEY,
  VENDORS_BY_PLANT_ALL_KEY,
  VENDORS_BY_PLANT_ACTIVE_KEY,
  VENDORS_BY_PLANT_INACTIVE_KEY,
  VENDOR_BY_ID_KEY,
  getVendorsCacheKey,
  VENDORS_CACHE_TTL,
  VENDOR_BY_ID_CACHE_TTL,
  // vehicles
  VEHICLES_ALL_CACHE_KEY,
  VEHICLES_ACTIVE_CACHE_KEY,
  VEHICLES_INACTIVE_CACHE_KEY,
  VEHICLES_BY_TYPE_ALL_KEY,
  VEHICLES_BY_TYPE_ACTIVE_KEY,
  VEHICLES_BY_TYPE_INACTIVE_KEY,
  VEHICLE_BY_ID_KEY,
  getVehiclesCacheKey,
  VEHICLES_CACHE_TTL,
  VEHICLE_BY_ID_CACHE_TTL,
  // user profile
  USER_PROFILE_KEY,
  USER_PROFILE_CACHE_TTL,
  // reports
  REPORTS_CACHE_TTL,
  REPORT_SUMMARY_KEY,
  REPORT_DETAILED_KEY,
  REPORT_VENDOR_KEY,
  REPORT_PLANT_KEY,
  REPORT_TIMESERIES_KEY,
  // entries
  ENTRIES_CACHE_TTL,
  ENTRY_BY_ID_CACHE_TTL,
  ENTRIES_LIST_KEY,
  ENTRY_BY_ID_KEY,
  // static
  STATIC_PLANTS_DROPDOWN_KEY,
  STATIC_VEHICLE_TYPES_KEY,
  STATIC_LONG_TTL,
  // materials
  MATERIALS_CACHE_TTL,
  MATERIALS_LIST_KEY,
  MATERIAL_BY_ID_KEY,
  // helpers
  serializeFilters,
};
