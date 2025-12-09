/**
 * Cache Tests
 */

import { Cache, createCacheKey, CachePresets } from '../src/utils/cache';

describe('Cache', () => {
  let cache: Cache<string, string>;

  beforeEach(() => {
    cache = new Cache({ maxSize: 3, ttl: 1000, enableStats: true });
  });

  test('should set and get value', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('should return undefined for non-existent key', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  test('should evict LRU when maxSize reached', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  test('should respect TTL', async () => {
    cache.set('key1', 'value1', 100); // 100ms TTL

    expect(cache.get('key1')).toBe('value1');

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get('key1')).toBeUndefined();
  });

  test('should update LRU on access', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    cache.get('key1'); // Access key1, making it most recently used

    cache.set('key4', 'value4'); // Should evict key2 (not key1)

    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeUndefined();
  });

  test('should track statistics', () => {
    cache.set('key1', 'value1');
    cache.get('key1'); // hit
    cache.get('key2'); // miss

    const stats = cache.getStats();

    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  test('should delete value', () => {
    cache.set('key1', 'value1');
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
  });

  test('should clear cache', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  test('should check if key exists', () => {
    cache.set('key1', 'value1');

    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
  });

  test('should clean expired entries', async () => {
    cache.set('key1', 'value1', 100);
    cache.set('key2', 'value2', 1000);

    await new Promise(resolve => setTimeout(resolve, 150));

    const cleaned = cache.cleanExpired();

    expect(cleaned).toBe(1);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
  });
});

describe('createCacheKey', () => {
  test('should create key from primitives', () => {
    const key = createCacheKey('user', 123, 'profile');
    expect(key).toBe('user:123:profile');
  });

  test('should handle objects', () => {
    const key = createCacheKey('user', { id: 123 });
    expect(key).toContain('{"id":123}');
  });
});

describe('CachePresets', () => {
  test('should have llm preset', () => {
    expect(CachePresets.llm).toHaveProperty('maxSize');
    expect(CachePresets.llm).toHaveProperty('ttl');
  });
});
