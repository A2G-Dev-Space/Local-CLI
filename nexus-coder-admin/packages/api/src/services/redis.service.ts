/**
 * Redis Service
 *
 * Handles Redis connection and caching operations
 */

import Redis from 'ioredis';

/**
 * Create Redis client with configuration
 */
export function createRedisClient(): Redis {
  const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  client.on('error', (err) => {
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
 * Record user activity
 */
export async function recordUserActivity(redis: Redis, userId: string): Promise<void> {
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
 * Increment today's usage stats
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
