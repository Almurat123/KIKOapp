import fs from 'node:fs';
import process from 'node:process';
import 'dotenv/config';
import { ethers } from 'ethers';
import pg from 'pg';

type ParsedArgs = {
  logPath?: string;
  from?: Date;
  to?: Date;
  chains: number[];
  limit: number;
  rpcMap: Map<number, string>;
};

type CopytradeOrderRow = {
  chain_id: number;
  tx_hash: string;
  target_wallet: string;
  user_id: string | null;
  config_id: string | null;
  lifecycle_state: string;
  last_reason_code: string;
  created_at: Date;
  metadata_json: Record<string, unknown> | null;
};

const DEFAULT_EVM_CHAINS = [1, 10, 56, 137, 8453, 42161];

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function parseChains(raw?: string): number[] {
  const text = String(raw || '').trim();
  if (!text) return [...DEFAULT_EVM_CHAINS];
  const parsed = text
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [...DEFAULT_EVM_CHAINS];
}

function resolveDefaultRpcUrl(chainId: number): string | undefined {
  if (chainId === 1) return process.env.ETH_RPC_URL || process.env.ETHEREUM_RPC_URL || process.env.MAINNET_RPC_URL;
  if (chainId === 10) return process.env.OPTIMISM_RPC_URL;
  if (chainId === 56) return process.env.BSC_RPC_URL || process.env.BNB_RPC_URL;
  if (chainId === 137) return process.env.POLYGON_RPC_URL;
  if (chainId === 8453) return process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  if (chainId === 42161) return process.env.ARBITRUM_RPC_URL;
  return undefined;
}

function parseRpcMap(raw?: string): Map<number, string> {
  const output = new Map<number, string>();
  const text = String(raw || '').trim();
  if (text) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        const chainId = Number(key);
        const rpcUrl = String(value || '').trim();
        if (Number.isFinite(chainId) && chainId > 0 && rpcUrl) output.set(chainId, rpcUrl);
      }
    } catch {
      // no-op
    }
  }
  return output;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    chains: parseChains(process.env.CHAINS),
    from: parseDate(process.env.FROM),
    to: parseDate(process.env.TO),
    limit: Math.max(1, Number(process.env.LIMIT || 500)),
    rpcMap: parseRpcMap(process.env.COPYTRADE_DIAG_RPC_MAP || process.env.RPC_MAP),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--log' && argv[i + 1]) args.logPath = argv[++i];
    else if (arg === '--chains' && argv[i + 1]) args.chains = parseChains(argv[++i]);
    else if (arg === '--from' && argv[i + 1]) args.from = parseDate(argv[++i]);
    else if (arg === '--to' && argv[i + 1]) args.to = parseDate(argv[++i]);
    else if (arg === '--limit' && argv[i + 1]) args.limit = Math.max(1, Number(argv[++i]));
    else if (arg === '--rpc-map' && argv[i + 1]) args.rpcMap = parseRpcMap(argv[++i]);
  }

  for (const chainId of args.chains) {
    if (!args.rpcMap.has(chainId)) {
      const resolved = resolveDefaultRpcUrl(chainId);
      if (resolved) args.rpcMap.set(chainId, resolved);
    }
  }

  return args;
}

function collectTxHashesFromLog(logPath?: string): string[] {
  if (!logPath || !fs.existsSync(logPath)) return [];
  const text = fs.readFileSync(logPath, 'utf8');
  const hashes = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const matches = line.match(/0x[a-fA-F0-9]{64}/g) || [];
    for (const txHash of matches) hashes.add(txHash.toLowerCase());
  }
  return [...hashes];
}

async function loadOrders(params: {
  chains: number[];
  txHashes?: string[];
  from?: Date;
  to?: Date;
  limit: number;
}): Promise<CopytradeOrderRow[]> {
  if (!process.env.DATABASE_URL) return [];
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const tableCheck = await client.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name='copytrade_orders' limit 1`,
    );
    if (tableCheck.rowCount === 0) return [];

    const chainFilter = params.chains.length > 0 ? params.chains : DEFAULT_EVM_CHAINS;
    if ((params.txHashes || []).length > 0) {
      const result = await client.query<CopytradeOrderRow>(
        `select chain_id, tx_hash, target_wallet, user_id, config_id, lifecycle_state, last_reason_code, created_at, metadata_json
         from copytrade_orders
         where chain_id = any($1::int[])
           and tx_hash = any($2::text[])
         order by created_at asc
         limit $3`,
        [chainFilter, params.txHashes, params.limit],
      );
      return result.rows;
    }

    const from = params.from || new Date(Date.now() - 60 * 60 * 1000);
    const to = params.to || new Date();
    const result = await client.query<CopytradeOrderRow>(
      `select chain_id, tx_hash, target_wallet, user_id, config_id, lifecycle_state, last_reason_code, created_at, metadata_json
       from copytrade_orders
       where chain_id = any($1::int[])
         and created_at >= $2
         and created_at <= $3
       order by created_at desc
       limit $4`,
      [chainFilter, from, to, params.limit],
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

function keyFor(chainId: number, txHash: string): string {
  return `${chainId}:${txHash.toLowerCase()}`;
}

function sourceFromMetadata(metadata: Record<string, unknown> | null): string | null {
  const value = metadata && typeof metadata === 'object' ? metadata.sourceTxFrom : null;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.startsWith('0x') ? normalized : null;
}

async function loadOnchainFrom(
  chainId: number,
  txHash: string,
  providers: Map<number, ethers.JsonRpcProvider>,
): Promise<string | null> {
  if (chainId === 900) return null;
  const provider = providers.get(chainId);
  if (!provider) return null;
  try {
    const tx = await provider.getTransaction(txHash);
    return String(tx?.from || '').toLowerCase() || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const logTxHashes = collectTxHashesFromLog(args.logPath);
  const rows = await loadOrders({
    chains: args.chains,
    txHashes: logTxHashes.length > 0 ? logTxHashes : undefined,
    from: args.from,
    to: args.to,
    limit: args.limit,
  });

  if (rows.length === 0) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      from: args.from?.toISOString() || null,
      to: args.to?.toISOString() || null,
      chains: args.chains,
      totalSourceTxs: 0,
      rows: [],
      note: 'no copytrade_orders rows found for the specified filters',
    }, null, 2));
    return;
  }

  const grouped = new Map<string, CopytradeOrderRow[]>();
  for (const row of rows) {
    const key = keyFor(row.chain_id, row.tx_hash);
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }

  const providers = new Map<number, ethers.JsonRpcProvider>();
  for (const [chainId, rpcUrl] of args.rpcMap.entries()) {
    providers.set(chainId, new ethers.JsonRpcProvider(rpcUrl));
  }

  const outputRows: Array<Record<string, unknown>> = [];
  for (const [identity, orderRows] of grouped.entries()) {
    const [chainText, txHash] = identity.split(':');
    const chainId = Number(chainText);
    const onchainFrom = await loadOnchainFrom(chainId, txHash, providers);
    const metadataSourceSet = new Set<string>();
    const matchedTargetSet = new Set<string>();
    for (const row of orderRows) {
      const metadataSource = sourceFromMetadata(row.metadata_json);
      if (metadataSource) metadataSourceSet.add(metadataSource);
      matchedTargetSet.add(String(row.target_wallet || '').toLowerCase());
    }
    const metadataSources = Array.from(metadataSourceSet);
    const consistency = onchainFrom
      ? (metadataSources.length === 0
        ? 'missing_order_source'
        : (metadataSources.every((value) => value === onchainFrom) ? 'match' : 'mismatch'))
      : 'unknown_onchain_from';

    outputRows.push({
      chainId,
      sourceTxHash: txHash,
      sourceTxFromOnchain: onchainFrom,
      sourceTxFromOrderMetadata: metadataSources,
      matchedTargetWallets: Array.from(matchedTargetSet),
      sourceFromConsistency: consistency,
      followerOrders: orderRows.map((row) => ({
        userId: row.user_id,
        configId: row.config_id,
        lifecycleState: row.lifecycle_state,
        reasonCode: row.last_reason_code,
        createdAt: row.created_at,
      })),
    });
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    from: args.from?.toISOString() || null,
    to: args.to?.toISOString() || null,
    chains: args.chains,
    totalSourceTxs: outputRows.length,
    rows: outputRows,
  }, null, 2));
}

main().catch((error) => {
  console.error('[diagnoseCopytradeSignalMapping] failed', error);
  process.exitCode = 1;
});
