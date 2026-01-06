/**
 * DexScreener Trending Scraper
 * Uses Puppeteer with Stealth to scrape real trending tokens from DexScreener
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid Cloudflare detection
(puppeteer as any).use(StealthPlugin());

export interface ScrapedTrendingToken {
    rank: number;
    name: string;
    symbol: string;
    chain: string;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    volume: number;
    liquidity: number;
    marketCap: number;
    address?: string;
}

/**
 * Scrape trending tokens from DexScreener for a specific chain
 * @param chain - Chain to scrape: 'solana', 'base', 'bsc', 'ethereum'
 * @param duration - Trending duration: '1h', '6h', '24h'
 * @param limit - Max tokens to return
 */
export async function scrapeDexScreenerTrending(
    chain: string,
    duration: '1h' | '6h' | '24h' = '1h',
    limit: number = 15
): Promise<ScrapedTrendingToken[]> {
    console.log(`[DexScraper] Scraping trending for ${chain}, duration: ${duration}`);

    const browser = await (puppeteer as any).launch({
        headless: 'new',  // Use the new headless mode
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--window-size=1920,1080'
        ]
    });

    try {
        const page = await browser.newPage();

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to DexScreener trending page for the chain
        const url = `https://dexscreener.com/${chain}?rankBy=trendingScoreH1&order=desc`;
        console.log(`[DexScraper] Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for the token list to load
        await page.waitForSelector('[class*="ds-dex-table"]', { timeout: 15000 }).catch(() => null);

        // Wait a bit more for dynamic content
        await new Promise(r => setTimeout(r, 3000));

        // Debug: save screenshot
        await page.screenshot({ path: '/tmp/dexscreener-debug.png', fullPage: true });
        console.log('[DexScraper] Debug screenshot saved to /tmp/dexscreener-debug.png');

        // Extract token data from the table
        const tokens = await page.evaluate((maxTokens: number, chainName: string) => {
            const results: any[] = [];

            // Find all token rows
            const rows = document.querySelectorAll('a[href*="/"][class*="ds-dex-table-row"]');

            rows.forEach((row: Element, index: number) => {
                if (index >= maxTokens) return;

                try {
                    // Extract token name and symbol
                    const nameEl = row.querySelector('[class*="ds-dex-table-row-base-token-symbol"]');
                    const symbol = nameEl?.textContent?.trim() || '';

                    const fullNameEl = row.querySelector('[class*="ds-dex-table-row-base-token-name"]');
                    const name = fullNameEl?.textContent?.trim() || symbol;

                    // Extract price
                    const priceEl = row.querySelector('[class*="ds-dex-table-row-col-price"]');
                    const priceText = priceEl?.textContent?.replace('$', '').replace(/,/g, '') || '0';
                    const price = parseFloat(priceText) || 0;

                    // Extract price changes (1h column)
                    const changeEls = row.querySelectorAll('[class*="ds-dex-table-row-col-price-change"]');
                    let priceChange1h = 0;
                    let priceChange24h = 0;

                    changeEls.forEach((el: Element, i: number) => {
                        const text = el.textContent?.replace('%', '').trim() || '0';
                        const val = parseFloat(text) || 0;
                        if (i === 0) priceChange1h = val;
                        if (i === 2) priceChange24h = val;
                    });

                    // Helper function to parse values with K/M/B suffixes
                    const parseValue = (text: string | undefined | null): number => {
                        if (!text) return 0;
                        const cleaned = text.replace('$', '').replace(/,/g, '').trim();
                        const match = cleaned.match(/^([\d.]+)([KMB])?$/i);
                        if (!match) return parseFloat(cleaned) || 0;
                        const num = parseFloat(match[1]) || 0;
                        const suffix = (match[2] || '').toUpperCase();
                        if (suffix === 'K') return num * 1000;
                        if (suffix === 'M') return num * 1000000;
                        if (suffix === 'B') return num * 1000000000;
                        return num;
                    };

                    // Extract volume
                    const volumeEl = row.querySelector('[class*="ds-dex-table-row-col-volume"]');
                    const volume = parseValue(volumeEl?.textContent);

                    // Extract liquidity
                    const liqEl = row.querySelector('[class*="ds-dex-table-row-col-liquidity"]');
                    const liquidity = parseValue(liqEl?.textContent);

                    // Extract market cap
                    const mcapEl = row.querySelector('[class*="ds-dex-table-row-col-market-cap"]');
                    const marketCap = parseValue(mcapEl?.textContent);

                    if (symbol) {
                        results.push({
                            rank: index + 1,
                            name,
                            symbol,
                            chain: chainName,
                            price,
                            priceChange1h,
                            priceChange24h,
                            volume,
                            liquidity,
                            marketCap
                        });
                    }
                } catch (e) {
                    // Skip malformed rows
                }
            });

            return results;
        }, limit, chain);

        console.log(`[DexScraper] Scraped ${tokens.length} tokens from ${chain}`);
        return tokens;

    } catch (error) {
        console.error(`[DexScraper] Error scraping ${chain}:`, error);
        return [];
    } finally {
        await browser.close();
    }
}

/**
 * Scrape trending tokens from multiple chains
 */
export async function scrapeAllChainsTrending(
    chains: string[] = ['solana', 'base', 'bsc'],
    duration: '1h' | '6h' | '24h' = '1h',
    tokensPerChain: number = 5
): Promise<ScrapedTrendingToken[]> {
    console.log(`[DexScraper] Starting multi-chain scrape: ${chains.join(', ')}`);

    const results: ScrapedTrendingToken[] = [];

    // Scrape chains sequentially to avoid rate limiting
    for (const chain of chains) {
        const tokens = await scrapeDexScreenerTrending(chain, duration, tokensPerChain);
        results.push(...tokens);

        // Small delay between chains
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`[DexScraper] Total scraped: ${results.length} tokens`);
    return results;
}
