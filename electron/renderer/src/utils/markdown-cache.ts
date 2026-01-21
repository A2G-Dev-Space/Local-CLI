/**
 * LRU Cache for Markdown Parsing Results
 * Eliminates redundant parsing of identical content
 */

import type { ParsedMarkdownNode } from './markdown-parser';

interface CacheEntry {
  nodes: ParsedMarkdownNode[];
  accessTime: number;
}

class MarkdownLRUCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }

  /**
   * Generate a simple hash for cache key
   * Using content length + first/last chars for quick uniqueness
   */
  private generateKey(text: string): string {
    if (text.length < 100) {
      return text; // Short texts use content directly
    }
    // For longer texts, use a composite key
    const len = text.length;
    const start = text.slice(0, 50);
    const end = text.slice(-50);
    return `${len}:${start}:${end}`;
  }

  /**
   * Get cached result if available
   */
  get(text: string): ParsedMarkdownNode[] | null {
    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    if (entry) {
      // Update access time (LRU)
      entry.accessTime = Date.now();
      return entry.nodes;
    }

    return null;
  }

  /**
   * Store parsed result in cache
   */
  set(text: string, nodes: ParsedMarkdownNode[]): void {
    const key = this.generateKey(text);

    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      nodes,
      accessTime: Date.now(),
    });
  }

  /**
   * Remove the oldest (least recently used) entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Singleton instance - 200 entries should cover most conversations
export const markdownCache = new MarkdownLRUCache(200);

export default markdownCache;
