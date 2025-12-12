/**
 * Redis Service
 *
 * Real-time caching and statistics
 */

import Redis from 'ioredis';

const REDIS_URL = process.env['REDIS_URL'] || 'redis://localhost:6379';

export function createRedisClient(): Redis {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on('error', (err) => {
    console.error('Redis error:', err);
  });

  redis.on('connect', () => {
    console.log('Redis client connected');
  });

  return redis;
}

// Key patterns
export const REDIS_KEYS = {
  activeUsers: 'nexus:active_users',
  todayUsage: (date: string) => `nexus:usage:${date}`,
  userUsage: (userId: string, date: string) => `nexus:user:${userId}:usage:${date}`,
  modelUsage: (modelId: string, date: string) => `nexus:model:${modelId}:usage:${date}`,
  realtimeStats: 'nexus:realtime_stats',
};

/**
 * Track active user
 */
export async function trackActiveUser(redis: Redis, loginid: string): Promise<void> {
  const now = Date.now();
  await redis.zadd(REDIS_KEYS.activeUsers, now, loginid);
  // Remove users inactive for more than 30 minutes
  const thirtyMinutesAgo = now - 30 * 60 * 1000;
  await redis.zremrangebyscore(REDIS_KEYS.activeUsers, '-inf', thirtyMinutesAgo);
}

/**
 * Get active user count
 */
export async function getActiveUserCount(redis: Redis): Promise<number> {
  const now = Date.now();
  const thirtyMinutesAgo = now - 30 * 60 * 1000;
  return redis.zcount(REDIS_KEYS.activeUsers, thirtyMinutesAgo, '+inf');
}

/**
 * Increment usage counters
 */
export async function incrementUsage(
  redis: Redis,
  userId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!;

  // Use pipeline for atomic operations
  const pipeline = redis.pipeline();

  // Total today's usage
  pipeline.hincrby(REDIS_KEYS.todayUsage(today), 'input_tokens', inputTokens);
  pipeline.hincrby(REDIS_KEYS.todayUsage(today), 'output_tokens', outputTokens);
  pipeline.hincrby(REDIS_KEYS.todayUsage(today), 'request_count', 1);
  pipeline.expire(REDIS_KEYS.todayUsage(today), 86400 * 2); // 2 days TTL

  // Per-user usage
  pipeline.hincrby(REDIS_KEYS.userUsage(userId, today), 'input_tokens', inputTokens);
  pipeline.hincrby(REDIS_KEYS.userUsage(userId, today), 'output_tokens', outputTokens);
  pipeline.hincrby(REDIS_KEYS.userUsage(userId, today), 'request_count', 1);
  pipeline.expire(REDIS_KEYS.userUsage(userId, today), 86400 * 2);

  // Per-model usage
  pipeline.hincrby(REDIS_KEYS.modelUsage(modelId, today), 'input_tokens', inputTokens);
  pipeline.hincrby(REDIS_KEYS.modelUsage(modelId, today), 'output_tokens', outputTokens);
  pipeline.hincrby(REDIS_KEYS.modelUsage(modelId, today), 'request_count', 1);
  pipeline.expire(REDIS_KEYS.modelUsage(modelId, today), 86400 * 2);

  await pipeline.exec();
}

/**
 * Get today's usage stats
 */
export async function getTodayUsage(redis: Redis): Promise<{
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}> {
  const today = new Date().toISOString().split('T')[0]!;
  const stats = await redis.hgetall(REDIS_KEYS.todayUsage(today));

  return {
    inputTokens: parseInt(stats['input_tokens'] || '0', 10),
    outputTokens: parseInt(stats['output_tokens'] || '0', 10),
    requestCount: parseInt(stats['request_count'] || '0', 10),
  };
}
