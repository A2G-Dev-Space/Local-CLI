/**
 * IPC Batcher - Batches multiple IPC calls into single requests
 * Reduces IPC overhead by combining calls within a time window
 */

type BatchedCall<T> = {
  channel: string;
  args: unknown[];
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

interface BatchConfig {
  maxBatchSize: number;
  maxWaitMs: number;
}

const DEFAULT_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  maxWaitMs: 16, // ~1 frame at 60fps
};

class IPCBatcher {
  private pendingCalls: Map<string, BatchedCall<unknown>[]> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private config: BatchConfig;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a call to the batch queue
   */
  add<T>(channel: string, args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const call: BatchedCall<T> = { channel, args, resolve, reject };

      if (!this.pendingCalls.has(channel)) {
        this.pendingCalls.set(channel, []);
      }

      const batch = this.pendingCalls.get(channel)!;
      batch.push(call as BatchedCall<unknown>);

      // If batch is full, flush immediately
      if (batch.length >= this.config.maxBatchSize) {
        this.flush(channel);
        return;
      }

      // Otherwise, schedule a flush
      if (!this.timers.has(channel)) {
        const timer = setTimeout(() => {
          this.flush(channel);
        }, this.config.maxWaitMs);
        this.timers.set(channel, timer);
      }
    });
  }

  /**
   * Flush all pending calls for a channel
   */
  private flush(channel: string): void {
    const timer = this.timers.get(channel);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(channel);
    }

    const batch = this.pendingCalls.get(channel);
    if (!batch || batch.length === 0) return;

    this.pendingCalls.delete(channel);

    // Execute all calls - use Promise.allSettled to handle each independently
    const executeCall = async (call: BatchedCall<unknown>): Promise<void> => {
      try {
        // Validate channel format (namespace.method)
        const parts = call.channel.split('.');
        if (parts.length !== 2) {
          call.reject(new Error(`Invalid IPC channel format: ${call.channel}. Expected "namespace.method"`));
          return;
        }

        const [namespace, method] = parts;

        // Check if electronAPI exists
        if (typeof window === 'undefined' || !window.electronAPI) {
          call.reject(new Error('electronAPI is not available'));
          return;
        }

        // Access the electron API dynamically
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = window.electronAPI as any;
        const namespaceApi = api[namespace];

        if (!namespaceApi) {
          call.reject(new Error(`Unknown IPC namespace: ${namespace}`));
          return;
        }

        const methodFn = namespaceApi[method];
        if (typeof methodFn !== 'function') {
          call.reject(new Error(`Unknown IPC method: ${call.channel}`));
          return;
        }

        const result = await methodFn(...call.args);
        call.resolve(result);
      } catch (error) {
        call.reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    // Execute all calls in parallel but don't await the batch
    // Each call handles its own promise resolution
    batch.forEach(call => {
      executeCall(call).catch(() => {
        // Error already handled in executeCall via call.reject
      });
    });
  }

  /**
   * Flush all pending calls immediately
   */
  flushAll(): void {
    // Collect keys first to avoid iteration issues
    const channels = Array.from(this.pendingCalls.keys());
    channels.forEach(channel => this.flush(channel));
  }

  /**
   * Clear all pending calls and timers
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Reject all pending calls
    for (const batch of this.pendingCalls.values()) {
      batch.forEach(call => call.reject(new Error('IPC batcher cleared')));
    }
    this.pendingCalls.clear();
  }
}

// Singleton instance
export const ipcBatcher = new IPCBatcher();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    ipcBatcher.clear();
  });
}

/**
 * Batched IPC call wrapper
 * Automatically batches calls to the same channel within a time window
 * Channel format: "namespace.method" (e.g., "fs.readFile")
 */
export function batchedIPC<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcBatcher.add<T>(channel, args);
}

/**
 * Parallel IPC calls - executes multiple IPC calls in parallel
 * More explicit than batching, useful for independent calls
 */
export async function parallelIPC<T extends readonly unknown[]>(
  calls: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Promise.all(calls.map(call => call())) as any;
}

/**
 * Debounced IPC call - prevents rapid repeated calls
 * Includes cleanup on page unload
 */
class DebouncedIPCManager {
  private callsMap = new Map<string, ReturnType<typeof setTimeout>>();
  private promisesMap = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }[]>();

  constructor() {
    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.clear();
      });
    }
  }

  debounce<T>(key: string, call: () => Promise<T>, delayMs: number = 100): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add to pending promises
      if (!this.promisesMap.has(key)) {
        this.promisesMap.set(key, []);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.promisesMap.get(key)!.push({ resolve: resolve as any, reject });

      // Clear existing timer
      const existingTimer = this.callsMap.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        this.callsMap.delete(key);
        const promises = this.promisesMap.get(key) || [];
        this.promisesMap.delete(key);

        try {
          const result = await call();
          promises.forEach(p => p.resolve(result));
        } catch (error) {
          promises.forEach(p => p.reject(error instanceof Error ? error : new Error(String(error))));
        }
      }, delayMs);

      this.callsMap.set(key, timer);
    });
  }

  clear(): void {
    // Clear all timers
    for (const timer of this.callsMap.values()) {
      clearTimeout(timer);
    }
    this.callsMap.clear();

    // Reject all pending promises
    for (const promises of this.promisesMap.values()) {
      promises.forEach(p => p.reject(new Error('Debounced IPC cleared')));
    }
    this.promisesMap.clear();
  }
}

const debouncedManager = new DebouncedIPCManager();

export function debouncedIPC<T>(
  key: string,
  call: () => Promise<T>,
  delayMs: number = 100
): Promise<T> {
  return debouncedManager.debounce(key, call, delayMs);
}

/**
 * Direct IPC call - bypasses batcher for immediate execution
 * Use this for single calls where batching overhead isn't beneficial
 */
export async function directIPC<T>(channel: string, ...args: unknown[]): Promise<T> {
  // Validate channel format (namespace.method)
  const parts = channel.split('.');
  if (parts.length !== 2) {
    throw new Error(`Invalid IPC channel format: ${channel}. Expected "namespace.method"`);
  }

  const [namespace, method] = parts;

  // Check if electronAPI exists
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('electronAPI is not available');
  }

  // Access the electron API dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = window.electronAPI as any;
  const namespaceApi = api[namespace];

  if (!namespaceApi) {
    throw new Error(`Unknown IPC namespace: ${namespace}`);
  }

  const methodFn = namespaceApi[method];
  if (typeof methodFn !== 'function') {
    throw new Error(`Unknown IPC method: ${channel}`);
  }

  return methodFn(...args) as Promise<T>;
}

export default ipcBatcher;
