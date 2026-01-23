/**
 * Redis Service
 *
 * Handles Redis connection and caching operations
 */

import { Redis } from 'ioredis';

/**
 * Create Redis client with configuration
 */
export function createRedisClient(): Redis {
  const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  client.on('error', (err: Error) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
  });

  return client;
}

/**
 * Get active user count (users active in last 5 minutes)
 */
export async function getActiveUserCount(redis: Redis): Promise<number> {
  const key = 'active_users';
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  // Remove old entries
  await redis.zremrangebyscore(key, 0, fiveMinutesAgo);

  // Count remaining
  return redis.zcard(key);
}

/**
 * Track active user (record user activity)
 */
export async function trackActiveUser(redis: Redis, userId: string): Promise<void> {
  const key = 'active_users';
  await redis.zadd(key, Date.now(), userId);
}

/**
 * Get today's usage stats
 */
export async function getTodayUsage(redis: Redis): Promise<{
  requests: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const key = `daily_usage:${today}`;

  const data = await redis.hgetall(key);

  return {
    requests: parseInt(data['requests'] || '0', 10),
    inputTokens: parseInt(data['inputTokens'] || '0', 10),
    outputTokens: parseInt(data['outputTokens'] || '0', 10),
  };
}

/**
 * Increment usage stats (per user/model and daily total)
 */
export async function incrementUsage(
  redis: Redis,
  userId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `daily_usage:${today}`;
  const userKey = `user_usage:${userId}:${today}`;
  const modelKey = `model_usage:${modelId}:${today}`;

  // Daily total
  await redis.hincrby(dailyKey, 'requests', 1);
  await redis.hincrby(dailyKey, 'inputTokens', inputTokens);
  await redis.hincrby(dailyKey, 'outputTokens', outputTokens);
  await redis.expire(dailyKey, 7 * 24 * 60 * 60);

  // Per user
  await redis.hincrby(userKey, 'requests', 1);
  await redis.hincrby(userKey, 'inputTokens', inputTokens);
  await redis.hincrby(userKey, 'outputTokens', outputTokens);
  await redis.expire(userKey, 7 * 24 * 60 * 60);

  // Per model
  await redis.hincrby(modelKey, 'requests', 1);
  await redis.hincrby(modelKey, 'inputTokens', inputTokens);
  await redis.hincrby(modelKey, 'outputTokens', outputTokens);
  await redis.expire(modelKey, 7 * 24 * 60 * 60);
}

/**
 * Increment today's usage stats (legacy function for compatibility)
 */
export async function incrementTodayUsage(
  redis: Redis,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `daily_usage:${today}`;

  await redis.hincrby(key, 'requests', 1);
  await redis.hincrby(key, 'inputTokens', inputTokens);
  await redis.hincrby(key, 'outputTokens', outputTokens);

  // Set expiry to 7 days
  await redis.expire(key, 7 * 24 * 60 * 60);
}
