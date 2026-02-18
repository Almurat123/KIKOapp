import prisma from '../db/prisma.js';

type InboxStatus = 'pending' | 'processing' | 'processed' | 'failed';

export type AlchemyWebhookInboxRow = {
  id: number;
  payload: any;
  attempts: number;
};

let ensured = false;
let workerStarted = false;

function toJson(value: unknown): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

export async function ensureAlchemyWebhookInboxTable(): Promise<void> {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS alchemy_webhook_inbox (
      id BIGSERIAL PRIMARY KEY,
      payload_hash TEXT NOT NULL UNIQUE,
      network TEXT,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error TEXT,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_alchemy_webhook_inbox_due
      ON alchemy_webhook_inbox (status, next_attempt_at, created_at);
  `);
  ensured = true;
}

export async function enqueueAlchemyWebhookEvent(params: {
  payloadHash: string;
  network?: string;
  txHash?: string;
  payload: any;
}): Promise<{ id: number; status: InboxStatus }> {
  await ensureAlchemyWebhookInboxTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO alchemy_webhook_inbox (payload_hash, network, tx_hash, payload)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (payload_hash) DO UPDATE SET updated_at = NOW()
    `,
    params.payloadHash,
    params.network || null,
    params.txHash || null,
    JSON.stringify(params.payload || {})
  );
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; status: InboxStatus }>>(
    `SELECT id, status FROM alchemy_webhook_inbox WHERE payload_hash = $1 LIMIT 1`,
    params.payloadHash
  );
  const row = rows[0];
  return { id: Number(row.id), status: row.status };
}

async function claimById(id: number): Promise<AlchemyWebhookInboxRow | null> {
  await ensureAlchemyWebhookInboxTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; payload: unknown; attempts: number }>>(
    `
      UPDATE alchemy_webhook_inbox
      SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      WHERE id = $1 AND status IN ('pending','failed')
      RETURNING id, payload, attempts
    `,
    id
  );
  if (!rows.length) return null;
  return {
    id: Number(rows[0].id),
    payload: toJson(rows[0].payload),
    attempts: Number(rows[0].attempts || 0),
  };
}

async function claimNext(maxAttempts: number): Promise<AlchemyWebhookInboxRow | null> {
  await ensureAlchemyWebhookInboxTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; payload: unknown; attempts: number }>>(
    `
      WITH picked AS (
        SELECT id
        FROM alchemy_webhook_inbox
        WHERE status IN ('pending','failed')
          AND attempts < $1
          AND next_attempt_at <= NOW()
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE alchemy_webhook_inbox i
      SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
      FROM picked
      WHERE i.id = picked.id
      RETURNING i.id, i.payload, i.attempts
    `,
    maxAttempts
  );
  if (!rows.length) return null;
  return {
    id: Number(rows[0].id),
    payload: toJson(rows[0].payload),
    attempts: Number(rows[0].attempts || 0),
  };
}

export async function markAlchemyWebhookEventProcessed(id: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `
      UPDATE alchemy_webhook_inbox
      SET status = 'processed', processed_at = NOW(), updated_at = NOW(), last_error = NULL
      WHERE id = $1
    `,
    id
  );
}

export async function markAlchemyWebhookEventFailed(id: number, attempts: number, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error || 'unknown_error');
  const delaySec = Math.min(300, Math.max(5, 5 * Math.pow(2, Math.min(6, attempts))));
  await prisma.$executeRawUnsafe(
    `
      UPDATE alchemy_webhook_inbox
      SET status = 'failed',
          last_error = $2,
          next_attempt_at = NOW() + ($3 * interval '1 second'),
          updated_at = NOW()
      WHERE id = $1
    `,
    id,
    msg.slice(0, 1200),
    delaySec
  );
}

export async function processAlchemyWebhookInboxEventById(
  id: number,
  processor: (payload: any) => Promise<void>
): Promise<boolean> {
  const claimed = await claimById(id);
  if (!claimed) return false;
  try {
    await processor(claimed.payload);
    await markAlchemyWebhookEventProcessed(claimed.id);
  } catch (err) {
    await markAlchemyWebhookEventFailed(claimed.id, claimed.attempts, err).catch(() => undefined);
    throw err;
  }
  return true;
}

export function startAlchemyWebhookInboxWorker(
  processor: (payload: any) => Promise<void>,
  options?: { intervalMs?: number; batchSize?: number; maxAttempts?: number }
): void {
  if (workerStarted) return;
  workerStarted = true;

  const intervalMs = Math.max(1000, Number(options?.intervalMs || 5000));
  const batchSize = Math.max(1, Number(options?.batchSize || 5));
  const maxAttempts = Math.max(1, Number(options?.maxAttempts || 20));

  const tick = async () => {
    for (let i = 0; i < batchSize; i += 1) {
      const claimed = await claimNext(maxAttempts).catch(() => null);
      if (!claimed) break;
      try {
        await processor(claimed.payload);
        await markAlchemyWebhookEventProcessed(claimed.id);
      } catch (err) {
        await markAlchemyWebhookEventFailed(claimed.id, claimed.attempts, err).catch(() => undefined);
      }
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, intervalMs).unref();
}
