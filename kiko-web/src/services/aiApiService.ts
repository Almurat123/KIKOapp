/**
 * AI API Service - Unified handler for all API calls
 * Location: kiko-web/src/services/aiApiService.ts
 * Function: Call corresponding backend API based on user intent
 */

import type { ExtendedUserIntent } from './aiExtendedIntentParser';
import { getBestSwapQuote } from './dexAggregatorService';
import { getTokenData } from './tokenDataService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

/**
 * AI API 调用服务
 */
export class AIApiService {
  /**
   * 根据意图调用相应的 API
   */
  static async callApiByIntent(intent: ExtendedUserIntent): Promise<ApiResponse> {
    // Some types like TOKEN_SECURITY have their own handlers and don't need apiEndpoint
    const typesWithOwnHandlers = ['TOKEN_SECURITY', 'RISK_ASSESSMENT'];
    if (!intent.apiEndpoint && !typesWithOwnHandlers.includes(intent.type || intent.action)) {
      return {
        success: false,
        error: 'Unable to determine which API to call',
      };
    }

    try {
      switch (intent.type || intent.action) {
        // 交易 API
        case 'SWAP':
        case 'CHECK_PRICE':
          return await this.handleSwapIntent(intent);

        case 'VIEW_TRADE_HISTORY':
          return await this.callGetApi('/api/swap/history', intent.parameters || {});

        case 'GET_TRADE_STATS':
          return await this.callGetApi('/api/swap/stats', intent.parameters || {});

        // 新闻 API
        case 'NEWS_FLASH':
          return await this.callGetApi('/api/news/flash');

        case 'NEWS_ARTICLES':
          return await this.callGetApi('/api/news/articles', intent.parameters || {});

        case 'NEWS_FEATURED':
          return await this.callGetApi('/api/news/featured');

        // 社交 API
        case 'SOCIAL_TRENDING':
          return await this.callGetApi('/api/social/trending');

        case 'SOCIAL_USER_INFO':
          if (!intent.parameters?.fid) {
            return { success: false, error: 'Missing user ID' };
          }
          return await this.callGetApi(
            `/api/social/snapchain/user/${intent.parameters.fid}`
          );

        case 'SOCIAL_QUALITY_STATS':
          return await this.callGetApi('/api/social/quality-users/stats');

        // 市场 API
        case 'MARKET_OVERVIEW':
          return await this.callGetApi('/api/market/overview');

        case 'MARKET_CHAINS':
          return await this.callGetApi('/api/market/chains');

        case 'MARKET_PROTOCOLS':
          return await this.callGetApi('/api/market/protocols');

        case 'MARKET_TRENDING':
          return await this.callGetApi('/api/market/trending');

        case 'MARKET_GAINERS':
          return await this.callGetApi('/api/market/gainers', intent.parameters || {});

        case 'MARKET_PROTOCOL_HISTORY':
          if (!intent.parameters?.protocolName) {
            return { success: false, error: 'Missing protocol name' };
          }
          return await this.callGetApi(
            `/api/market/protocol/${intent.parameters.protocolName}/history`,
            { days: intent.parameters.days || 30 }
          );

        // 代币 API
        case 'TOKEN_SEARCH':
          return await this.callGetApi('/api/tokens/search', intent.parameters || {});

        case 'TOKEN_DETAIL':
          return await this.handleTokenDetail(intent);

        case 'TOKEN_CHART':
          return await this.handleTokenChart(intent);

        case 'TOKEN_TRENDING':
          return await this.callGetApi('/api/tokens/trending', intent.parameters || {});

        // 钱包 API
        case 'WALLET_LIST':
          return await this.callGetApi('/api/wallets');

        case 'WALLET_FEED':
          return await this.callGetApi('/api/wallets/feed', intent.parameters || {});

        case 'WALLET_BALANCE':
          if (!intent.parameters?.address) {
            return { success: false, error: 'Missing wallet address' };
          }
          return await this.callGetApi(
            `/api/wallets/${intent.parameters.address}/balance`
          );

        case 'WALLET_TRANSACTIONS':
          if (!intent.parameters?.address) {
            return { success: false, error: 'Missing wallet address' };
          }
          return await this.callGetApi(
            `/api/wallets/${intent.parameters.address}/transactions`,
            intent.parameters
          );

        // 安全 API
        case 'TOKEN_SECURITY':
        case 'RISK_ASSESSMENT':
          return await this.handleSecurityScan(intent);

        default:
          return {
            success: false,
            error: `Unsupported intent type: ${intent.type || intent.action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `API call failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * GET 请求的通用方法
   */
  private static async callGetApi(
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse> {
    try {
      let url = `${API_BASE_URL}${endpoint}`;

      if (params && Object.keys(params).length > 0) {
        const queryString = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            queryString.append(key, String(value));
          }
        }
        url += `?${queryString.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * POST 请求的通用方法
   */
  private static async callPostApi(
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 处理交换意图 - 真实调用 0xAPI 获取报价
   */
  private static async handleSwapIntent(intent: ExtendedUserIntent): Promise<ApiResponse> {
    if (!intent.tradeIntent) {
      return {
        success: false,
        error: 'Missing trade parameters',
      };
    }

    try {
      const { tokenIn, tokenOut, chainId, slippageBps } = intent.tradeIntent;

      if (!tokenIn.address || !tokenOut.address || !chainId) {
        return {
          success: false,
          error: 'Missing token address or chain ID',
        };
      }

      // 1. 获取代币信息（包含头像）
      const tokenInData = await getTokenData(tokenIn.address, chainId);
      const tokenOutData = await getTokenData(tokenOut.address, chainId);

      // 2. 从 DEX 聚合器获取最优报价
      const { best: quote, quotes } = await getBestSwapQuote(
        tokenIn.address,
        tokenOut.address,
        tokenIn.amount,
        chainId
      );

      // 3. 返回完整数据
      return {
        success: true,
        data: {
          quote,
          quotes,
          tokenIn: { ...tokenInData, amount: tokenIn.amount },
          tokenOut: { ...tokenOutData, amountOut: quote.amountOut },
          dexName: quote.dexName,
          priceImpact: quote.priceImpact,
          slippageBps,
        },
      };
    } catch {
      // 失败时返回后端备选方案
      return await this.callPostApi('/api/swap/quote', {
        tokenIn: intent.tradeIntent.tokenIn.symbol,
        tokenOut: intent.tradeIntent.tokenOut.symbol,
        amount: intent.tradeIntent.tokenIn.amount,
        chainId: intent.tradeIntent.chainId,
        slippageBps: intent.tradeIntent.slippageBps,
      });
    }
  }

  /**
   * 处理代币详情请求
   */
  private static async handleTokenDetail(intent: ExtendedUserIntent): Promise<ApiResponse> {
    const symbol = intent.parameters?.symbol as string;
    const network = (intent.parameters?.network as string) || 'ethereum';

    // 首先搜索代币获取地址
    const searchResult = await this.callGetApi('/api/tokens/search', {
      query: symbol,
      network,
      limit: 1,
    });

    if (!searchResult.success || !searchResult.data) {
      return {
        success: false,
        error: `Token not found: ${symbol}`,
      };
    }

    // 然后获取详情
    const tokenData = searchResult.data as Record<string, unknown>;
    const address = (tokenData as Record<string, unknown>).address;

    if (!address) {
      return {
        success: false,
        error: 'Unable to get token address',
      };
    }

    return await this.callGetApi(`/api/tokens/${network}/${address}`);
  }

  /**
   * 处理代币图表请求
   */
  private static async handleTokenChart(intent: ExtendedUserIntent): Promise<ApiResponse> {
    const symbol = intent.parameters?.symbol as string;
    const network = (intent.parameters?.network as string) || 'ethereum';
    const timeframe = (intent.parameters?.timeframe as string) || '24h';

    // 首先搜索代币获取地址
    const searchResult = await this.callGetApi('/api/tokens/search', {
      query: symbol,
      network,
      limit: 1,
    });

    if (!searchResult.success || !searchResult.data) {
      return {
        success: false,
        error: `Token not found: ${symbol}`,
      };
    }

    // 然后获取图表
    const tokenData = searchResult.data as Record<string, unknown>;
    const address = (tokenData as Record<string, unknown>).address;

    if (!address) {
      return {
        success: false,
        error: 'Unable to get token address',
      };
    }

    return await this.callGetApi(`/api/tokens/${network}/${address}/chart`, {
      timeframe,
    });
  }

  /**
   * 处理安全扫描请求
   */
  private static async handleSecurityScan(intent: ExtendedUserIntent): Promise<ApiResponse> {
    const address = intent.parameters?.address as string;
    const chain = (intent.parameters?.chain as string) || 'ethereum';
    const dex = (intent.parameters?.dex as string) || 'uniswap';

    if (!address) {
      return {
        success: false,
        error: 'Missing contract address',
      };
    }

    return await this.callGetApi('/api/security/scan', {
      address,
      chain,
      dex,
    });
  }

  /**
   * 格式化 API 响应为用户友好的文本
   */
  static formatApiResponse(response: ApiResponse, intentType: string): string {
    if (!response.success) {
      return `Error: ${response.error || 'Request failed'}`;
    }

    // 根据意图类型格式化响应
    switch (intentType) {
      case 'NEWS_FLASH':
        return this.formatNewsResponse(response.data as Record<string, unknown>);

      case 'SOCIAL_TRENDING':
        return this.formatSocialTrendingResponse(response.data as Record<string, unknown>);

      case 'MARKET_OVERVIEW':
        return this.formatMarketOverviewResponse(response.data as Record<string, unknown>);

      case 'MARKET_CHAINS':
        return this.formatChainsResponse(response.data as Record<string, unknown>[]);

      case 'MARKET_TRENDING':
      case 'MARKET_GAINERS':
        return this.formatProtocolsResponse(response.data as Record<string, unknown>[]);

      case 'TOKEN_DETAIL':
        return this.formatTokenDetailResponse(response.data as Record<string, unknown>);

      case 'TOKEN_SECURITY':
      case 'RISK_ASSESSMENT':
        return this.formatSecurityResponse(response.data as Record<string, unknown>);

      case 'WALLET_LIST':
        return this.formatWalletListResponse(response.data as Record<string, unknown>[]);

      case 'SWAP':
        return this.formatSwapQuoteResponse(response.data as Record<string, unknown>);

      default:
        return `✅ Data retrieved successfully\n${JSON.stringify(response.data, null, 2)}`;
    }
  }

  // 格式化方法 - 简洁、直接，没有模板话语
  private static formatNewsResponse(data: Record<string, unknown>): string {
    const news = data as Record<string, unknown>;
    const items = (news.news as unknown[]) || [];
    if (items.length === 0) return '📰 No latest news';
    return `📰 Latest News (${items.length} items)\n${items.slice(0, 3).map(n => `• ${n}`).join('\n')}`;
  }

  private static formatSocialTrendingResponse(data: Record<string, unknown>): string {
    const social = data as Record<string, unknown>;
    const tokens = (social.tokens as unknown[]) || [];
    if (tokens.length === 0) return '🔥 No trending tokens';
    return `🔥 Trending Tokens\n${tokens.slice(0, 5).map((t: unknown) => {
      const token = t as Record<string, unknown>;
      return `• ${token.symbol} - ${token.mentions} mentions`;
    }).join('\n')}`;
  }

  private static formatMarketOverviewResponse(data: Record<string, unknown>): string {
    const overview = data as Record<string, unknown>;
    return `📊 Market Overview\n💰 Total Volume: $${overview.totalVolume}\n⛓️ Active Chains: ${overview.activeChains}\n🏆 Top Protocols: ${overview.topProtocols}`;
  }

  private static formatChainsResponse(data: Record<string, unknown>[]): string {
    const chains = data;
    if (chains.length === 0) return '⛓️ No chain data';
    return `⛓️ Chain Data\n${chains.slice(0, 5).map((c: Record<string, unknown>) => `• ${c.name}: $${c.tvl}`).join('\n')}`;
  }

  private static formatProtocolsResponse(data: Record<string, unknown>[]): string {
    const protocols = data;
    if (protocols.length === 0) return '📈 No protocol data';
    return `📈 Trending Protocols\n${protocols.slice(0, 5).map((p: Record<string, unknown>) => `• ${p.name}: ${p.volume}`).join('\n')}`;
  }

  private static formatTokenDetailResponse(data: Record<string, unknown>): string {
    const token = data as Record<string, unknown>;
    return `💰 ${token.symbol}\nPrice: $${token.price}\nMarket Cap: $${token.marketCap}\n24h: ${token.change24h}%`;
  }

  private static formatSecurityResponse(data: Record<string, unknown>): string {
    const security = data as Record<string, unknown>;
    const lines: string[] = [];

    // Status and risk score
    const status = security.status as string | undefined;
    const riskScore = security.riskScore as number | undefined;

    if (status) {
      const statusEmoji = status.toLowerCase() === 'safe' ? '✅' : status.toLowerCase() === 'dangerous' ? '🔴' : '⚠️';
      lines.push(`**Status:** ${statusEmoji} ${status}`);
    }

    if (riskScore !== undefined) {
      const scoreEmoji = riskScore <= 30 ? '🟢' : riskScore <= 70 ? '🟡' : '🔴';
      lines.push(`**Risk Score:** ${scoreEmoji} ${riskScore}/100`);
    }

    // Honeypot check
    const isHoneypot = security.isHoneypot as boolean | undefined;
    if (isHoneypot !== undefined) {
      lines.push(`**Honeypot:** ${isHoneypot ? '🔴 YES - DO NOT BUY' : '✅ No'}`);
    }

    // Tax info
    const buyTax = security.buyTax as number | undefined;
    const sellTax = security.sellTax as number | undefined;
    if (buyTax !== undefined || sellTax !== undefined) {
      lines.push(`**Taxes:** Buy ${buyTax ?? '?'}% / Sell ${sellTax ?? '?'}%`);
    }

    // Recommendation
    const recommendation = security.recommendation as string | undefined;
    if (recommendation) {
      lines.push('');
      lines.push(`**Recommendation:** ${recommendation}`);
    }

    // Positives
    const positives = security.positives as string[] | undefined;
    if (positives && positives.length > 0) {
      lines.push('');
      lines.push('**✅ Positive Signals:**');
      positives.slice(0, 5).forEach(p => lines.push(`• ${p}`));
    }

    // Warnings
    const warnings = security.warnings as string[] | undefined;
    if (warnings && warnings.length > 0) {
      lines.push('');
      lines.push('**⚠️ Warnings:**');
      warnings.slice(0, 5).forEach(w => lines.push(`• ${w}`));
    }

    // Details object
    const details = security.details as Record<string, boolean> | undefined;
    if (details && typeof details === 'object') {
      const detailItems: string[] = [];
      if (details.isOpenSource !== undefined) detailItems.push(`Open Source: ${details.isOpenSource ? '✅' : '❌'}`);
      if (details.hasRenouncedOwner !== undefined) detailItems.push(`Owner Renounced: ${details.hasRenouncedOwner ? '✅' : '❌'}`);
      if (details.isMintable !== undefined) detailItems.push(`Mintable: ${details.isMintable ? '⚠️ Yes' : '✅ No'}`);
      if (details.canDisableTrade !== undefined) detailItems.push(`Can Disable Trade: ${details.canDisableTrade ? '🔴 Yes' : '✅ No'}`);

      if (detailItems.length > 0) {
        lines.push('');
        lines.push('**Contract Details:**');
        lines.push(detailItems.join(' | '));
      }
    }

    // Source
    const source = security.source as string | undefined;
    if (source) {
      lines.push('');
      lines.push(`*Source: ${source}*`);
    }

    return lines.length > 0 ? lines.join('\n') : '🔒 Security scan completed - no detailed data available';
  }

  private static formatWalletListResponse(data: Record<string, unknown>[]): string {
    const wallets = data;
    if (wallets.length === 0) return '💼 No wallets';
    return `💼 My Wallets (${wallets.length})\n${wallets.slice(0, 3).map((w: Record<string, unknown>) => `• ${w.address}`).join('\n')}`;
  }

  private static formatSwapQuoteResponse(data: Record<string, unknown>): string {
    const quote = data as Record<string, unknown>;
    return `💱 Quote\nOutput: ${quote.amountOut}\nPrice Impact: ${quote.priceImpact}%\nReady to swap?`;
  }
}

export default AIApiService;
