/**
 * Data Cache Hub - 统一缓存中心
 * 所有模块通过这个 Hub 访问缓存数据，避免重复查询
 * 
 * 架构：
 * - Token Info Cache (价格、流动性、市值)
 * - Native Price Cache (ETH/BNB/SOL 价格)
 * - User Settings Cache (用户配置)
 * - Config Cache (Copy Trade 配置)
 * 
 * 特性：
 * - 自动刷新
 * - 订阅通知
 * - 内存优化
 */

import { LRUCache } from 'lru-cache';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// ==================== 类型定义 ====================

interface TokenCacheData {
    price: number;
    liquidity: number;
    marketCap: number;
    volume24h: number;
    symbol: string;
    decimals: number;
    provider: string;
    timestamp: number;
}

interface NativePriceData {
    price: number;
    timestamp: number;
}

interface UserSettingsData {
    settings: any;
    timestamp: number;
}

interface CopyTradeConfigData {
    configs: any[];
    timestamp: number;
}

// ==================== 缓存实例 ====================

class DataCacheHub extends EventEmitter {
    private static instance: DataCacheHub;

    // Token 信息缓存 (chainId:address -> TokenData)
    private tokenCache: LRUCache<string, TokenCacheData>;
    
    // Native 价格缓存 (chainId -> Price)
    private nativePriceCache: Map<number, NativePriceData>;
    
    // User Settings 缓存 (userId -> Settings)
    private userSettingsCache: LRUCache<string, UserSettingsData>;
    
    // Copy Trade 配置缓存 (targetWallet:chainId -> Configs[])
    private configCache: LRUCache<string, CopyTradeConfigData>;

    // 缓存配置
    private readonly TOKEN_CACHE_TTL = 30 * 1000; // 30秒
    private readonly NATIVE_PRICE_TTL = 60 * 60 * 1000; // 1小时
    private readonly USER_SETTINGS_TTL = 5 * 60 * 1000; // 5分钟
    private readonly CONFIG_CACHE_TTL = 60 * 1000; // 1分钟

    private constructor() {
        super();
        
        // 初始化缓存
        this.tokenCache = new LRUCache<string, TokenCacheData>({
            max: 1000,
            ttl: this.TOKEN_CACHE_TTL,
        });

        this.nativePriceCache = new Map();
        
        this.userSettingsCache = new LRUCache<string, UserSettingsData>({
            max: 500,
            ttl: this.USER_SETTINGS_TTL,
        });

        this.configCache = new LRUCache<string, CopyTradeConfigData>({
            max: 200,
            ttl: this.CONFIG_CACHE_TTL,
        });

        // 启动清理定时器
        this.startCleanupTimer();
    }

    public static getInstance(): DataCacheHub {
        if (!DataCacheHub.instance) {
            DataCacheHub.instance = new DataCacheHub();
        }
        return DataCacheHub.instance;
    }

    // ==================== Token Info 缓存 ====================

    /**
     * 获取 Token 信息（从缓存或回调函数）
     */
    async getTokenInfo(
        tokenAddress: string,
        chainId: number,
        fetchFn: () => Promise<any>
    ): Promise<any> {
        const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
        const cached = this.tokenCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.TOKEN_CACHE_TTL) {
            logger.debug(LogCode.CACHE_HIT, 'Token cache hit', { 
                token: tokenAddress, 
                age: Date.now() - cached.timestamp 
            });
            return cached;
        }

        // 缓存未命中，调用获取函数
        logger.debug(LogCode.CACHE_MISS, 'Token cache miss, fetching...', { token: tokenAddress });
        const data = await fetchFn();
        
        if (data) {
            const cacheData: TokenCacheData = {
                ...data,
                timestamp: Date.now()
            };
            this.tokenCache.set(cacheKey, cacheData);
            
            // 触发缓存更新事件
            this.emit('tokenUpdated', { chainId, tokenAddress, data: cacheData });
        }

        return data;
    }

    /**
     * 批量预热 Token 缓存
     */
    async warmupTokens(tokens: Array<{ address: string; chainId: number }>, fetchFn: (address: string, chainId: number) => Promise<any>) {
        logger.info(LogCode.CACHE_HIT, `🔥 Warming up ${tokens.length} tokens`, { count: tokens.length });
        
        await Promise.allSettled(
            tokens.map(async ({ address, chainId }) => {
                try {
                    const data = await fetchFn(address, chainId);
                    if (data) {
                        const cacheKey = `${chainId}:${address.toLowerCase()}`;
                        this.tokenCache.set(cacheKey, { ...data, timestamp: Date.now() });
                    }
                } catch (err) {
                    logger.debug(LogCode.CACHE_MISS, 'Warmup failed for token', { address });
                }
            })
        );
    }

    // ==================== Native Price 缓存 ====================

    /**
     * 获取 Native Token 价格（ETH/BNB/SOL）
     */
    async getNativePrice(
        chainId: number,
        fetchFn: () => Promise<number>
    ): Promise<number> {
        const cached = this.nativePriceCache.get(chainId);

        if (cached && Date.now() - cached.timestamp < this.NATIVE_PRICE_TTL) {
            logger.debug(LogCode.CACHE_HIT, 'Native price cache hit', { chainId, price: cached.price });
            return cached.price;
        }

        // 缓存未命中
        logger.debug(LogCode.CACHE_MISS, 'Native price cache miss, fetching...', { chainId });
        const price = await fetchFn();
        
        if (price > 0) {
            this.nativePriceCache.set(chainId, { price, timestamp: Date.now() });
            this.emit('nativePriceUpdated', { chainId, price });
        }

        return price;
    }

    /**
     * 批量预热 Native 价格
     */
    async warmupNativePrices(chainIds: number[], fetchFn: (chainId: number) => Promise<number>) {
        logger.info(LogCode.CACHE_HIT, `🔥 Warming up native prices for ${chainIds.length} chains`, { chainIds });
        
        await Promise.allSettled(
            chainIds.map(async (chainId) => {
                try {
                    const price = await fetchFn(chainId);
                    if (price > 0) {
                        this.nativePriceCache.set(chainId, { price, timestamp: Date.now() });
                    }
                } catch (err) {
                    logger.debug(LogCode.CACHE_MISS, 'Warmup failed for native price', { chainId });
                }
            })
        );
    }

    // ==================== User Settings 缓存 ====================

    /**
     * 获取用户设置
     */
    async getUserSettings(
        userId: string,
        fetchFn: () => Promise<any>
    ): Promise<any> {
        const cached = this.userSettingsCache.get(userId);

        if (cached && Date.now() - cached.timestamp < this.USER_SETTINGS_TTL) {
            return cached.settings;
        }

        const settings = await fetchFn();
        if (settings) {
            this.userSettingsCache.set(userId, { settings, timestamp: Date.now() });
        }

        return settings;
    }

    /**
     * 批量预热用户设置
     */
    async warmupUserSettings(userIds: string[], fetchFn: (userId: string) => Promise<any>) {
        logger.info(LogCode.CACHE_HIT, `🔥 Warming up ${userIds.length} user settings`, { count: userIds.length });
        
        const settingsMap = new Map<string, any>();
        
        await Promise.allSettled(
            userIds.map(async (userId) => {
                try {
                    const settings = await fetchFn(userId);
                    if (settings) {
                        this.userSettingsCache.set(userId, { settings, timestamp: Date.now() });
                        settingsMap.set(userId, settings);
                    }
                } catch (err) {
                    logger.debug(LogCode.CACHE_MISS, 'Warmup failed for user settings', { userId });
                }
            })
        );

        return settingsMap;
    }

    // ==================== Copy Trade Config 缓存 ====================

    /**
     * 获取 Copy Trade 配置
     */
    async getCopyTradeConfigs(
        targetWallet: string,
        chainId: number,
        fetchFn: () => Promise<any[]>
    ): Promise<any[]> {
        const cacheKey = `${targetWallet.toLowerCase()}:${chainId}`;
        const cached = this.configCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.CONFIG_CACHE_TTL) {
            logger.debug(LogCode.CACHE_HIT, 'Config cache hit', { wallet: targetWallet, count: cached.configs.length });
            return cached.configs;
        }

        const configs = await fetchFn();
        if (configs) {
            this.configCache.set(cacheKey, { configs, timestamp: Date.now() });
        }

        return configs;
    }

    // ==================== 缓存管理 ====================

    /**
     * 清除特定 Token 缓存
     */
    invalidateToken(tokenAddress: string, chainId: number) {
        const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
        this.tokenCache.delete(cacheKey);
        this.emit('tokenInvalidated', { chainId, tokenAddress });
    }

    /**
     * 清除所有缓存
     */
    clearAll() {
        this.tokenCache.clear();
        this.nativePriceCache.clear();
        this.userSettingsCache.clear();
        this.configCache.clear();
        logger.info(LogCode.SYS_STARTUP, 'All caches cleared');
    }

    /**
     * 获取缓存统计
     */
    getStats() {
        return {
            tokens: {
                size: this.tokenCache.size,
                max: this.tokenCache.max,
            },
            nativePrices: this.nativePriceCache.size,
            userSettings: {
                size: this.userSettingsCache.size,
                max: this.userSettingsCache.max,
            },
            configs: {
                size: this.configCache.size,
                max: this.configCache.max,
            }
        };
    }

    /**
     * 启动定时清理
     */
    private startCleanupTimer() {
        setInterval(() => {
            const now = Date.now();
            
            // 清理过期的 Native Price
            for (const [chainId, data] of this.nativePriceCache.entries()) {
                if (now - data.timestamp > this.NATIVE_PRICE_TTL) {
                    this.nativePriceCache.delete(chainId);
                }
            }
            
            // LRU Cache 会自动清理，这里只记录统计
            const stats = this.getStats();
            if (stats.tokens.size > 0 || stats.nativePrices > 0) {
                logger.debug(LogCode.SYS_STARTUP, 'Cache stats', stats);
            }
        }, 60 * 1000); // 每分钟清理一次
    }
}

// 导出单例
export const cacheHub = DataCacheHub.getInstance();
