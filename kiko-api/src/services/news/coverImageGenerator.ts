import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { NewsTrendingData } from './trendingCollector.js';

// Configuration
const OUTPUT_DIR = path.resolve(process.cwd(), '../kiko-web/public/news-covers');
const LOGO_PATH = path.resolve(process.cwd(), '../kiko-web/public/kiko-logo-dark.png');

// Chain Logo Map (using high quality CDN images)
const CHAIN_LOGOS: Record<string, string> = {
    'eth': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    'base': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    'solana': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    'bnb smart chain': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png'
};

// Updated HTML Template - Single Column Row Layout with Base.org Blue Style
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <style>

        body {
            margin: 0;
            padding: 0;
            width: 1024px;
            height: 630px;
            background: linear-gradient(180deg, #0a0f1a 0%, #050810 100%);
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
        }

        /* Ambient Glow - Base Blue */
        .glow {
            position: absolute;
            width: 800px;
            height: 400px;
            background: radial-gradient(ellipse, rgba(0, 82, 255, 0.12) 0%, rgba(0,0,0,0) 70%);
            top: -100px;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: none;
        }

        .container {
            padding: 48px 60px;
            z-index: 1;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .brand-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 40px;
        }

        .logo {
            height: 60px;
            width: auto;
        }

        .date {
            font-size: 20px;
            color: #4a5568;
            font-weight: 500;
            margin-top: 5px;
        }

        .header-text h1 {
            font-size: 42px;
            font-weight: 800;
            margin: 0;
            color: #ffffff;
            letter-spacing: -1px;
            text-align: right;
        }

        /* Single Column List */
        .list {
            display: flex;
            flex-direction: column;
            gap: 16px;
            flex: 1;
        }

        .row {
            background: rgba(10, 20, 40, 0.7);
            border: 1px solid rgba(0, 82, 255, 0.25);
            border-radius: 16px;
            padding: 16px 32px;
            display: flex;
            align-items: center;
            box-shadow: 0 0 20px rgba(0, 82, 255, 0.08);
            backdrop-filter: blur(10px);
        }

        .token-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            margin-right: 20px;
            background: #1a2540;
            object-fit: cover;
            border: 2px solid rgba(0, 82, 255, 0.4);
        }

        .token-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .token-name {
            font-size: 16px;
            color: #94a3b8;
            font-weight: 500;
        }

        .token-symbol {
            font-size: 22px;
            font-weight: 700;
            color: #ffffff;
        }

        /* Data Columns */
        .data-col {
            text-align: right;
            min-width: 140px;
            margin-left: 24px;
        }

        .data-label {
            font-size: 13px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 6px;
        }

        .data-value {
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
        }

        .change-value {
            font-size: 20px;
            font-weight: 700;
        }

        .change-value.up {
            color: #4ade80;
        }

        .change-value.down {
            color: #f87171;
        }

        .mcap-value {
            font-size: 20px;
            font-weight: 700;
            color: #0052FF;
        }
    </style>
</head>
<body>
    <div class="glow"></div>
    <div class="container">
        <div class="brand-header">
            <img src="{{LOGO_BASE64}}" class="logo" />
            <div class="header-text">
                <h1>On-Chain Market Watch</h1>
                <div class="date">{{DATE}}</div>
            </div>
        </div>

        <div class="list">
            {{ROWS}}
        </div>
    </div>
</body>
</html>
`;

function generateRowHtml(token: any): string {
    const isUp = token.priceChange >= 0;
    const changeClass = isUp ? 'up' : 'down';
    const changeSign = isUp ? '+' : '';
    const mcapFormatted = formatMarketCap(token.marketCap);
    const priceFormatted = formatPrice(token.price);

    return `
    <div class="row">
        <img src="${token.imageUrl || 'https://via.placeholder.com/48'}" class="token-icon" onerror="this.src='https://via.placeholder.com/48?text=${token.symbol}'" />
        <div class="token-info">
            <div class="token-name">${token.name}</div>
            <div class="token-symbol">$${token.symbol}</div>
        </div>
        <div class="data-col">
            <div class="data-label">Price</div>
            <div class="data-value">$${priceFormatted}</div>
        </div>
        <div class="data-col">
            <div class="data-label">Change</div>
            <div class="change-value ${changeClass}">${changeSign}${token.priceChange.toFixed(2)}%</div>
        </div>
        <div class="data-col">
            <div class="data-label">Market Cap</div>
            <div class="mcap-value">${mcapFormatted}</div>
        </div>
    </div>
    `;
}

function formatPrice(price: number | string): string {
    const num = typeof price === 'string' ? parseFloat(price) : price;

    if (num >= 1) {
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    if (num >= 0.01) {
        return num.toFixed(4);
    }

    // For small numbers, find first non-zero digit position
    const priceStr = num.toFixed(20);
    const match = priceStr.match(/^0\.0*([1-9]\d*)$/);

    if (match) {
        const significantDigits = match[1];
        const zeroCount = priceStr.indexOf(significantDigits[0]) - 2; // zeros after "0."

        // If more than 5 zeros, use subscript notation
        // 0.0000002 has 6 zeros -> 0.0{5}2 (first 0 kept, remaining 5 shown as subscript)
        // 0.00000000819 has 8 zeros -> 0.0{7}819
        if (zeroCount > 5) {
            const displayDigits = significantDigits.slice(0, 4);
            return `0.0{${zeroCount - 1}}${displayDigits}`;
        } else {
            // Show normally (up to 6 decimal places)
            return num.toFixed(zeroCount + 4).replace(/0+$/, '');
        }
    }

    // Fallback
    return num.toPrecision(4);
}

function formatMarketCap(mcap: number): string {
    if (mcap >= 1e9) return (mcap / 1e9).toFixed(2) + 'B';
    if (mcap >= 1e6) return (mcap / 1e6).toFixed(2) + 'M';
    if (mcap >= 1e3) return (mcap / 1e3).toFixed(2) + 'K';
    return mcap.toString();
}

/**
 * Generate a cover image for the news article
 */
export async function generateCoverImage(data: NewsTrendingData): Promise<string> {
    console.log('[CoverGen] Generating cover image...');

    // Sort by price change desc (hot ones first) - Take top 3
    const sortedTokens = [...data.tokens].sort((a, b) => b.priceChange - a.priceChange).slice(0, 3);

    const rowsHtml = sortedTokens.map(t => generateRowHtml(t)).join('\n');
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Read and encode logo
    let logoBase64 = '';
    try {
        if (fs.existsSync(LOGO_PATH)) {
            const logoBuffer = fs.readFileSync(LOGO_PATH);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        } else {
            console.warn(`[CoverGen] Logo file not found at ${LOGO_PATH}`);
        }
    } catch (e) {
        console.warn(`[CoverGen] Failed to read logo: ${e}`);
    }

    const html = HTML_TEMPLATE
        .replace('{{DATE}}', dateStr)
        .replace('{{ROWS}}', rowsHtml)
        .replace('{{LOGO_BASE64}}', logoBase64);

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1024, height: 630, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        // Wait for images to load (3 seconds for token avatars)
        await new Promise(r => setTimeout(r, 3000));

        const filename = `news-cover-${Date.now()}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        await page.screenshot({ path: filepath });
        await browser.close();

        console.log(`[CoverGen] Image saved to ${filepath}`);

        // Return relative path for frontend
        return `/news-covers/${filename}`;

    } catch (error) {
        console.error('[CoverGen] Failed to generate image:', error);
        throw error;
    }
}
