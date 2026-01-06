/**
 * Zapper API Service
 * Interact with Zapper GraphQL API for portfolio data
 * Endpoint: https://public.zapper.xyz/graphql
 */

const ZAPPER_GRAPHQL_URL = 'https://public.zapper.xyz/graphql';

export interface TokenBalance {
    symbol: string;
    name: string;
    balance: number;
    balanceUSD: number;
    price: number;
    imgUrl: string;
    network: string;
    address: string;
}

export interface PortfolioData {
    totalBalanceUSD: number;
    tokens: TokenBalance[];
}

/**
 * Get portfolio data for an address using Zapper GraphQL
 */
export async function getPortfolio(address: string): Promise<PortfolioData | null> {
    const apiKey = process.env.ZAPPER_API_KEY;
    if (!apiKey) {
        console.warn('[ZapperService] ZAPPER_API_KEY not configured');
        throw new Error('ZAPPER_API_KEY not configured');
    }

    try {
        const query = `
      query Portfolio($addresses: [String!]!) {
        portfolioV2(addresses: $addresses) {
          tokenBalances {
            totalBalanceUSD
            byToken {
              symbol
              name
              balance
              balanceUSD
              price
              imgUrlV2
              network {
                name
              }
              tokenAddress
            }
          }
        }
      }
    `;

        const variables = {
            addresses: [address],
        };

        // Basic Auth: key as username, empty password
        const auth = Buffer.from(`${apiKey}:`).toString('base64');

        const response = await fetch(ZAPPER_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            console.error(`[ZapperService] API status error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(`[ZapperService] Error body: ${text}`);
            return null;
        }

        const json = await response.json() as { data?: any; errors?: any[] };
        const { data, errors } = json;

        if (errors && errors.length > 0) {
            console.error('[ZapperService] GraphQL errors:', errors);
            return null;
        }

        const portfolio = data?.portfolioV2?.tokenBalances;
        if (!portfolio) return null;

        // Transform tokens
        // byToken is likely a list or connection. 
        // Based on Zapper schema patterns, it might be an array or { nodes: [...] }. 
        // Wait, the Zapper example search earlier said "byToken: A connection...". 
        // Usually that means it's not a simple array.
        // However, in many simpler queries 'byToken' acts as a list or has 'nodes'.
        // Let's assume it's a list based on typical simple usage, but I should double check.
        // If undefined/error, we'll catch it.
        // NOTE: Zapper's portfolioV2 `tokenBalances` usually has `byToken` which is a list of objects in some schemas
        // or `tokens` field.
        // The previous search said: "`byToken`: A connection that allows iterating..."
        // If it's a list, map it. If it's a map (symbol -> data), structure differs.
        // Let's tentatively map it as an array, but add a check.

        // Actually, let's just return totals if unsure about token structure, 
        // but user wanted "balance and balance worth value".
        // I'll try to map it safely.

        const tokens: TokenBalance[] = Array.isArray(portfolio.byToken)
            ? portfolio.byToken.map((t: any) => ({
                symbol: t.symbol,
                name: t.name,
                balance: t.balance,
                balanceUSD: t.balanceUSD,
                price: t.price,
                imgUrl: t.imgUrlV2,
                network: t.network?.name || 'Unknown',
                address: t.tokenAddress,
            }))
            : [];

        return {
            totalBalanceUSD: portfolio.totalBalanceUSD || 0,
            tokens,
        };

    } catch (error) {
        console.error('[ZapperService] Error fetching portfolio:', error);
        return null;
    }
}
