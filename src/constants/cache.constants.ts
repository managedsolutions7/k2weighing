const PLANTS_ALL_CACHE_KEY = 'plants:all';
const PLANTS_ACTIVE_CACHE_KEY = 'plants:active';
const PLANTS_INACTIVE_CACHE_KEY = 'plants:inactive';
const PLANT_BY_ID_KEY = (id: string) => `plant:${id}`;

const getPlantsCacheKey = (queryParams: any): string => {
  if (queryParams.isActive === 'true') {
    return PLANTS_ACTIVE_CACHE_KEY;
  }
  if (queryParams.isActive === 'false') {
    return PLANTS_INACTIVE_CACHE_KEY;
  }
  return PLANTS_ALL_CACHE_KEY;
};

const PLANTS_CACHE_TTL = 3600;
const PLANT_BY_ID_CACHE_TTL = 3600;

export {
  PLANTS_ALL_CACHE_KEY,
  PLANTS_ACTIVE_CACHE_KEY,
  PLANTS_INACTIVE_CACHE_KEY,
  PLANT_BY_ID_KEY,
  getPlantsCacheKey,
  PLANTS_CACHE_TTL,
  PLANT_BY_ID_CACHE_TTL,
};
