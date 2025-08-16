import { Request } from 'express';
import Material from '@models/material.model';
import { CacheService } from './cache.service';
import {
  serializeFilters,
  MATERIALS_CACHE_TTL,
  MATERIALS_LIST_KEY,
  MATERIAL_BY_ID_KEY,
} from '@constants/cache.constants';

export class MaterialService {
  static async getMaterials(req: Request) {
    const { isActive, q } = req.query as { isActive?: string | boolean; q?: string };

    const filter: any = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === true || isActive === 'true';
    }
    if (q && typeof q === 'string' && q.trim().length > 0) {
      filter.name = { $regex: new RegExp(q.trim(), 'i') };
    }

    const filterString = serializeFilters({ isActive, q });
    const cacheKey = MATERIALS_LIST_KEY(filterString);

    const materials = await CacheService.getOrSet(cacheKey, MATERIALS_CACHE_TTL, async () => {
      const data = await Material.find(filter).sort({ name: 1 });
      return data.map((m) => ({
        id: m._id,
        name: m.name,
        description: m.description,
        isActive: m.isActive,
      }));
    });
    return materials;
  }

  static async createMaterial(req: Request) {
    const { name, description, isActive } = req.body as {
      name: string;
      description?: string;
      isActive?: boolean;
    };
    const existing = await Material.findOne({ name });
    if (existing) throw new Error('Material name already exists');
    const doc = await Material.create({ name, description, isActive });
    await CacheService.delByPattern('materials:*');
    return { id: doc._id, name: doc.name, description: doc.description, isActive: doc.isActive };
  }

  static async getMaterialById(req: Request) {
    const { id } = req.params;
    const cacheKey = MATERIAL_BY_ID_KEY(id);
    const doc = await CacheService.getOrSet(cacheKey, MATERIALS_CACHE_TTL, async () => {
      const found = await Material.findById(id);
      return found as any;
    });
    if (!doc) throw new Error('Material not found');
    return { id: doc._id, name: doc.name, description: doc.description, isActive: doc.isActive };
  }

  static async updateMaterial(req: Request) {
    const { id } = req.params;
    const { name, description, isActive } = req.body as {
      name?: string;
      description?: string;
      isActive?: boolean;
    };
    if (name) {
      const exists = await Material.findOne({ name, _id: { $ne: id } });
      if (exists) throw new Error('Material name already exists');
    }
    const doc = await Material.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
      },
      { new: true },
    );
    if (!doc) throw new Error('Material not found');
    await CacheService.delByPattern('materials:*');
    return { id: doc._id, name: doc.name, description: doc.description, isActive: doc.isActive };
  }

  static async deleteMaterial(req: Request) {
    const { id } = req.params;
    const doc = await Material.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!doc) throw new Error('Material not found');
    await CacheService.delByPattern('materials:*');
    return { message: 'Material deleted successfully' };
  }
}

export default MaterialService;
