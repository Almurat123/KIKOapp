export interface ScanHistoryItem {
    id: string;
    address: string;
    timestamp: number;
    time?: string;
    score: number;
    token?: any;
    status?: string;
    [key: string]: any;
}

export interface TokenSecurityResult {
    score: number;
    riskScore: number;
    risks: any[];
    tokenName?: string;
    tokenSymbol?: string;
    buyTax: number;
    sellTax: number;
    isHoneypot: boolean;
    isOpenSource: boolean;
    status: string;
    [key: string]: any;
}

export const securityService = {
    scanToken: async (address: string, chainId: string | number, _dex?: string): Promise<TokenSecurityResult> => {
        try {
            // Convert chainId to chain name
            const chainMap: Record<string | number, string> = {
                1: 'eth',
                'eth': 'eth',
                'ethereum': 'eth',
                56: 'bsc',
                'bsc': 'bsc',
                8453: 'base',
                'base': 'base',
            };

            const chain = chainMap[chainId] || String(chainId);

            const response = await fetch(`/api/tokens/security/${chain}/${address}`, {
                headers: {
                    'X-App-Key': localStorage.getItem('apiKey') || ''
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success || !result.data) {
                throw new Error('Invalid API response');
            }

            const data = result.data;

            return {
                score: 100 - data.riskLevel,
                riskScore: data.riskLevel,
                risks: data.isHoneypot ? ['Honeypot detected'] : [],
                buyTax: data.buyTax,
                sellTax: data.sellTax,
                isHoneypot: data.isHoneypot,
                isOpenSource: data.isOpenSource,
                status: data.riskCategory === 'low' ? 'Safe' : data.riskCategory === 'medium' ? 'Caution' : 'High Risk',
                authority: data.authority || '-',
                mintable: data.mintable,
            };
        } catch (error) {
            console.error('[SecurityService] Error fetching token security:', error);
            // Return safe defaults on error
            return {
                score: 100,
                riskScore: 0,
                risks: [],
                buyTax: 0,
                sellTax: 0,
                isHoneypot: false,
                isOpenSource: true,
                status: 'Unknown',
                authority: '-',
                mintable: false,
            };
        }
    },
    scanLocal: async (_address: string, _chain: string) => {
        return { score: 100, riskScore: 0, risks: [], status: 'Safe', findings: [] };
    },
    getScanHistory: (): ScanHistoryItem[] => [],
    saveToHistory: (_result: any, _name?: string, _symbol?: string) => { }
};
