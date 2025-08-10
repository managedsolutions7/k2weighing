import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service';

export const cacheMiddleware = (keyGenerator: (req: Request) => string, ttlSeconds?: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const cachedData = await CacheService.get(key);

      if (cachedData !== null) {
        return res.status(200).json({
          fromCache: true,
          data: cachedData,
        });
      }

      // Monkey-patch res.json to store the response in cache before sending
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        CacheService.set(key, body, ttlSeconds).catch(console.error);
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error('Cache middleware error:', err);
      next(); // proceed without cache
    }
  };
};
