import { redisClient } from 'databases/redis';
import logger from '../utils/logger';

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (err) {
      logger.error(`Redis GET error for key: ${key}`, err);
      return null;
    }
  }

  static async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const json = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.setEx(key, ttlSeconds, json);
      } else {
        await redisClient.set(key, json);
      }
    } catch (err) {
      logger.error(`Redis SET error for key: ${key}`, err);
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (err) {
      logger.error(`Redis DEL error for key: ${key}`, err);
    }
  }
}
