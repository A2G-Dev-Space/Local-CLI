/**
 * Cache Utility
 *
 * LRU (Least Recently Used) 캐시 구현
 * TTL (Time To Live) 지원
 */

export interface CacheOptions {
  /**
   * 최대 캐시 엔트리 수
   * @default 100
   */
  maxSize?: number;

  /**
   * TTL (Time To Live) - 밀리초
   * @default 300000 (5분)
   */
  ttl?: number;

  /**
   * 캐시 hit/miss 통계 활성화
   * @default false
   */
  enableStats?: boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  createdAt: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * LRU Cache 클래스
 */
export class Cache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private options: Required<CacheOptions>;
  private stats: CacheStats;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.options = {
      maxSize: options.maxSize ?? 100,
      ttl: options.ttl ?? 5 * 60 * 1000, // 5분
      enableStats: options.enableStats ?? false,
    };
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
    };
  }

  /**
   * 캐시에서 값 가져오기
   */
  public get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.options.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return undefined;
    }

    // TTL 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.options.enableStats) {
        this.stats.misses++;
        this.stats.deletes++;
        this.stats.size = this.cache.size;
        this.updateHitRate();
      }
      return undefined;
    }

    // LRU 업데이트 (접근 시간 갱신)
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    // Map의 순서를 업데이트하기 위해 재삽입
    this.cache.delete(key);
    this.cache.set(key, entry);

    if (this.options.enableStats) {
      this.stats.hits++;
      this.updateHitRate();
    }

    return entry.value;
  }

  /**
   * 캐시에 값 저장
   */
  public set(key: K, value: V, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.options.ttl);

    // 기존 엔트리가 있으면 삭제
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 크기 제한 확인 및 LRU 제거
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<V> = {
      value,
      expiresAt,
      accessCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);

    if (this.options.enableStats) {
      this.stats.sets++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * 캐시에서 값 삭제
   */
  public delete(key: K): boolean {
    const deleted = this.cache.delete(key);

    if (deleted && this.options.enableStats) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
    }

    return deleted;
  }

  /**
   * 캐시에 키가 있는지 확인
   */
  public has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // TTL 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 캐시 초기화
   */
  public clear(): void {
    this.cache.clear();

    if (this.options.enableStats) {
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        size: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * 캐시 크기
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * LRU (Least Recently Used) 엔트리 제거
   */
  private evictLRU(): void {
    // Map은 삽입 순서를 유지하므로 첫 번째 엔트리가 가장 오래된 것
    const firstKey = this.cache.keys().next().value;

    if (firstKey !== undefined) {
      this.cache.delete(firstKey);

      if (this.options.enableStats) {
        this.stats.evictions++;
      }
    }
  }

  /**
   * Hit Rate 업데이트
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 캐시 통계 가져오기
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 만료된 엔트리 정리
   */
  public cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (this.options.enableStats && cleaned > 0) {
      this.stats.deletes += cleaned;
      this.stats.size = this.cache.size;
    }

    return cleaned;
  }

  /**
   * 모든 키 가져오기
   */
  public keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 모든 값 가져오기
   */
  public values(): V[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * 캐시 엔트리 반복
   */
  public forEach(callback: (value: V, key: K) => void): void {
    for (const [key, entry] of this.cache.entries()) {
      callback(entry.value, key);
    }
  }
}

/**
 * 캐시 키 생성 유틸리티
 */
export function createCacheKey(...parts: unknown[]): string {
  return parts.map(part => {
    if (typeof part === 'object' && part !== null) {
      return JSON.stringify(part);
    }
    return String(part);
  }).join(':');
}

/**
 * 캐시 프리셋
 */
export const CachePresets = {
  /**
   * LLM 응답 캐시 (큰 용량, 긴 TTL)
   */
  llm: {
    maxSize: 50,
    ttl: 30 * 60 * 1000, // 30분
    enableStats: true,
  } as CacheOptions,

  /**
   * 파일 캐시 (중간 용량, 중간 TTL)
   */
  file: {
    maxSize: 100,
    ttl: 10 * 60 * 1000, // 10분
    enableStats: false,
  } as CacheOptions,

  /**
   * API Health Check 캐시 (작은 용량, 짧은 TTL)
   */
  health: {
    maxSize: 20,
    ttl: 2 * 60 * 1000, // 2분
    enableStats: false,
  } as CacheOptions,

  /**
   * 세션 캐시 (작은 용량, 긴 TTL)
   */
  session: {
    maxSize: 10,
    ttl: 60 * 60 * 1000, // 1시간
    enableStats: false,
  } as CacheOptions,
};
