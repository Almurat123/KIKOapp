import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const QUERY_URL = process.env.GMGN_QUERY_URL || 'https://gmgn.ai/defi/quotation/v1/rank/base/wallets/7d?tag=snipe_bot&device_id=f8c9a990-6dae-4bed-8641-948f70a6e971&fp_did=ee4fc2c9a535fdf50aa0d088ebff99b1&client_id=gmgn_web_20260225-11154-7f0b5c9&from_app=gmgn&app_ver=20260225-11154-7f0b5c9&tz_name=Asia%2FShanghai&tz_offset=28800&app_lang=zh-CN&os=web&worker=0&orderby=pnl_7d&direction=desc';
const MAX_WALLETS = Math.max(1, Number.parseInt(String(process.env.GMGN_MAX_WALLETS || '30'), 10) || 30);

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' });

    await page.goto('https://gmgn.ai/trade?chain=base&tab=snipe_bot', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });
    await new Promise((r) => setTimeout(r, 10000));

    const payload = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json, text/plain, */*' }
      });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      return {
        ok: res.ok,
        status: res.status,
        url: res.url,
        textHead: text.slice(0, 240),
        json
      };
    }, QUERY_URL);

    if (!payload.ok || !payload.json || payload.json.code !== 0) {
      throw new Error(`gmgn_fetch_failed status=${payload.status} head=${payload.textHead}`);
    }

    const rank = Array.isArray(payload.json?.data?.rank) ? payload.json.data.rank : [];
    const wallets: string[] = [];
    for (const row of rank) {
      const candidate = String(row?.wallet_address || row?.address || '').toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(candidate)) continue;
      if (wallets.includes(candidate)) continue;
      wallets.push(candidate);
      if (wallets.length >= MAX_WALLETS) break;
    }

    const out = {
      generatedAt: new Date().toISOString(),
      source: QUERY_URL,
      totalRankRows: rank.length,
      wallets,
      sample: rank.slice(0, Math.min(10, rank.length))
    };

    const outPath = path.join(process.cwd(), 'data', `gmgn_rank_wallets_${Date.now()}.json`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(out, null, 2));

    console.log(JSON.stringify({ outPath, walletCount: wallets.length }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
