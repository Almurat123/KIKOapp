import crypto from 'node:crypto';
import prisma from '../../../db/prisma.js';

type IngressTraceRow = {
  chainId: number;
  txHash: string;
  targetWallet?: string | null;
  eventType: string;
  source: string;
  payload?: Record<string, unknown> | null;
};

let ensured = false;

export async function ensureCopytradeIngressTraceTable(): Promise<void> {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS copytrade_ingress_trace (
      id BIGSERIAL PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE,
      chain_id INT NOT NULL,
      tx_hash TEXT NOT NULL,
      target_wallet TEXT,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_copytrade_ingress_trace_tx
      ON copytrade_ingress_trace (chain_id, tx_hash, created_at DESC);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_copytrade_ingress_trace_target
      ON copytrade_ingress_trace (chain_id, target_wallet, created_at DESC);
  `);
  ensured = true;
}

export async function recordCopytradeIngressTrace(row: IngressTraceRow): Promise<void> {
  await ensureCopytradeIngressTraceTable();
  const eventKey = buildEventKey(row);
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO copytrade_ingress_trace (
        event_key,
        chain_id,
        tx_hash,
        target_wallet,
        event_type,
        source,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (event_key) DO NOTHING
    `,
    eventKey,
    row.chainId,
    row.txHash.toLowerCase(),
    row.targetWallet || null,
    row.eventType,
    row.source,
    JSON.stringify(row.payload || {}),
  );
}

export async function hasCopytradeIngressTraceEvent(params: {
  chainId: number;
  txHash: string;
  targetWallet?: string | null;
  eventTypes: string[];
}): Promise<boolean> {
  await ensureCopytradeIngressTraceTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
    `
      SELECT EXISTS(
        SELECT 1
        FROM copytrade_ingress_trace
        WHERE chain_id = $1
          AND tx_hash = $2
          AND ($3::text IS NULL OR target_wallet = $3)
          AND event_type = ANY($4::text[])
      ) AS present
    `,
    params.chainId,
    params.txHash.toLowerCase(),
    params.targetWallet || null,
    params.eventTypes,
  );
  return Boolean(rows[0]?.present);
}

function buildEventKey(row: IngressTraceRow): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        chainId: row.chainId,
        txHash: row.txHash.toLowerCase(),
        targetWallet: row.targetWallet || null,
        eventType: row.eventType,
        source: row.source,
        payload: row.payload || {},
      }),
    )
    .digest('hex');
}
