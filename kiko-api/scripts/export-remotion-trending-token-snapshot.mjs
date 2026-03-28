import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  '../kiko-web/src/remotion/generated/kikoTrendingTokenSnapshot.ts',
);

const CHAIN_PRIORITY = ['solana', 'eth', 'base', 'bsc', 'polygon', 'optimism', 'arbitrum'];
const CHAIN_QUOTAS = {
  solana: 30,
  eth: 22,
  base: 24,
  bsc: 20,
  polygon: 6,
  optimism: 2,
  arbitrum: 2,
};

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://almurat@localhost:5432/kiko_db',
});

const query = `
  with ranked as (
    select
      chain,
      address,
      symbol,
      name,
      image_url as "imageUrl",
      rank,
      row_number() over (
        partition by chain
        order by rank asc nulls last, "updatedAt" desc, symbol asc
      ) as chain_row
    from "TrendingToken"
    where image_url is not null
      and image_url <> ''
      and image_url like 'https://cdn.dexscreener.com%'
  )
  select chain, address, symbol, name, "imageUrl", rank
  from ranked
  where chain_row <= case chain
    when 'solana' then 28
    when 'eth' then 24
    when 'base' then 24
    when 'bsc' then 20
    when 'polygon' then 8
    when 'optimism' then 8
    when 'arbitrum' then 4
    else 0
  end
  order by
    case chain
      when 'solana' then 1
      when 'eth' then 2
      when 'base' then 3
      when 'bsc' then 4
      when 'polygon' then 5
      when 'optimism' then 6
      when 'arbitrum' then 7
      else 99
    end,
    rank asc nulls last,
    symbol asc;
`;

const ensureKnownOrder = (tokens) => {
  const grouped = new Map();
  for (const chain of CHAIN_PRIORITY) grouped.set(chain, []);
  for (const token of tokens) {
    if (!grouped.has(token.chain)) grouped.set(token.chain, []);
    grouped.get(token.chain).push(token);
  }

  const ordered = [];
  for (const chain of CHAIN_PRIORITY) {
    const chainTokens = grouped.get(chain) || [];
    const quota = CHAIN_QUOTAS[chain] || chainTokens.length;
    ordered.push(...chainTokens.slice(0, quota));
  }
  return ordered;
};

const emitModule = (tokens) => {
  const body = JSON.stringify(tokens, null, 2);
  return `export type KikoTrendingToken = {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  imageUrl: string;
  rank: number | null;
};

export const KIKO_TRENDING_TOKEN_SNAPSHOT: KikoTrendingToken[] = ${body};
`;
};

try {
  await client.connect();
  const result = await client.query(query);
  const tokens = ensureKnownOrder(
    result.rows.map((row) => ({
      chain: row.chain,
      address: row.address,
      symbol: row.symbol,
      name: row.name,
      imageUrl: row.imageUrl,
      rank: row.rank ?? null,
    })),
  );

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, emitModule(tokens), 'utf8');

  console.log(
    `[export-remotion-trending-token-snapshot] Wrote ${tokens.length} tokens to ${OUTPUT_PATH}`,
  );
} finally {
  await client.end().catch(() => {});
}
