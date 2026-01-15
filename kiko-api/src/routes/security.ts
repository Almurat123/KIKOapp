/**
 * Security Scanning API Routes
 * Proxies requests to GoPlus and QuickIntel APIs
 */

import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { get, set } from '../cache/redis.js';
import { AppError, handleExternalApiError } from '../middleware/errorHandler.js';
import { validateAddress } from '../utils/validation.js';
import { CheckTokenRiskTool } from '../skills/RiskSkill/index.js';

const SECURITY_CACHE_TTL = env.cacheConfig.securityCacheTtl;

// Chain ID mapping
const CHAIN_IDS: Record<string, number> = {
  eth: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  base: 8453,
  fantom: 250,
};

/**
 * Fetch token security from GoPlus API
 */
async function fetchGoPlusSecurity(chainId: number, contractAddress: string): Promise<any> {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${contractAddress}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // GoPlus API works without key for basic usage
  // API key format seems to cause signature errors, so we'll skip it for now
  // If you have a valid API key, you may need to check the correct format from GoPlus docs
  // if (env.apiKeys.goplus) {
  //   headers['X-API-KEY'] = env.apiKeys.goplus;
  // }

  console.log(`[Security] Fetching from GoPlus: ${url}`);

  try {
    // Create timeout controller for compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Security] GoPlus API HTTP error: ${response.status} ${response.statusText}`, errorText.substring(0, 200));

      // If it's a signature/auth error, try without API key
      if (response.status === 401 || response.status === 403 || errorText.includes('signature')) {
        console.log('[Security] Retrying GoPlus without API key...');
        const retryHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
        const retryResponse = await fetch(url, { headers: retryHeaders });
        if (retryResponse.ok) {
          const retryData: any = await retryResponse.json();
          if (retryData.code === 1 && retryData.result && retryData.result[contractAddress]) {
            console.log('[Security] GoPlus API succeeded without API key');
            return retryData.result[contractAddress];
          }
        }
      }

      throw new Error(`GoPlus API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
    }

    const data: any = await response.json();
    console.log(`[Security] GoPlus API response code: ${data.code}, has result: ${!!data.result}`);

    if (data.code !== 1 || !data.result || !data.result[contractAddress]) {
      console.error('[Security] GoPlus API invalid response:', {
        code: data.code,
        message: data.message,
        hasResult: !!data.result,
        hasAddress: !!(data.result && data.result[contractAddress]),
      });
      throw new Error(data.message || 'GoPlus API returned invalid data');
    }

    return data.result[contractAddress];
  } catch (error: any) {
    console.error('[Security] GoPlus fetch error:', error.message || error);
    throw error;
  }
}

/**
 * Fetch honeypot data from QuickIntel API
 * Note: QuickIntel free API doesn't require an API key
 */
async function fetchQuickIntelHoneypot(dex: string, contractAddress: string): Promise<any> {
  // QuickIntel API seems to not be publicly available or requires subscription
  // For now, we'll skip it and rely on GoPlus only
  // This function will return null to indicate it's not available
  console.warn('[Security] QuickIntel API is not available (requires subscription). Skipping...');
  throw new Error('QuickIntel API requires subscription and is not available');
}

/**
 * Calculate risk score from security data
 */
function calculateRiskScore(data: any): number {
  let risk = 0;

  // Honeypot detection (critical)
  if (data.isHoneypot) risk += 50;

  // High taxes (major risk)
  const buyTax = data.buyTax || 0;
  const sellTax = data.sellTax || 0;
  if (sellTax > 20) risk += 30;
  else if (sellTax > 10) risk += 15;
  else if (sellTax > 5) risk += 5;

  if (buyTax > 20) risk += 10;
  else if (buyTax > 10) risk += 5;

  // Ownership risks
  if (data.canTakeBackOwnership) risk += 15;
  if (data.hiddenOwner) risk += 10;
  if (!data.hasRenouncedOwner && data.ownerAddress && data.ownerAddress !== '0x0000000000000000000000000000000000000000') {
    risk += 5;
  }

  // Security flags
  if (data.isBlacklisted) risk += 20;
  if (data.cannotSellAll) risk += 15;
  if (data.canDisableTrade) risk += 10;
  if (data.isMintable) risk += 5;
  if (data.selfdestruct) risk += 10;
  if (data.externalCall) risk += 5;

  // Positive factors (reduce risk)
  if (data.isOpenSource) risk -= 5;
  if (data.hasRenouncedOwner) risk -= 5;
  if (data.isInDex) risk -= 3;

  return Math.max(0, Math.min(100, Math.round(risk)));
}

/**
 * Determine status from risk score
 */
function getStatusFromScore(score: number): 'Safe' | 'Medium' | 'High Risk' {
  if (score < 30) return 'Safe';
  if (score < 70) return 'Medium';
  return 'High Risk';
}

/**
 * Parse GoPlus result
 */
function parseGoPlusResult(data: any, address: string, chainId: number, chain: string): any {
  return {
    address,
    chainId,
    chain,
    isHoneypot: data.is_honeypot === '1',
    buyTax: parseFloat(data.buy_tax || '0'),
    sellTax: parseFloat(data.sell_tax || '0'),
    isBlacklisted: data.is_blacklisted === '1',
    isWhitelisted: data.is_whitelisted === '1',
    isOpenSource: data.is_open_source === '1',
    isProxy: data.is_proxy === '1',
    isMintable: data.is_mintable === '1',
    ownerAddress: data.owner_address,
    creatorAddress: data.creator_address,
    hasRenouncedOwner: data.has_renounced_owner === '1',
    canTakeBackOwnership: data.can_take_back_ownership === '1',
    hiddenOwner: data.hidden_owner === '1',
    canDisableTrade: data.can_disable_trade === '1',
    cannotSellAll: data.cannot_sell_all === '1',
    transferPausable: data.transfer_pausable === '1',
    isAntiWhale: data.is_anti_whale === '1',
    selfdestruct: data.selfdestruct === '1',
    externalCall: data.external_call === '1',
    totalSupply: data.total_supply,
    holders: data.holders,
    liquidity: data.liquidity,
    isInDex: data.is_in_dex === '1',
    sources: { goplus: true },
  };
}

/**
 * Parse QuickIntel result
 */
function parseQuickIntelResult(data: any, address: string): any {
  console.log('[Security] Parsing QuickIntel result, data keys:', Object.keys(data || {}));

  // QuickIntel API might return different formats, handle both
  const result: any = {
    address,
    sources: { quickintel: true },
  };

  // Handle honeypot detection (can be boolean or string)
  if (data.is_honeypot !== undefined) {
    result.isHoneypot = data.is_honeypot === true || data.is_honeypot === '1' || data.is_honeypot === 1;
  } else if (data.isHoneypot !== undefined) {
    result.isHoneypot = data.isHoneypot === true || data.isHoneypot === '1' || data.isHoneypot === 1;
  }

  result.honeypotReason = data.reason || data.honeypotReason;
  result.buyTax = typeof data.buy_tax === 'number' ? data.buy_tax : (typeof data.buyTax === 'number' ? data.buyTax : parseFloat(data.buy_tax || data.buyTax || '0'));
  result.sellTax = typeof data.sell_tax === 'number' ? data.sell_tax : (typeof data.sellTax === 'number' ? data.sellTax : parseFloat(data.sell_tax || data.sellTax || '0'));
  result.transferTax = typeof data.transfer_tax === 'number' ? data.transfer_tax : (typeof data.transferTax === 'number' ? data.transferTax : parseFloat(data.transfer_tax || data.transferTax || '0'));

  // Handle boolean fields (can be boolean, string '1'/'0', or number 1/0)
  const boolFields = [
    'isBlacklisted', 'isWhitelisted', 'isOpenSource', 'isProxy', 'isMintable',
    'hasRenouncedOwner', 'canTakeBackOwnership', 'hiddenOwner', 'canDisableTrade',
    'cannotSellAll', 'transferPausable', 'isAntiWhale', 'selfdestruct', 'externalCall', 'isInDex'
  ];

  boolFields.forEach(field => {
    const snakeKey = field.replace(/([A-Z])/g, '_$1').toLowerCase();
    const value = data[field] !== undefined ? data[field] : data[snakeKey];
    if (value !== undefined) {
      result[field] = value === true || value === '1' || value === 1;
    }
  });

  // Handle address fields
  result.ownerAddress = data.owner_address || data.ownerAddress;
  result.creatorAddress = data.creator_address || data.creatorAddress;

  // Handle numeric/string fields
  if (data.total_supply !== undefined || data.totalSupply !== undefined) {
    result.totalSupply = (data.total_supply || data.totalSupply)?.toString();
  }
  if (data.holders !== undefined) {
    result.holders = data.holders?.toString();
  }

  console.log('[Security] QuickIntel parsed result:', {
    isHoneypot: result.isHoneypot,
    buyTax: result.buyTax,
    sellTax: result.sellTax,
  });

  return result;
}

/**
 * Merge results from multiple sources
 */
function mergeResults(goplusResult: any, quickintelResult: any): any {
  const hasGoplus = !!goplusResult.sources?.goplus;
  const hasQuickintel = !!quickintelResult.sources?.quickintel;

  // Helper to safely get value, preferring non-empty values
  const getValue = (goplusVal: any, quickintelVal: any) => {
    if (hasQuickintel && quickintelVal !== undefined && quickintelVal !== null && quickintelVal !== '') {
      return quickintelVal;
    }
    if (hasGoplus && goplusVal !== undefined && goplusVal !== null && goplusVal !== '') {
      return goplusVal;
    }
    return undefined;
  };

  // Helper to safely get boolean, preferring true if either is true
  const getBool = (goplusVal: any, quickintelVal: any) => {
    if (hasQuickintel && (quickintelVal === true || quickintelVal === '1' || quickintelVal === 1)) {
      return true;
    }
    if (hasGoplus && (goplusVal === true || goplusVal === '1' || goplusVal === 1)) {
      return true;
    }
    return false;
  };

  // Helper to safely get number, taking max if both exist, otherwise use the available one
  const getMaxNumber = (goplusVal: any, quickintelVal: any) => {
    const goplusNum = hasGoplus && goplusVal !== undefined ? (typeof goplusVal === 'number' ? goplusVal : parseFloat(goplusVal || '0') || 0) : 0;
    const quickintelNum = hasQuickintel && quickintelVal !== undefined ? (typeof quickintelVal === 'number' ? quickintelVal : parseFloat(quickintelVal || '0') || 0) : 0;
    return Math.max(goplusNum, quickintelNum);
  };

  const merged: any = {
    address: goplusResult.address || quickintelResult.address || '',
    chainId: goplusResult.chainId || quickintelResult.chainId || 1,
    chain: goplusResult.chain || quickintelResult.chain || 'eth',
    isHoneypot: hasQuickintel ? (quickintelResult.isHoneypot ?? false) : (goplusResult.isHoneypot ?? false),
    honeypotReason: quickintelResult.honeypotReason || goplusResult.honeypotReason,
    buyTax: getMaxNumber(goplusResult.buyTax, quickintelResult.buyTax),
    sellTax: getMaxNumber(goplusResult.sellTax, quickintelResult.sellTax),
    transferTax: quickintelResult.transferTax || goplusResult.transferTax,
    isBlacklisted: getBool(goplusResult.isBlacklisted, quickintelResult.isBlacklisted),
    isWhitelisted: getBool(goplusResult.isWhitelisted, quickintelResult.isWhitelisted),
    // For isOpenSource, if both exist require both true, otherwise use available one
    isOpenSource: hasGoplus && hasQuickintel
      ? ((goplusResult.isOpenSource === true || goplusResult.isOpenSource === '1') && (quickintelResult.isOpenSource === true || quickintelResult.isOpenSource === '1'))
      : getBool(goplusResult.isOpenSource, quickintelResult.isOpenSource),
    isProxy: getBool(goplusResult.isProxy, quickintelResult.isProxy),
    isMintable: getBool(goplusResult.isMintable, quickintelResult.isMintable),
    ownerAddress: getValue(goplusResult.ownerAddress, quickintelResult.ownerAddress),
    creatorAddress: getValue(goplusResult.creatorAddress, quickintelResult.creatorAddress),
    // For hasRenouncedOwner, if both exist require both true, otherwise use available one
    hasRenouncedOwner: hasGoplus && hasQuickintel
      ? ((goplusResult.hasRenouncedOwner === true || goplusResult.hasRenouncedOwner === '1') && (quickintelResult.hasRenouncedOwner === true || quickintelResult.hasRenouncedOwner === '1'))
      : getBool(goplusResult.hasRenouncedOwner, quickintelResult.hasRenouncedOwner),
    canTakeBackOwnership: getBool(goplusResult.canTakeBackOwnership, quickintelResult.canTakeBackOwnership),
    hiddenOwner: getBool(goplusResult.hiddenOwner, quickintelResult.hiddenOwner),
    canDisableTrade: getBool(goplusResult.canDisableTrade, quickintelResult.canDisableTrade),
    cannotSellAll: getBool(goplusResult.cannotSellAll, quickintelResult.cannotSellAll),
    transferPausable: getBool(goplusResult.transferPausable, quickintelResult.transferPausable),
    isAntiWhale: getBool(goplusResult.isAntiWhale, quickintelResult.isAntiWhale),
    selfdestruct: getBool(goplusResult.selfdestruct, quickintelResult.selfdestruct),
    externalCall: getBool(goplusResult.externalCall, quickintelResult.externalCall),
    totalSupply: getValue(goplusResult.totalSupply, quickintelResult.totalSupply),
    // Holders can be a number (string) or array of holder objects
    holders: goplusResult.holders || quickintelResult.holders,
    holdersCount: Array.isArray(goplusResult.holders)
      ? goplusResult.holders.length
      : (Array.isArray(quickintelResult.holders)
        ? quickintelResult.holders.length
        : (goplusResult.holders || quickintelResult.holders || '0')),
    liquidity: getValue(goplusResult.liquidity, quickintelResult.liquidity),
    // For isInDex, if both exist require both true, otherwise use available one
    isInDex: hasGoplus && hasQuickintel
      ? ((goplusResult.isInDex === true || goplusResult.isInDex === '1') && (quickintelResult.isInDex === true || quickintelResult.isInDex === '1'))
      : getBool(goplusResult.isInDex, quickintelResult.isInDex),
    scannedAt: Date.now(),
    sources: {
      goplus: hasGoplus,
      quickintel: hasQuickintel,
    },
    riskScore: 0,
    status: 'Medium',
  };

  merged.riskScore = calculateRiskScore(merged);
  merged.status = getStatusFromScore(merged.riskScore);

  return merged;
}

export async function securityRoutes(fastify: FastifyInstance) {
  // GET /api/security/scan?address=0x...&chain=eth
  fastify.get('/scan', async (request, reply) => {
    try {
      const { address, chain = 'eth' } = request.query as {
        address?: string;
        chain?: string;
      };

      if (!address) {
        throw new AppError(400, 'Contract address is required', 'VALIDATION_ERROR');
      }

      if (!validateAddress(address, 'address')) {
        throw new AppError(400, 'Invalid contract address format', 'VALIDATION_ERROR');
      }
      const normalizedAddress = address.toLowerCase().trim();
      const cacheKey = `security:scan:${normalizedAddress}:${chain}`;
      const cached = await get(cacheKey);
      if (cached) {
        console.log(`[Security] Returning cached scan result for ${normalizedAddress}`);
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      console.log(`[Security] Scanning token: ${normalizedAddress} on chain ${chain}`);

      // Use enhanced tokenRisk tool (GoPlus + local scan + offline/online enrich)
      const data = await CheckTokenRiskTool.handler({ address: normalizedAddress, chain });

      await set(cacheKey, JSON.stringify(data), SECURITY_CACHE_TTL);

      return reply.send({
        success: true,
        data,
        cached: false,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Security Scan');
    }
  });

  // GET /api/security/scan-local?address=0x...&chain=eth
  // Local contract source code scanning (three-layer analysis)
  fastify.get('/scan-local', async (request, reply) => {
    try {
      const { address, chain = 'eth' } = request.query as {
        address?: string;
        chain?: string;
      };

      if (!address) {
        return reply.status(400).send({
          success: false,
          error: 'Contract address is required',
        });
      }

      // Normalize address
      const normalizedAddress = address.toLowerCase().trim();

      // Validate address
      if (!normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid contract address format',
        });
      }

      // Check cache
      const cacheKey = `security:scan-local:${normalizedAddress}:${chain}`;
      const cached = await get(cacheKey);
      if (cached) {
        console.log(`[Security] Returning cached local scan result for ${normalizedAddress}`);
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      console.log(`[Security] Starting local scan for ${normalizedAddress} on chain ${chain}`);

      // Try Go scanner first for near-instant results
      try {
        const goResp = await fetch(`http://localhost:8080/api/scan?address=${normalizedAddress}&chain=${chain}`);
        if (goResp.ok) {
          const goData = await goResp.json() as any;
          console.log(`[Security] ✓ Using high-performance Go flash-scanner for ${normalizedAddress}`);
          // Cache and return
          await set(cacheKey, JSON.stringify(goData), 3600);
          return reply.send({
            success: true,
            data: goData,
            cached: false,
            source: 'go-engine'
          });
        }
      } catch (e) {
        console.warn('[Security] Go scanner unavailable, falling back to Node.js scan...', e);
      }

      // Import services
      const { getContractSourceCode } = await import('../services/etherscan.js');
      const { scanContract } = await import('../services/contractScanner.js');

      // Fetch source code
      const sourceCodeData = await getContractSourceCode(normalizedAddress, chain);

      if (!sourceCodeData || !sourceCodeData.sourceCode) {
        return reply.status(404).send({
          success: false,
          error: 'Contract source code not found',
          message: 'Contract may not be verified on the block explorer. Only verified contracts can be scanned.',
        });
      }

      // Perform local scan
      const scanResult = scanContract(sourceCodeData.sourceCode, normalizedAddress, chain);

      // Add metadata
      const result = {
        ...scanResult,
        contractName: sourceCodeData.contractName,
        compilerVersion: sourceCodeData.compilerVersion,
        optimizationUsed: sourceCodeData.optimizationUsed,
        license: sourceCodeData.license,
      };

      // Cache result (1 hour)
      await set(cacheKey, JSON.stringify(result), 3600);

      console.log(`[Security] Local scan completed: ${scanResult.findings.length} findings, risk score: ${scanResult.riskScore}`);

      return reply.send({
        success: true,
        data: result,
        cached: false,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Contract Scanner');
    }
  });
}
