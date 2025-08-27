// src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectMongo } from './databases/mongo';
import { redisClient } from './databases/redis';
import { env } from './config/env';
import StaticDataService from './services/staticData.service';
import logger from '@utils/logger';

// Connect MongoDB
connectMongo(env.DATABASE_URL);

// Connect Redis
redisClient
  .connect()
  .then(async () => {
    console.log('Redis connected!');
    // Cache warm-up
    try {
      await StaticDataService.getPlantsDropdown();
      await StaticDataService.getVehicleTypes();
      if (env.CACHE_LOGGING) {
        logger.info('[CACHE WARMUP] static caches preloaded');
      }
    } catch (e) {
      console.error('Cache warmup failed', e);
    }
  })
  .catch((err) => {
    console.error('Redis connection failed:', err);
    process.exit(1);
  });

const PORT = env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
