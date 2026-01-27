/**
 * Trade Context Manager
 * 
 * 核心思想：一次获取，全链路复用
 * 
 * 问题：当前代码中每个函数都会重新获取数据
 * - prepareSwap 获取 tokenInfo
 * - executeSwap 再次获取 tokenInfo  
 * - MainSwapService 又获取一遍
 * - tradeExecutor 还要获取
 * 
 * 解决方案：创建 TradeContext，上游获取后传递给下游
 * 1. ChatWorker 创建 context，获取初始数据
 * 2. prepareSwap 使用 context，补充缺失数据
 * 3. executeSwap 直接使用 context，无需再次获取
 * 4. 所有子服务都通过 context 访问缓存数据
 */

import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// ============================================================================
// 类型定义
// ============================================================================

export interface TokenData {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    price?: number;
    priceUsd?: number;
    liquidity?: number;
    marketCap?: number;
    chainId: number;
    launchpad?: string;
    isNative?: boolean;
    fetchedAt: number;
}

export interface WalletData {
    address: string;
    chainId: number;
    nativeBalance?: string;
    tokens: Map<string, TokenBalance>;
    fetchedAt: number;
}

export interface TokenBalance {
    address: string;
    symbol: string;
    balance: string;
    balanceFormatted: string;
    decimals: number;
    valueUsd?: number;
}

export interface QuoteData {
    dex: string;
    amountIn: string;
    amountOut: string;
    minAmountOut: string;
    priceImpact: number;
    gasEstimate: number;
    route?: string[];
    txData?: {
        to: string;
        data: string;
        value: string;
    };
    fetchedAt: number;
    expiresAt: number;
}

export interface TradeContextData {
    // 唯一标识
    id: string;
    taskId?: string;
    sessionId?: string;
    userId?: string;
    
    // 钱包信息
    wallet?: WalletData;
    
    // Token 缓存 (key: chainId:address)
    tokens: Map<string, TokenData>;
    
    // Quote 缓存
    quote?: QuoteData;
    
    // 用户设置
    userSettings?: {
        slippage?: number;
        mevProtection?: boolean;
        fastSwapMode?: boolean;
        swapMethod?: string;
    };
    
    // 元数据
    createdAt: number;
    updatedAt: number;
    accessCount: number;
}

// ============================================================================
// 全局上下文存储
// ============================================================================

// 使用 LRU 缓存存储活跃的交易上下文
const contextCache = new LRUCache<string, TradeContextData>({
    max: 1000,
    ttl: 5 * 60 * 1000, // 5分钟过期
});

// Token 全局缓存 (跨上下文共享)
const globalTokenCache = new LRUCache<string, TokenData>({
    max: 2000,
    ttl: 60 * 1000, // 1分钟
});

// 价格专用缓存 (更短TTL)
const priceCache = new LRUCache<string, { price: number; fetchedAt: number }>({
    max: 1000,
    ttl: 10 * 1000, // 10秒
});

// ============================================================================
// TradeContext 类
// ============================================================================

export class TradeContext {
    private data: TradeContextData;
    
    private constructor(data: TradeContextData) {
        this.data = data;
    }
    
    // ========== 创建方法 ==========
    
    /**
     * 创建新的交易上下文
     */
    static create(options: {
        taskId?: string;
        sessionId?: string;
        userId?: string;
        walletAddress?: string;
        chainId?: number;
        userSettings?: TradeContextData['userSettings'];
    } = {}): TradeContext {
        const id = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const data: TradeContextData = {
            id,
            taskId: options.taskId,
            sessionId: options.sessionId,
            userId: options.userId,
            tokens: new Map(),
            userSettings: options.userSettings,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            accessCount: 0,
        };
        
        if (options.walletAddress && options.chainId) {
            data.wallet = {
                address: options.walletAddress,
                chainId: options.chainId,
                tokens: new Map(),
                fetchedAt: 0,
            };
        }
        
        const ctx = new TradeContext(data);
        contextCache.set(id, data);
        
        logger.debug(LogCode.SYS_INFO, 'TradeContext created', { id, taskId: options.taskId });
        
        return ctx;
    }
    
    /**
     * 从现有ID获取上下文
     */
    static get(id: string): TradeContext | null {
        const data = contextCache.get(id);
        if (!data) return null;
        
        data.accessCount++;
        data.updatedAt = Date.now();
        
        return new TradeContext(data);
    }
    
    /**
     * 从 ToolContext 创建或恢复上下文
     */
    static fromToolContext(toolContext: any): TradeContext {
        // 如果已有上下文ID，尝试恢复
        if (toolContext?.tradeContextId) {
            const existing = TradeContext.get(toolContext.tradeContextId);
            if (existing) return existing;
        }
        
        // 创建新上下文
        return TradeContext.create({
            taskId: toolContext?.taskId,
            sessionId: toolContext?.sessionId,
            userId: toolContext?.userId,
            walletAddress: toolContext?.walletAddress,
            chainId: toolContext?.chainId,
            userSettings: {
                slippage: toolContext?.toolConfig?.customSlippage,
                mevProtection: toolContext?.toolConfig?.mevProtection,
                fastSwapMode: toolContext?.toolConfig?.fastSwapMode,
                swapMethod: 'allowance_trade', // FORCED: Always use allowance_trade
            },
        });
    }
    
    // ========== 访问器 ==========
    
    get id(): string {
        return this.data.id;
    }
    
    get wallet(): WalletData | undefined {
        return this.data.wallet;
    }
    
    get userSettings(): TradeContextData['userSettings'] {
        return this.data.userSettings;
    }
    
    // ========== Token 操作 ==========
    
    /**
     * 获取 Token 信息 (优先从缓存)
     */
    getToken(address: string, chainId: number): TokenData | null {
        const key = this.tokenKey(address, chainId);
        
        // 1. 先查上下文缓存
        const local = this.data.tokens.get(key);
        if (local && this.isTokenFresh(local)) {
            return local;
        }
        
        // 2. 再查全局缓存
        const global = globalTokenCache.get(key);
        if (global && this.isTokenFresh(global)) {
            // 同步到上下文
            this.data.tokens.set(key, global);
            return global;
        }
        
        return null;
    }
    
    /**
     * 设置 Token 信息 (同时更新全局缓存)
     */
    setToken(token: TokenData): void {
        const key = this.tokenKey(token.address, token.chainId);
        token.fetchedAt = Date.now();
        
        this.data.tokens.set(key, token);
        globalTokenCache.set(key, token);
        this.data.updatedAt = Date.now();
        
        logger.debug(LogCode.SYS_INFO, 'Token cached in context', { 
            symbol: token.symbol, 
            address: token.address.slice(0, 10),
            contextId: this.data.id 
        });
    }
    
    /**
     * 获取或获取 Token (智能缓存)
     */
    async getOrFetchToken(
        address: string, 
        chainId: number,
        fetcher: () => Promise<TokenData | null>
    ): Promise<TokenData | null> {
        // 先尝试缓存
        const cached = this.getToken(address, chainId);
        if (cached) {
            logger.debug(LogCode.CACHE_HIT, 'Token from context cache', { 
                symbol: cached.symbol,
                contextId: this.data.id
            });
            return cached;
        }
        
        // 缓存未命中，调用 fetcher
        const token = await fetcher();
        if (token) {
            this.setToken(token);
        }
        
        return token;
    }
    
    // ========== 余额操作 ==========
    
    /**
     * 获取 Token 余额
     */
    getBalance(address: string): TokenBalance | null {
        if (!this.data.wallet) return null;
        return this.data.wallet.tokens.get(address.toLowerCase()) || null;
    }
    
    /**
     * 设置钱包余额
     */
    setWalletBalances(balances: TokenBalance[]): void {
        if (!this.data.wallet) return;
        
        for (const balance of balances) {
            this.data.wallet.tokens.set(balance.address.toLowerCase(), balance);
        }
        this.data.wallet.fetchedAt = Date.now();
        this.data.updatedAt = Date.now();
        
        logger.debug(LogCode.SYS_INFO, 'Wallet balances cached', { 
            count: balances.length,
            contextId: this.data.id
        });
    }
    
    /**
     * 检查是否有足够余额
     */
    hasBalance(tokenAddress: string, amount: string): boolean {
        const balance = this.getBalance(tokenAddress);
        if (!balance) return false;
        
        try {
            return parseFloat(balance.balanceFormatted) >= parseFloat(amount);
        } catch {
            return false;
        }
    }
    
    // ========== Quote 操作 ==========
    
    /**
     * 获取缓存的 Quote
     */
    getQuote(): QuoteData | null {
        if (!this.data.quote) return null;
        if (Date.now() > this.data.quote.expiresAt) {
            this.data.quote = undefined;
            return null;
        }
        return this.data.quote;
    }
    
    /**
     * 设置 Quote
     */
    setQuote(quote: Omit<QuoteData, 'fetchedAt' | 'expiresAt'>, ttlMs: number = 30000): void {
        this.data.quote = {
            ...quote,
            fetchedAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
        };
        this.data.updatedAt = Date.now();
    }
    
    // ========== 价格操作 ==========
    
    /**
     * 获取 Token 价格 (10秒缓存)
     */
    getPrice(address: string, chainId: number): number | null {
        const key = this.tokenKey(address, chainId);
        const cached = priceCache.get(key);
        if (cached && Date.now() - cached.fetchedAt < 10000) {
            return cached.price;
        }
        
        // 尝试从 token 数据获取
        const token = this.getToken(address, chainId);
        if (token?.price) {
            return token.price;
        }
        
        return null;
    }
    
    /**
     * 设置价格
     */
    setPrice(address: string, chainId: number, price: number): void {
        const key = this.tokenKey(address, chainId);
        priceCache.set(key, { price, fetchedAt: Date.now() });
    }
    
    // ========== 序列化 ==========
    
    /**
     * 转换为可传递的对象 (用于跨函数传递)
     */
    toObject(): { tradeContextId: string } & Partial<TradeContextData> {
        return {
            tradeContextId: this.data.id,
            taskId: this.data.taskId,
            sessionId: this.data.sessionId,
            userId: this.data.userId,
            userSettings: this.data.userSettings,
        };
    }
    
    /**
     * 生成调试摘要
     */
    toSummary(): string {
        return JSON.stringify({
            id: this.data.id,
            tokensCached: this.data.tokens.size,
            hasWallet: !!this.data.wallet,
            balancesCached: this.data.wallet?.tokens.size || 0,
            hasQuote: !!this.data.quote,
            accessCount: this.data.accessCount,
            ageMs: Date.now() - this.data.createdAt,
        });
    }
    
    // ========== 私有方法 ==========
    
    private tokenKey(address: string, chainId: number): string {
        return `${chainId}:${address.toLowerCase()}`;
    }
    
    private isTokenFresh(token: TokenData, maxAgeMs: number = 60000): boolean {
        return Date.now() - token.fetchedAt < maxAgeMs;
    }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 从工具调用上下文获取或创建 TradeContext
 */
export function getTradeContext(toolContext: any): TradeContext {
    return TradeContext.fromToolContext(toolContext);
}

/**
 * 获取全局缓存统计
 */
export function getContextStats(): {
    activeContexts: number;
    globalTokens: number;
    priceEntries: number;
} {
    return {
        activeContexts: contextCache.size,
        globalTokens: globalTokenCache.size,
        priceEntries: priceCache.size,
    };
}

/**
 * 清理过期上下文
 */
export function pruneContexts(): void {
    contextCache.purgeStale();
    globalTokenCache.purgeStale();
    priceCache.purgeStale();
}

export default TradeContext;
