/**
 * Request Deduplication Layer
 * Prevents duplicate API calls by caching in-flight requests
 * Returns the same promise for duplicate calls made while a request is pending
 */

interface CachedRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  subscribers: number;
  isComplete: boolean; // Track if request is complete for cleanup safety
}

interface DeduplicationConfig {
  /** Time to keep completed requests cached (ms) */
  cacheTTL: number;
  /** Maximum number of cached requests */
  maxCacheSize: number;
  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  cacheTTL: 5000, // 5 second cache for completed requests (increased from 1s for performance)
  maxCacheSize: 100,
  debug: false,
};

class RequestDeduplicator {
  private cache: Map<string, CachedRequest<unknown>> = new Map();
  private config: DeduplicationConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized: boolean = false;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Don't start cleanup immediately - wait for first use (lazy initialization)
  }

  /**
   * Initialize cleanup timer on first use
   */
  private ensureInitialized(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.startCleanup();

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.stopCleanup();
        this.clear();
      });
    }
  }

  /**
   * Generate a cache key from function name and arguments
   */
  private generateKey(name: string, args: unknown[]): string {
    try {
      return `${name}:${JSON.stringify(args)}`;
    } catch {
      // If args can't be serialized, log warning and use unique key (no dedup)
      if (this.config.debug) {
        window.electronAPI?.log?.warn(`[Dedup] Cannot serialize args for ${name}, skipping dedup`);
      }
      return `${name}:${Date.now()}:${Math.random()}`;
    }
  }

  /**
   * Execute a request with deduplication
   */
  async execute<T>(
    name: string,
    args: unknown[],
    fn: () => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();

    const key = this.generateKey(name, args);
    const existing = this.cache.get(key) as CachedRequest<T> | undefined;

    if (existing) {
      existing.subscribers++;
      if (this.config.debug) {
        window.electronAPI?.log?.debug(`[Dedup] Cache hit for ${name}`, { subscribers: existing.subscribers });
      }
      return existing.promise;
    }

    if (this.config.debug) {
      window.electronAPI?.log?.debug(`[Dedup] New request for ${name}`);
    }

    const promise = fn().finally(() => {
      // After completion, update timestamp and mark complete for TTL
      const cached = this.cache.get(key);
      if (cached) {
        cached.timestamp = Date.now();
        cached.isComplete = true;
      }
    });

    const cached: CachedRequest<T> = {
      promise,
      timestamp: Date.now(),
      subscribers: 1,
      isComplete: false,
    };

    this.cache.set(key, cached as CachedRequest<unknown>);
    this.enforceMaxSize();

    return promise;
  }

  /**
   * Wrap a function with deduplication
   */
  wrap<TArgs extends unknown[], TResult>(
    name: string,
    fn: (...args: TArgs) => Promise<TResult>
  ): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => this.execute(name, args, () => fn(...args));
  }

  /**
   * Invalidate cache for a specific request
   */
  invalidate(name: string, args?: unknown[]): void {
    if (args) {
      const key = this.generateKey(name, args);
      this.cache.delete(key);
    } else {
      // Invalidate all requests with this name - collect keys first to avoid iteration issues
      const keysToDelete = Array.from(this.cache.keys()).filter(key =>
        key.startsWith(`${name}:`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Start periodic cleanup of expired cache entries
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      // Collect keys to delete (only completed requests past TTL)
      const keysToDelete: string[] = [];

      for (const [key, cached] of this.cache.entries()) {
        // Only clean up completed requests that have exceeded TTL
        if (cached.isComplete && now - cached.timestamp > this.config.cacheTTL) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));
    }, this.config.cacheTTL);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Enforce maximum cache size by removing oldest completed entries
   */
  private enforceMaxSize(): void {
    if (this.cache.size <= this.config.maxCacheSize) return;

    // Sort by timestamp and remove oldest completed entries first
    const entries = Array.from(this.cache.entries())
      .filter(([, cached]) => cached.isComplete) // Only consider completed
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize + 1);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const requestDedup = new RequestDeduplicator();

/**
 * Decorator-style helper for deduplicating IPC calls
 */
export function dedupedCall<T>(
  name: string,
  args: unknown[],
  fn: () => Promise<T>
): Promise<T> {
  return requestDedup.execute(name, args, fn);
}

/**
 * Create a deduplicated version of an async function
 */
export function createDedupedFn<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return requestDedup.wrap(name, fn);
}

/**
 * Memoized async function with TTL
 * Different from dedup - this caches results even after completion
 * Includes automatic cleanup of expired entries
 */
const memoCache = new Map<string, { value: unknown; expiry: number }>();
let memoCacheCleanupTimer: ReturnType<typeof setInterval> | null = null;

// Start memo cache cleanup when first used
function ensureMemoCacheCleanup(): void {
  if (memoCacheCleanupTimer) return;

  memoCacheCleanupTimer = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of memoCache.entries()) {
      if (cached.expiry < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => memoCache.delete(key));

    // Stop cleanup if cache is empty
    if (memoCache.size === 0 && memoCacheCleanupTimer) {
      clearInterval(memoCacheCleanupTimer);
      memoCacheCleanupTimer = null;
    }
  }, 5000); // Cleanup every 5 seconds

  // Cleanup on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (memoCacheCleanupTimer) {
        clearInterval(memoCacheCleanupTimer);
        memoCacheCleanupTimer = null;
      }
      memoCache.clear();
    });
  }
}

export function memoizedAsync<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  ttlMs: number = 5000
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    ensureMemoCacheCleanup();

    let key: string;
    try {
      key = `${name}:${JSON.stringify(args)}`;
    } catch {
      // If args can't be serialized, skip memoization
      return fn(...args);
    }

    const cached = memoCache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return cached.value as TResult;
    }

    const result = await fn(...args);
    memoCache.set(key, {
      value: result,
      expiry: Date.now() + ttlMs,
    });

    return result;
  };
}

export default requestDedup;
