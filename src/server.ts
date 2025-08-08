// src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectMongo } from './databases/mongo';
import { redisClient } from './databases/redis';
import { env } from './config/env';

// Connect MongoDB
connectMongo(env.DATABASE_URL);

// Connect Redis
redisClient
  .connect()
  .then(() => {
    console.log('Redis connected!');
  })
  .catch((err) => {
    console.error('Redis connection failed:', err);
    process.exit(1);
  });

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
