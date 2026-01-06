/**
 * Zapper API Service (Frontend)
 * Fetches portfolio data from local backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

export async function fetchPortfolio(address: string): Promise<PortfolioData | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/zapper/portfolio?address=${address}`);

        if (!response.ok) {
            console.warn('Failed to fetch Zapper portfolio:', response.statusText);
            return null;
        }

        const json = await response.json();
        if (!json.success || !json.data) {
            return null; // Silent fail or handle error
        }

        return json.data as PortfolioData;
    } catch (error) {
        console.warn('Error fetching Zapper portfolio:', error);
        return null;
    }
}
