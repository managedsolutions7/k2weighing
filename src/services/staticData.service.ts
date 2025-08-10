import Plant from '@models/plant.model';
import { CacheService } from './cache.service';
import {
  STATIC_LONG_TTL,
  STATIC_PLANTS_DROPDOWN_KEY,
  STATIC_VEHICLE_TYPES_KEY,
} from '@constants/cache.constants';

export class StaticDataService {
  static async getPlantsDropdown(): Promise<Array<{ _id: string; name: string }>> {
    return CacheService.getOrSet<Array<{ _id: string; name: string }>>(
      STATIC_PLANTS_DROPDOWN_KEY,
      STATIC_LONG_TTL,
      async () => {
        const plants = await Plant.find({ isActive: true }).select('name');
        return plants.map((p) => ({ _id: p._id.toString(), name: p.name }));
      },
    );
  }

  static async getVehicleTypes(): Promise<string[]> {
    return CacheService.getOrSet<string[]>(STATIC_VEHICLE_TYPES_KEY, STATIC_LONG_TTL, async () => [
      'buy',
      'sell',
    ]);
  }
}

export default StaticDataService;
