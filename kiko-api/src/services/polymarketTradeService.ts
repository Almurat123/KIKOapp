import { GraphQLClient, gql } from 'graphql-request';

const GOLDSKY_ENDPOINT = 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn';
// Polymarket Collateral Token (USDC) ID in the graph usually appears as "0" or specific address
// In the reference repo logic: makerAssetId == "0" -> makerAsset is USDC.
const USDC_ASSET_ID = "0";

interface OrderFilledEvent {
    id: string;
    timestamp: string;
    transactionHash: string;
    maker: string;
    taker: string;
    makerAssetId: string;
    takerAssetId: string;
    makerAmountFilled: string;
    takerAmountFilled: string;
}

export interface FormattedTrade {
    timestamp: number;
    date: string;
    transactionHash: string;
    type: 'BUY' | 'SELL';
    price: number;
    amount: number; // Amount of shares
    volumeUSDC: number; // Volume in USDC
    maker: string;
    taker: string;
}

const client = new GraphQLClient(GOLDSKY_ENDPOINT);

/**
 * Fetch recent trades from Goldsky Subgraph
 */
export async function getRecentTrades(limit: number = 50): Promise<FormattedTrade[]> {
    const query = gql`
        query GetRecentTrades($limit: Int!) {
            orderFilledEvents(
                first: $limit, 
                orderBy: timestamp, 
                orderDirection: desc
            ) {
                id
                timestamp
                transactionHash
                maker
                taker
                makerAssetId
                takerAssetId
                makerAmountFilled
                takerAmountFilled
            }
        }
    `;

    try {
        const data = await client.request<{ orderFilledEvents: OrderFilledEvent[] }>(query, { limit });
        return data.orderFilledEvents.map(processTradeEvent);
    } catch (error) {
        console.error('Error fetching trades from Goldsky:', error);
        return [];
    }
}

/**
 * Fetch trades filtering by a specific Asset ID (Outcome Token)
 * Note: Goldsky schema might need 'where' clause adjustments.
 * Based on the reference repo, they fetch ALL and filter in Python.
 * For efficiency, we should try to filter by assetId if possible, 
 * but standard subgraphs usually allow 'where: { makerAssetId: "...", ... }'.
 * Since a market has 2 tokens (Yes/No), filtering by one asset ID gives only that outcome's trades.
 */
export async function getTradesByAssetId(assetId: string, limit: number = 50): Promise<FormattedTrade[]> {
    // We search for events where this asset was involved either as maker or taker
    const query = gql`
        query GetAssetTrades($assetId: String!, $limit: Int!) {
            orderFilledEvents(
                first: $limit,
                orderBy: timestamp,
                orderDirection: desc,
                where: { or: [{ makerAssetId: $assetId }, { takerAssetId: $assetId }] }
            ) {
                id
                timestamp
                transactionHash
                maker
                taker
                makerAssetId
                takerAssetId
                makerAmountFilled
                takerAmountFilled
            }
        }
    `;

    try {
        const data = await client.request<{ orderFilledEvents: OrderFilledEvent[] }>(query, { assetId, limit });
        return data.orderFilledEvents.map(event => processTradeEvent(event));
    } catch (error) {
        console.error(`Error fetching trades for asset ${assetId}:`, error);
        return [];
    }
}

/**
 * Process raw event into human readable trade
 * Logic adapted from 'process_live.py' in poly_data repo
 */
function processTradeEvent(event: OrderFilledEvent): FormattedTrade {
    const timestamp = parseInt(event.timestamp);
    const date = new Date(timestamp * 1000).toISOString();

    // Normalization (USDC on Polygon is 6 decimals)
    const makerAmount = parseFloat(event.makerAmountFilled) / 1e6;
    const takerAmount = parseFloat(event.takerAmountFilled) / 1e6;

    let type: 'BUY' | 'SELL';
    let price = 0;
    let shareAmount = 0;
    let volumeUSDC = 0;

    // Logic from reference:
    // If takerAsset == USDC (ID "0") -> Taker is spending USDC to buy Outcome -> BUY
    // If takerAsset != USDC -> Taker is spending Outcome to buy USDC -> SELL

    // Note: Use string comparison for safety
    if (event.takerAssetId === USDC_ASSET_ID) {
        type = 'BUY';
        // Taker gives USDC (takerAmount), gets Outcome (makerAmount)
        volumeUSDC = takerAmount;
        shareAmount = makerAmount;
        // Price = USDC / Shares
        price = shareAmount > 0 ? volumeUSDC / shareAmount : 0;
    } else {
        type = 'SELL';
        // Taker gives Outcome (takerAmount), gets USDC (makerAmount)
        shareAmount = takerAmount;
        volumeUSDC = makerAmount;
        // Price = USDC / Shares
        price = shareAmount > 0 ? volumeUSDC / shareAmount : 0;
    }

    return {
        timestamp,
        date,
        transactionHash: event.transactionHash,
        type,
        price,
        amount: shareAmount,
        volumeUSDC,
        maker: event.maker,
        taker: event.taker
    };
}

/**
 * Get recent large trades (Whale Activity)
 * Filters by USDC amount > minAmount
 */
export async function getWhaleTrades(minUsdcAmount: number = 1000, limit: number = 20): Promise<FormattedTrade[]> {
    // Convert human readable USDC to raw units (6 decimals)
    const rawAmount = Math.floor(minUsdcAmount * 1e6).toString();

    const query = gql`
        query GetWhaleTrades($limit: Int!, $minAmount: BigInt!) {
            orderFilledEvents(
                first: $limit,
                orderBy: timestamp,
                orderDirection: desc,
                where: {
                    or: [
                        { takerAssetId: "0", takerAmountFilled_gt: $minAmount },
                        { makerAssetId: "0", makerAmountFilled_gt: $minAmount }
                    ]
                }
            ) {
                id
                timestamp
                transactionHash
                maker
                taker
                makerAssetId
                takerAssetId
                makerAmountFilled
                takerAmountFilled
            }
        }
    `;

    try {
        const data = await client.request<{ orderFilledEvents: OrderFilledEvent[] }>(query, {
            limit,
            minAmount: rawAmount
        });
        return data.orderFilledEvents.map(processTradeEvent);
    } catch (error) {
        console.error('Error fetching whale trades:', error);
        return [];
    }
}
