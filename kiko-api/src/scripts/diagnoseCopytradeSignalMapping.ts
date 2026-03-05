import fs from 'node:fs';
import process from 'node:process';
import 'dotenv/config';
import { ethers } from 'ethers';
import pg from 'pg';

type ParsedArgs = {
  logPath?: string;
  chainId: number;
  rpcUrl: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    chainId: Number(process.env.CHAIN_ID || 8453),
    rpcUrl: process.env.RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--log' && argv[i + 1]) args.logPath = argv[++i];
    else if (arg === '--chain' && argv[i + 1]) args.chainId = Number(argv[++i]);
    else if (arg === '--rpc' && argv[i + 1]) args.rpcUrl = argv[++i];
  }
  return args;
}

function collectTxHashesFromLog(logPath?: string): string[] {
  if (!logPath || !fs.existsSync(logPath)) return [];
  const text = fs.readFileSync(logPath, 'utf8');
  const hashes = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const matched = line.match(/\[Webhook\] Found \d+ tracked wallets for tx (0x[a-fA-F0-9]{64})/);
    if (matched?.[1]) hashes.add(matched[1].toLowerCase());
  }
  return [...hashes];
}

async function loadOrdersForHashes(chainId: number, txHashes: string[]) {
  if (!process.env.DATABASE_URL || txHashes.length === 0) return new Map<string, any[]>();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const tableCheck = await client.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name='copytrade_orders' limit 1`,
    );
    if (tableCheck.rowCount === 0) return new Map<string, any[]>();
    const result = await client.query(
      `select chain_id, tx_hash, target_wallet, user_id, config_id, lifecycle_state, last_reason_code, created_at
       from copytrade_orders
       where chain_id = $1 and tx_hash = any($2::text[])
       order by created_at asc`,
      [chainId, txHashes],
    );
    const grouped = new Map<string, any[]>();
    for (const row of result.rows) {
      const key = String(row.tx_hash || '').toLowerCase();
      const list = grouped.get(key) || [];
      list.push(row);
      grouped.set(key, list);
    }
    return grouped;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const txHashes = collectTxHashesFromLog(args.logPath);
  if (txHashes.length === 0) {
    console.log('[diagnoseCopytradeSignalMapping] no tx hashes found');
    return;
  }

  const provider = new ethers.JsonRpcProvider(args.rpcUrl);
  const ordersByHash = await loadOrdersForHashes(args.chainId, txHashes);

  const rows: Array<Record<string, unknown>> = [];
  for (const txHash of txHashes) {
    let sourceTxFrom: string | null = null;
    try {
      const tx = await provider.getTransaction(txHash);
      sourceTxFrom = tx?.from?.toLowerCase() || null;
    } catch {
      sourceTxFrom = null;
    }
    const orders = ordersByHash.get(txHash) || [];
    rows.push({
      chainId: args.chainId,
      txHash,
      sourceTxFrom,
      matchedTargets: orders.map((order) => order.target_wallet),
      followerOrders: orders.map((order) => ({
        userId: order.user_id,
        configId: order.config_id,
        lifecycleState: order.lifecycle_state,
        lastReasonCode: order.last_reason_code,
        createdAt: order.created_at,
      })),
    });
  }

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error('[diagnoseCopytradeSignalMapping] failed', error);
  process.exitCode = 1;
});
