/**
 * Binance API Service
 * Documentation: https://binance-docs.github.io/apidocs/futures/en/
 */

const BINANCE_FUTURES_BASE_URL = 'https://fapi.binance.com';

/**
 * Get total Open Interest from major perpetual contracts
 * Uses /fapi/v1/openInterest for each contract and /fapi/v1/ticker/price for prices
 * Reference: https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest
 */
export async function getTotalPerpOpenInterest(): Promise<number> {
  try {
    // Top 100 perpetual contracts by volume and market cap
    // These represent the vast majority of total Open Interest on Binance
    const majorContracts = [
      // Top Tier (Top 25)
      'BTCUSDT',   // Bitcoin
      'ETHUSDT',   // Ethereum
      'BNBUSDT',   // BNB
      'SOLUSDT',   // Solana
      'XRPUSDT',   // XRP
      'ADAUSDT',   // Cardano
      'DOGEUSDT',  // Dogecoin
      'AVAXUSDT',  // Avalanche
      'MATICUSDT', // Polygon
      'DOTUSDT',   // Polkadot
      'LINKUSDT',  // Chainlink
      'UNIUSDT',   // Uniswap
      'ATOMUSDT',  // Cosmos
      'LTCUSDT',   // Litecoin
      'ETCUSDT',   // Ethereum Classic
      'XLMUSDT',   // Stellar
      'ALGOUSDT',  // Algorand
      'NEARUSDT',  // NEAR
      'APTUSDT',   // Aptos
      'ARBUSDT',   // Arbitrum
      'OPUSDT',    // Optimism
      'SUIUSDT',   // Sui
      'INJUSDT',   // Injective
      'TIAUSDT',   // Celestia
      'SEIUSDT',   // Sei
      // Additional Major Contracts (26-50)
      'FILUSDT',   // Filecoin
      'AAVEUSDT',  // Aave
      'MKRUSDT',   // Maker
      'SNXUSDT',   // Synthetix
      'CRVUSDT',   // Curve
      'RUNEUSDT',  // THORChain
      'RENDERUSDT', // Render
      'FETUSDT',   // Fetch.ai
      'ICPUSDT',   // Internet Computer
      'APTUSDT',   // Aptos
      'HBARUSDT',  // Hedera
      'VETUSDT',   // VeChain
      'THETAUSDT', // Theta
      'AXSUSDT',   // Axie Infinity
      'SANDUSDT',  // The Sandbox
      'MANAUSDT',  // Decentraland
      'ENJUSDT',   // Enjin
      'GALAUSDT',  // Gala
      'CHZUSDT',   // Chiliz
      'FLOWUSDT',  // Flow
      'EGLDUSDT',  // Elrond
      'ZILUSDT',   // Zilliqa
      'WAVESUSDT', // Waves
      'EOSUSDT',   // EOS
      'TRXUSDT',   // Tron
      'XMRUSDT',   // Monero
      'DASHUSDT',  // Dash
      'ZECUSDT',   // Zcash
      // Additional Contracts (51-75)
      'BCHUSDT',   // Bitcoin Cash
      'BSVUSDT',   // Bitcoin SV
      'COMPUSDT',  // Compound
      'YFIUSDT',   // Yearn Finance
      'SUSHIUSDT', // SushiSwap
      '1INCHUSDT', // 1inch
      'BALUSDT',   // Balancer
      'BANDUSDT',  // Band Protocol
      'KAVAUSDT',  // Kava
      'ZRXUSDT',   // 0x
      'OMGUSDT',   // OMG Network
      'SKLUSDT',   // SKALE
      'GRTUSDT',   // The Graph
      'BATUSDT',   // Basic Attention Token
      'ZENUSDT',   // Horizen
      'ONTUSDT',   // Ontology
      'QTUMUSDT',  // Qtum
      'IOTAUSDT',  // IOTA
      'NEOUSDT',   // NEO
      'WLDUSDT',   // Worldcoin
      'PEPEUSDT',  // Pepe
      'FLOKIUSDT', // Floki
      'BONKUSDT',  // Bonk
      '1000SHIBUSDT', // Shiba Inu
      '1000FLOKIUSDT', // Floki (alternative)
      // Additional Contracts (76-100)
      'ORDIUSDT',  // Ordinals
      'SATSUSDT',  // Satoshi
      'RATSUSDT',  // Rats
      '1000BONKUSDT', // Bonk (alternative)
      'JTOUSDT',   // Jito
      'PYTHUSDT',  // Pyth Network
      'JUPUSDT',   // Jupiter
      'WIFUSDT',   // dogwifhat
      'BOMEUSDT',  // BOOK OF MEME
      'MYROUSDT',  // Myro
      'POPCATUSDT', // Popcat
      'MEWUSDT',   // Mew
      'GMEUSDT',   // GameStop
      'NOTUSDT',   // Notcoin
      'BBUSDT',    // BB
      'LISTAUSDT', // Lista DAO
      'ENAUSDT',   // Ethena
      'WLDUSDT',   // Worldcoin
      'PIXELUSDT', // Pixels
      'PORTALUSDT', // Portal
      'PENDLEUSDT', // Pendle
      'AEVOUSDT',  // Aevo
      'METISUSDT', // Metis
      'MANTAUSDT', // Manta
      'ALTUSDT',   // AltLayer
      'XAIUSDT',   // Xai
      'AIUSDT',    // Sleepless AI
      'NFPUSDT',   // NFPrompt
      'ACEUSDT',   // ACE
      'NMRUSDT',   // Numeraire
      'GFTUSDT',   // Gifto
      'HOOKUSDT',  // Hooked Protocol
      'PHBUSDT',   // Phoenix
      'LDOUSDT',   // Lido DAO
      'STXUSDT',   // Stacks
    ];

    // Fetch with rate limiting (50ms delay between requests to avoid hitting limits)
    // Binance rate limit: 2400 requests per minute for /fapi/v1 endpoints
    const openInterestValues: number[] = [];

    for (let i = 0; i < majorContracts.length; i++) {
      const symbol = majorContracts[i];

      // Add delay to avoid rate limiting (except for first request)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      try {
        // Get Open Interest and price in parallel for each symbol
        const [oiResponse, priceResponse] = await Promise.all([
          fetch(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`),
          fetch(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/price?symbol=${symbol}`),
        ]);

        if (!oiResponse.ok || !priceResponse.ok) {
          console.warn(`Failed to fetch data for ${symbol}:`, {
            oiStatus: oiResponse.status,
            priceStatus: priceResponse.status,
          });
          continue;
        }

        const oiData = await oiResponse.json() as { openInterest: string; symbol: string; time?: number };
        const priceData = await priceResponse.json() as { price: string };

        const openInterest = parseFloat(oiData.openInterest || '0');
        const price = parseFloat(priceData.price || '0');

        if (openInterest > 0 && price > 0) {
          // Calculate USD value: Open Interest (in base asset) * Price (in USDT)
          // Example: BTC OI = 30,000 BTC, Price = $60,000, USD Value = $1.8B
          const usdValue = openInterest * price;
          openInterestValues.push(usdValue);

          // Log for debugging (only for top 3 contracts to avoid spam)
          if (symbol === 'BTCUSDT' || symbol === 'ETHUSDT' || symbol === 'BNBUSDT') {
            console.log(`${symbol}: OI=${openInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}, Price=$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}, USD Value=$${(usdValue / 1e9).toFixed(2)}B`);
          }
        }
      } catch (error) {
        console.warn(`Error fetching Open Interest for ${symbol}:`, error);
        // Continue with other contracts even if one fails
        continue;
      }
    }

    if (openInterestValues.length === 0) {
      throw new Error('Failed to fetch any Open Interest data from Binance');
    }

    // Sum all Open Interest values
    const totalOpenInterest = openInterestValues.reduce((sum, value) => sum + value, 0);

    console.log(`Fetched Open Interest for ${openInterestValues.length}/${majorContracts.length} contracts`);
    console.log(`Total Perpetual Open Interest: $${(totalOpenInterest / 1e9).toFixed(2)}B`);

    // Validate: Binance total OI is typically 30-60B, so 17B is reasonable for top 25 contracts
    // Note: This is only a subset of all contracts, so actual total would be higher
    if (totalOpenInterest > 100e9) {
      console.warn(`Warning: Total OI seems unusually high (${(totalOpenInterest / 1e9).toFixed(2)}B). Please verify calculation.`);
    }

    return totalOpenInterest;
  } catch (error) {
    console.error('Error fetching total perpetual Open Interest from Binance:', error);
    throw error;
  }
}

/**
 * Get Open Interest for a specific contract
 */
export async function getContractOpenInterest(symbol: string): Promise<number> {
  try {
    const url = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const openInterest = parseFloat(data.openInterest || '0');

    // Get price to convert to USD
    const priceUrl = `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/price?symbol=${symbol}`;
    const priceResponse = await fetch(priceUrl);

    if (!priceResponse.ok) {
      return openInterest; // Return raw value if price fetch fails
    }

    const priceData = await priceResponse.json() as any;
    const price = parseFloat(priceData.price || '0');

    return openInterest * price;
  } catch (error) {
    console.error(`Error fetching Open Interest for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Binance Spot API Base URL
 */
const BINANCE_SPOT_BASE_URL = 'https://api.binance.com';

/**
 * Get price for a specific symbol from Binance Spot
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDT', 'ETHUSDT')
 */
export async function getSpotPrice(symbol: string): Promise<{ symbol: string; price: string } | null> {
  try {
    const url = `${BINANCE_SPOT_BASE_URL}/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`;
    console.log(`[Binance] Fetching: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.warn(`[Binance] API error for ${symbol}: ${response.status} ${response.statusText} - ${errorText}`);
      return null;
    }

    const data = await response.json() as { symbol: string; price: string };
    console.log(`[Binance] Success: ${symbol} = ${data.price}`);
    return data;
  } catch (error) {
    console.error(`[Binance] Exception for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get all spot prices from Binance
 * Returns array of all trading pairs with their prices
 */
export async function getAllSpotPrices(): Promise<Array<{ symbol: string; price: string }>> {
  try {
    const url = `${BINANCE_SPOT_BASE_URL}/api/v3/ticker/price`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Binance Spot API error: ${response.statusText}`);
    }

    const data = await response.json() as Array<{ symbol: string; price: string }>;
    return data;
  } catch (error) {
    console.error('Error fetching all Binance spot prices:', error);
    throw error;
  }
}

/**
 * Search for a token price by symbol (e.g., 'BTC', 'ETH', 'SOL')
 * Automatically tries common quote currencies (USDT, USDC, BUSD)
 */
export async function searchTokenPrice(tokenSymbol: string): Promise<{
  symbol: string;
  price: number;
  quoteCurrency: string;
} | null> {
  const normalizedSymbol = tokenSymbol.toUpperCase();
  const quoteCurrencies = ['USDT', 'USDC', 'BUSD', 'USD'];

  for (const quote of quoteCurrencies) {
    const tradingPair = `${normalizedSymbol}${quote}`;
    const result = await getSpotPrice(tradingPair);

    if (result) {
      return {
        symbol: normalizedSymbol,
        price: parseFloat(result.price),
        quoteCurrency: quote
      };
    }
  }

  console.warn(`Could not find price for ${tokenSymbol} on Binance`);
  return null;
}
