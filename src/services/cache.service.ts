import { redisClient } from 'databases/redis';
import logger from '../utils/logger';
import { env } from '@config/env';
import { CACHE_VERSION } from '@constants/cache.constants';

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

  static async delByPattern(pattern: string): Promise<void> {
    try {
      const effectivePattern = pattern.startsWith(`${CACHE_VERSION}:`)
        ? pattern
        : `${CACHE_VERSION}:${pattern}`;
      const batchSize = 100;
      let cursor = '0';
      let totalDeleted = 0;
      do {
        const reply = (await (redisClient as any).scan(cursor, {
          MATCH: effectivePattern,
          COUNT: batchSize,
        })) as { cursor: string; keys: string[] } | [string, string[]];

        let nextCursor: string;
        let keys: string[];
        if (Array.isArray(reply)) {
          nextCursor = reply[0];
          keys = reply[1];
        } else {
          nextCursor = reply.cursor;
          keys = reply.keys;
        }

        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await (redisClient as any).del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      if (env.CACHE_LOGGING) {
        logger.info(`[CACHE INVALIDATE] pattern=${pattern} deleted=${totalDeleted}`);
      }
    } catch (err) {
      logger.error(`Redis DEL pattern error for pattern: ${pattern}`, err);
    }
  }

  static async getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        if (env.CACHE_LOGGING) logger.info(`[CACHE HIT] ${key}`);
        return cached;
      }
      const value = await fetchFn();
      if (env.CACHE_LOGGING) {
        const sizeBytes = Buffer.byteLength(JSON.stringify(value));
        logger.info(`[CACHE MISS] ${key} | ttl=${ttlSeconds}s | size=${sizeBytes}B`);
      }
      await this.set(key, value, ttlSeconds);
      return value;
    } catch (err) {
      logger.error(`getOrSet error for key: ${key}`, err);
      // In case of cache error, fallback to direct fetch
      return fetchFn();
    }
  }

  static async ttl(key: string): Promise<number | null> {
    try {
      const ttl = await (redisClient as any).ttl(key);
      return typeof ttl === 'number' ? ttl : null;
    } catch (err) {
      logger.error(`Redis TTL error for key: ${key}`, err);
      return null;
    }
  }

  static async invalidateListAndItems(
    listKey: string,
    itemKeyFn: (id: string) => string,
    ids: string[],
  ): Promise<void> {
    try {
      const keysToDelete: string[] = [listKey, ...ids.map((id) => itemKeyFn(id))];
      const deletedCount = await (redisClient as any).del(...keysToDelete);
      if (env.CACHE_LOGGING) {
        logger.info(`[CACHE INVALIDATE] list+items deleted=${deletedCount}`);
      }
    } catch (err) {
      logger.error('invalidateListAndItems error', err);
    }
  }
}
