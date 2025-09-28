/**
 * Simple in-memory cache for API responses and recommendations
 * In production, this should be replaced with Redis
 */

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map(); // Time-to-live map
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Set cache entry with TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttl);
  }

  /**
   * Get cache entry
   */
  get(key) {
    const expiry = this.ttl.get(key);
    
    if (!expiry) {
      return null; // Key doesn't exist
    }
    
    if (Date.now() > expiry) {
      // Expired, remove from cache
      this.cache.delete(key);
      this.ttl.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clean expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
        this.ttl.delete(key);
      }
    }
  }

  /**
   * Generate cache key for recommendations
   */
  static getRecommendationKey(userId, algorithm = 'hybrid', limit = 20) {
    return `recommendations:${userId}:${algorithm}:${limit}`;
  }

  /**
   * Generate cache key for songs
   */
  static getSongsKey(searchTerm = '', limit = 20) {
    return `songs:${searchTerm}:${limit}`;
  }

  /**
   * Generate cache key for song details
   */
  static getSongKey(songId) {
    return `song:${songId}`;
  }

  /**
   * Generate cache key for user interactions
   */
  static getUserInteractionsKey(userId) {
    return `interactions:${userId}`;
  }
}

// Create singleton instance
const memoryCache = new MemoryCache();

/**
 * Cache decorator for API functions
 */
export function withCache(keyGenerator, ttl = 5 * 60 * 1000) {
  return function(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      const key = typeof keyGenerator === 'function' 
        ? keyGenerator(...args) 
        : keyGenerator;
      
      // Try to get from cache first
      const cached = memoryCache.get(key);
      if (cached) {
        console.log(`🎯 Cache hit for key: ${key}`);
        return cached;
      }
      
      // Execute original method
      console.log(`🔄 Cache miss for key: ${key}`);
      const result = await method.apply(this, args);
      
      // Cache the result
      memoryCache.set(key, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Cache recommendations
   */
  setRecommendations(userId, algorithm, limit, recommendations, ttl = 10 * 60 * 1000) {
    const key = MemoryCache.getRecommendationKey(userId, algorithm, limit);
    memoryCache.set(key, recommendations, ttl);
  },

  /**
   * Get cached recommendations
   */
  getRecommendations(userId, algorithm, limit) {
    const key = MemoryCache.getRecommendationKey(userId, algorithm, limit);
    return memoryCache.get(key);
  },

  /**
   * Cache songs list
   */
  setSongs(searchTerm, limit, songs, ttl = 5 * 60 * 1000) {
    const key = MemoryCache.getSongsKey(searchTerm, limit);
    memoryCache.set(key, songs, ttl);
  },

  /**
   * Get cached songs
   */
  getSongs(searchTerm, limit) {
    const key = MemoryCache.getSongsKey(searchTerm, limit);
    return memoryCache.get(key);
  },

  /**
   * Cache song details
   */
  setSong(songId, song, ttl = 15 * 60 * 1000) {
    const key = MemoryCache.getSongKey(songId);
    memoryCache.set(key, song, ttl);
  },

  /**
   * Get cached song
   */
  getSong(songId) {
    const key = MemoryCache.getSongKey(songId);
    return memoryCache.get(key);
  },

  /**
   * Invalidate cache entries
   */
  invalidate(pattern) {
    if (typeof pattern === 'string') {
      // Simple string matching
      for (const key of memoryCache.cache.keys()) {
        if (key.includes(pattern)) {
          memoryCache.delete(key);
        }
      }
    }
  },

  /**
   * Clear all cache
   */
  clear() {
    memoryCache.clear();
  },

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: memoryCache.size(),
      entries: Array.from(memoryCache.cache.keys())
    };
  },

  /**
   * Cleanup expired entries
   */
  cleanup() {
    memoryCache.cleanup();
  }
};

// Cleanup expired entries every 5 minutes
setInterval(() => {
  memoryCache.cleanup();
}, 5 * 60 * 1000);

export default cache;
