import axios from 'axios';

// [Logic]: 延迟函数。
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// [Logic]: 获取热门代币列表，增加重试逻辑。
export async function getTrendingTokens(network: string, limit: number) {
    const tokens = new Set<string>();
    let page = 1;
    while (tokens.size < limit && page <= 5) { // 减少页面请求，大部分热门在前几页
        try {
            const url = `https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools?page=${page}`;
            const { data } = await axios.get(url);
            data.data.forEach((p: any) => {
                // 提取 base_token 和 quote_token 地址
                const base = p.relationships?.base_token?.data?.id?.split('_')[1];
                if (base && tokens.size < limit) tokens.add(base);
            });
            if (data.data.length < 20) break;
            page++;
            await sleep(2000); // 增加请求间隔
        } catch (e: any) {
            if (e.response?.status === 429) {
                console.warn('  ! Rate limited, sleeping 5s...');
                await sleep(5000);
                continue; // 重试当前页
            }
            throw e;
        }
    }
    return Array.from(tokens);
}

// [Logic]: 使用池子地址获取最近交易。
export async function fetchTrades(network: string, pool: string) {
    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}/trades`;
    const { data } = await axios.get(url);
    return data.data;
}

// [Logic]: 获取代币流动性最大的池子。
export async function getTopPool(network: string, token: string) {
    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${token}/pools`;
    const { data } = await axios.get(url);
    return data.data?.[0]?.attributes?.address;
}
