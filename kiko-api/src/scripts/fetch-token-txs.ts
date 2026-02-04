import fs from 'fs';
import path from 'path';
import { getTopPool, fetchTrades, getTrendingTokens, sleep } from './geckoUtils.js';

const EXPLORERS: Record<string, string> = {
    bsc: 'https://bscscan.com/tx',
    base: 'https://basescan.org/tx'
};

const REPORT_PATH = '/Users/almurat/KiKo/test/token-trades-report.md';

async function processChain(network: string, tokens: string[]) {
    console.log(`\n>>> Processing ${network.toUpperCase()} Chain (${tokens.length} tokens)`);
    fs.appendFileSync(REPORT_PATH, `## ${network.toUpperCase()} Chain\n\n`);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
            const pool = await getTopPool(network, token);
            if (!pool) continue;

            const trades = await fetchTrades(network, pool);
            console.log(`[${i + 1}/${tokens.length}] Token: ${token}`);
            let tokenMarkdown = `### Token: \`${token}\`\n`;

            trades.slice(0, 4).forEach((t: any) => {
                const attr = t.attributes;
                const link = `${EXPLORERS[network]}/${attr.tx_hash}`;
                console.log(`  - ${attr.kind.toUpperCase()}: ${attr.tx_hash}`);
                tokenMarkdown += `- **${attr.kind.toUpperCase()}**: [${attr.tx_hash}](${link})\n`;
            });
            fs.appendFileSync(REPORT_PATH, tokenMarkdown + '\n');
            await sleep(2000); // 增加基础延迟，减少 429
        } catch (e: any) {
            if (e.response?.status === 429) {
                console.warn(`  ! Rate limited for ${token}, sleeping 10s...`);
                await sleep(10000);
                i--; continue;
            }
            console.error(`  ! Error processing token ${token}:`, e.message);
        }
    }
}

async function main() {
    fs.writeFileSync(REPORT_PATH, '# Token Trades Batch Report\n\n');
    const isAuto = process.argv.includes('--auto');
    if (isAuto) {
        const chains = ['bsc', 'base'];
        for (const chain of chains) {
            const tokens = await getTrendingTokens(chain, 50);
            await processChain(chain, tokens);
        }
    } else {
        const network = process.argv[2] || 'bsc';
        const tokens = process.argv.slice(3);
        await processChain(network, tokens);
    }
    console.log(`\n[SUCCESS] Final report at: ${REPORT_PATH}`);
}


main().catch(console.error);
