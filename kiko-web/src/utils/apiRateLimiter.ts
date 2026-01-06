/**
 * API Rate Limiter and Cache
 * 控制 API 调用频率，避免 RPC 配额用完
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class RateLimiter {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private requestTimestamps: Map<string, number[]> = new Map();

  // 默认配置
  private defaultConfig = {
    maxRequests: 30, // 最大请求数（增加到 30）
    windowMs: 60000, // 时间窗口（1分钟）
    cacheTTL: 30000, // 缓存时间（30秒）
  };

  /**
   * 检查是否超过速率限制
   */
  private checkRateLimit(key: string, config = this.defaultConfig): boolean {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(key) || [];

    // 移除过期的时间戳
    const validTimestamps = timestamps.filter(ts => now - ts < config.windowMs);

    if (validTimestamps.length >= config.maxRequests) {
      // 只在开发环境或首次超过限制时警告
      if (process.env.NODE_ENV === 'development' && validTimestamps.length === config.maxRequests) {
        console.warn(`[RateLimiter] Rate limit exceeded for ${key} (${config.maxRequests} requests in ${config.windowMs}ms)`);
      }
      return false;
    }

    // 添加当前时间戳
    validTimestamps.push(now);
    this.requestTimestamps.set(key, validTimestamps);
    return true;
  }

  /**
   * 从缓存获取数据
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl: number = this.defaultConfig.cacheTTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * 执行带速率限制和缓存的请求
   */
  async request<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      maxRequests?: number;
      windowMs?: number;
      cacheTTL?: number;
      useCache?: boolean;
    } = {}
  ): Promise<T | null> {
    const config = {
      maxRequests: options.maxRequests || this.defaultConfig.maxRequests,
      windowMs: options.windowMs || this.defaultConfig.windowMs,
      cacheTTL: options.cacheTTL || this.defaultConfig.cacheTTL,
      useCache: options.useCache !== false, // 默认使用缓存
    };

    // 检查缓存（优先使用缓存，避免不必要的请求）
    if (config.useCache) {
      const cached = this.get<T>(key);
      if (cached !== null) {
        // 只在开发环境记录缓存命中
        if (process.env.NODE_ENV === 'development') {
          const entry = this.cache.get(key);
          if (entry) {
            const age = Date.now() - entry.timestamp;
            // 只在首次命中或缓存较新时记录
            const logKey = `cache_log_${key}`;
            if (!(window as any)[logKey] || age < 5000) {
              console.log(`[RateLimiter] Cache hit for ${key} (${Math.round(age / 1000)}s old)`);
              (window as any)[logKey] = true;
              setTimeout(() => delete (window as any)[logKey], 1000);
            }
          }
        }
        return cached;
      }
    }

    // 检查速率限制
    if (!this.checkRateLimit(key, config)) {
      // 如果超过限制，尝试返回缓存（即使过期，最多返回 5 分钟前的数据）
      const staleCache = this.cache.get(key);
      if (staleCache) {
        const age = Date.now() - staleCache.timestamp;
        if (age < 300000) { // 5 分钟内的过期缓存仍然可用
          console.warn(`[RateLimiter] Rate limited, returning stale cache (${Math.round(age / 1000)}s old) for ${key}`);
          return staleCache.data as T;
        }
      }
      // 如果缓存太旧，返回 null 但记录警告
      console.warn(`[RateLimiter] Rate limited and no valid cache for ${key}`);
      return null;
    }

    try {
      const data = await fetcher();

      // Only cache non-null results to prevent caching failed requests
      if (config.useCache && data !== null) {
        this.set(key, data, config.cacheTTL);
      }

      return data;
    } catch (error) {
      // Handle network errors gracefully - don't log as error if it's a connection issue
      const isNetworkError = error instanceof TypeError &&
        (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('ERR_CONNECTION_REFUSED'));

      if (isNetworkError) {
        // 如果请求失败，尝试返回缓存（即使过期）
        const staleCache = this.cache.get(key);
        if (staleCache) {
          const age = Date.now() - staleCache.timestamp;
          if (age < 300000) { // 5 分钟内的过期缓存仍然可用
            console.warn(`[RateLimiter] Backend unavailable, returning stale cache (${Math.round(age / 1000)}s old) for ${key}`);
            return staleCache.data as T;
          }
        }
        // 如果缓存太旧或不存在，返回 null 而不是抛出错误
        console.warn(`[RateLimiter] Backend unavailable and no valid cache for ${key}`);
        return null;
      }

      // For other errors, log and try cache
      console.error(`[RateLimiter] Request failed for ${key}:`, error);

      // 如果请求失败，尝试返回缓存
      const cached = this.get<T>(key);
      if (cached !== null) {
        console.warn(`[RateLimiter] Request failed, returning cached data for ${key}`);
        return cached;
      }

      // Only throw if it's not a network error and no cache available
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.requestTimestamps.delete(key);
    } else {
      this.cache.clear();
      this.requestTimestamps.clear();
    }
  }
}

// 导出单例
export const rateLimiter = new RateLimiter();

// 为不同类型的 API 创建专用实例
export const priceRateLimiter = new RateLimiter();
export const quoteRateLimiter = new RateLimiter();
export const balanceRateLimiter = new RateLimiter();

