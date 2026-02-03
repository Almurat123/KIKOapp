/**
 * Webhook Routes
 * Receives notifications from Go webhook service and triggers copy trades
 */

import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { fetchTransaction, fetchTransactionReceipt, isTxProcessed, markTxAsProcessed } from '../services/watcherService.js';
import { normalizeAddress } from '../utils/address.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { env } from '../config/env.js';
import crypto from 'node:crypto';

interface ProcessTxBody {
    wallet: string;
    txHash: string;
    network: string;
}

// Map Alchemy network names to chain IDs
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
    'ETH_MAINNET': 1,
    'BASE_MAINNET': 8453,
    'BNB_MAINNET': 56,          // Alchemy's network name for BSC
    'BNB_SMART_CHAIN_MAINNET': 56,
    'BSC_MAINNET': 56,          // Alias
    'SOLANA_MAINNET': 900,      // Solana
    'SOL_MAINNET': 900,         // Alias
    'SOLANA_MAINNET_SOLANA': 900, // Common Solana alias
    'SOLANA_MAINNET_NETWORK': 900,
    'SOLANA': 900,              // Short alias
    'SOL': 900,                 // Short alias
};

type SignatureParts = {
    t?: string;
    h?: string;
    v1?: string;
};

function parseHook0Signature(header: string): SignatureParts {
    const parts: SignatureParts = {};
    const segments = header.split(',').map(s => s.trim()).filter(Boolean);
    for (const segment of segments) {
        const [key, value] = segment.split('=');
        if (!key || value === undefined) continue;
        const k = key.trim();
        const v = value.trim();
        if (k === 't') parts.t = v;
        if (k === 'h') parts.h = v;
        if (k === 'v1') parts.v1 = v;
    }
    return parts;
}

function splitHeaderNames(raw?: string): { names: string[]; delimiter: string } {
    if (!raw) return { names: [], delimiter: ':' };
    const delimiters = [';', ':', '|', ' '];
    for (const d of delimiters) {
        if (raw.includes(d)) {
            return { names: raw.split(d).map(s => s.trim()).filter(Boolean), delimiter: d };
        }
    }
    return { names: [raw.trim()].filter(Boolean), delimiter: ':' };
}

function getHeaderValue(headers: Record<string, any>, name: string): string {
    const value = headers[name.toLowerCase()];
    if (Array.isArray(value)) return value.join(',');
    if (typeof value === 'string') return value;
    return '';
}

function verifyCdpSignature(request: any, secret: string, toleranceSec: number): boolean {
    const signatureHeader = request.headers['x-hook0-signature'] as string | undefined;
    if (!signatureHeader) {
        console.warn('[Webhook] Missing CDP signature header');
        return false;
    }

    const { t, h, v1 } = parseHook0Signature(signatureHeader);
    if (!t || !v1) {
        console.warn('[Webhook] Invalid CDP signature header format');
        return false;
    }

    const timestamp = Number(t);
    if (!Number.isFinite(timestamp)) {
        console.warn('[Webhook] Invalid CDP signature timestamp');
        return false;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestamp) > toleranceSec) {
        console.warn('[Webhook] CDP signature timestamp outside tolerance', { nowSec, timestamp, toleranceSec });
        return false;
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
        console.error('[Webhook] rawBody is missing despite being enabled for /coinbase');
        return false;
    }

    const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    const { names, delimiter } = splitHeaderNames(h);
    const headerNames = h || '';
    const headerValues = names.map(n => getHeaderValue(request.headers, n)).join(delimiter);

    const signingPayload = `${t}.${headerNames}.${headerValues}.${rawBodyString}`;
    const digest = crypto.createHmac('sha256', secret).update(signingPayload).digest('hex');

    try {
        const a = Buffer.from(digest, 'hex');
        const b = Buffer.from(v1, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (error) {
        console.warn('[Webhook] CDP signature comparison failed', error);
        return false;
    }
}

function extractCdpSubscriptionId(payload: any): string | undefined {
    return (
        payload?.data?.subscriptionId ||
        payload?.data?.subscription_id ||
        payload?.subscriptionId ||
        payload?.subscription_id
    );
}

function getCdpSecretForRequest(request: any): string | undefined {
    const payload = request.body;
    const subscriptionId = extractCdpSubscriptionId(payload);
    const secretMap = env.security.cdpWebhookSecretsJson;
    if (subscriptionId && secretMap && secretMap[subscriptionId]) {
        return secretMap[subscriptionId];
    }
    return env.security.cdpWebhookSecret;
}

export default async function webhookRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/webhook/process-tx
     * Called by Go webhook service when Alchemy detects a transaction
     */
    fastify.post<{ Body: ProcessTxBody }>('/process-tx', async (request, reply) => {
        // 1. Verify internal secret if configured
        const internalSecret = env.security.internalWebhookSecret;
        if (internalSecret) {
            const providedSecret = request.headers['x-internal-secret'];
            if (providedSecret !== internalSecret) {
                console.warn(`[Webhook] Unauthorized access attempt to /process-tx from ${request.ip}`);
                return reply.status(401).send({ error: 'Unauthorized' });
            }
        }

        const { wallet, txHash, network } = request.body;

        if (!wallet || !txHash || !network) {
            return reply.status(400).send({ error: 'wallet, txHash, and network are required' });
        }

        // Try direct lookup or uppercase lookup
        const chainId = NETWORK_TO_CHAIN_ID[network] || NETWORK_TO_CHAIN_ID[network.toUpperCase()];
        if (!chainId) {
            console.warn(`[Webhook] Unknown network: ${network}`);
            return reply.status(400).send({ error: `Unknown network: ${network}` });
        }

        console.log(`[Webhook] Processing tx from Go service: wallet=${wallet.slice(0, 10)}, tx=${txHash.slice(0, 16)}, chain=${chainId}`);

        try {
            // Check if already processed
            const existingPosition = await prisma.position.findFirst({
                where: { entryTxHash: txHash }
            });
            if (existingPosition) {
                console.log(`[Webhook] Tx already processed: ${txHash.slice(0, 16)}`);
                return reply.send({ success: true, skipped: true, reason: 'already_processed' });
            }

            // Fetch transaction details
            const [tx, receipt] = await Promise.all([
                fetchTransaction(txHash, chainId),
                fetchTransactionReceipt(txHash, chainId),
            ]);

            if (!tx || !receipt) {
                console.warn(`[Webhook] Could not fetch tx/receipt: ${txHash.slice(0, 16)}`);
                return reply.status(404).send({ error: 'Transaction not found' });
            }

            // Parse as swap
            const swap = await parseSwapTransaction(
                {
                    hash: txHash,
                    from: tx.from,
                    to: tx.to,
                    input: tx.input,
                    value: tx.value,
                },
                {
                    logs: receipt.logs,
                    status: parseInt(receipt.status, 16),
                },
                chainId
            );

            if (!swap) {
                console.log(`[Webhook] Not a swap tx: ${txHash.slice(0, 16)}`);
                return reply.send({ success: true, skipped: true, reason: 'not_a_swap' });
            }

            console.log(`[Webhook] ✅ Swap detected:`, {
                wallet: wallet.slice(0, 10),
                tokenIn: swap.tokenIn,
                tokenOut: swap.tokenOut,
                dex: swap.dexName,
            });

            // Import and trigger copy trade (dynamic import to avoid circular deps)
            const { handleSwapDetected } = await import('../services/autoTradeService.js');
            await handleSwapDetected(wallet, swap, chainId);

            return reply.send({ success: true, swap: { tokenIn: swap.tokenIn, tokenOut: swap.tokenOut } });
        } catch (error: any) {
            console.error(`[Webhook] Error processing tx:`, error);
            return reply.status(500).send({ error: 'Failed to process transaction' });
        }
    });

    /**
     * GET /api/webhook/health
     * Health check for webhook endpoint
     */
    fastify.get('/health', async (request, reply) => {
        return reply.send({ status: 'ok', service: 'webhook' });
    });

    /**
     * GET /api/webhook/sync-solana
     * Force resync all Solana wallets from DB to Alchemy.
     * Use this when webhooks are missing or addresses were lowercased.
     */
    fastify.get('/sync-solana', async (request, reply) => {
        // Restrict to development or admin
        if (env.nodeEnv !== 'development') {
            return reply.status(403).send({ error: 'Forbidden in production' });
        }

        const { addAddressToWebhook } = await import('../services/alchemyWebhookService.js');
        const configs = await prisma.copyTradeConfig.findMany({
            where: { chainId: 900 }
        });

        const results = [];
        for (const config of configs) {
            // 1. Ensure it's in TrackedWallet table (used for filtering in webhook handler)
            await prisma.trackedWallet.upsert({
                where: {
                    address_chainId: {
                        address: config.targetWallet,
                        chainId: 900
                    }
                },
                update: {},
                create: {
                    address: config.targetWallet,
                    chainId: 900
                }
            });

            // 2. Add to Alchemy Webhook
            const success = await addAddressToWebhook(config.targetWallet, 900);
            results.push({ wallet: config.targetWallet, success, tracked: true });
        }

        return reply.send({
            message: `Synced ${configs.length} Solana wallets and ensured they are tracked`,
            details: results
        });
    });

    /**
     * POST /api/webhook/alchemy
     * Direct endpoint for Alchemy Address Activity webhooks
     */
    fastify.post('/alchemy', async (request, reply) => {
        // 1. Signature Verification for Alchemy
        const alchemySecret = env.security.alchemyWebhookSecret;
        if (alchemySecret) {
            const signature = request.headers['x-alchemy-signature'] as string;
            if (!signature) {
                console.warn(`[Webhook] Missing Alchemy signature from ${request.ip}`);
                return reply.status(401).send({ error: 'Missing signature' });
            }

            // CRITICAL: Use rawBody for signature verification to ensure exact byte-match
            const hmac = crypto.createHmac('sha256', alchemySecret);
            const content = (request as any).rawBody;

            if (!content) {
                console.error(`[Webhook] rawBody is missing despite being enabled for /alchemy`);
                return reply.status(500).send({ error: 'Internal server error' });
            }

            hmac.update(content);
            const digest = hmac.digest('hex');

            if (signature !== digest) {
                console.warn(`[Webhook] Invalid Alchemy signature. Expected ${digest}, got ${signature}`);
                return reply.status(401).send({ error: 'Invalid signature' });
            }
        }

        const payload = request.body as any;

        const evmNetwork = payload?.event?.network;
        const solNetwork = payload?.event?.event?.network || payload?.event?.network;
        const rawNetwork = evmNetwork || solNetwork || payload?.network || 'unknown';

        // Debug: Log full payload as single-line JSON
        console.log(`[Webhook] Incoming Alchemy (${rawNetwork}): ${JSON.stringify(payload)}`);

        // Respond immediately with 200 (Alchemy expects this)
        reply.send({ success: true });

        // Handle Alchemy test ping (no event data)
        if (!payload?.event || payload?.type === 'GRAPHQL') {
            console.log(`[Webhook] Alchemy test ping or non-activity webhook, ignoring`);
            return;
        }

        // Process activities asynchronously in background to prevent Alchemy timeouts
        setImmediate(async () => {
            try {
                // Alchemy Address Activity webhook structure:
                // EVM: payload.event.network, payload.event.activity
                // Solana: payload.event.event.network, payload.event.event.transaction
                // Dig into the payload to find the network and event data
                // Alchemy likes to nest things differently between test pings and real events
                let current = payload;
                let network = undefined;
                let eventData = undefined;

                // Max 5 levels of recursion to avoid infinite loops
                for (let i = 0; i < 5; i++) {
                    if (current.network) network = current.network;
                    if (current.event && typeof current.event === 'object') {
                        current = current.event;
                        continue;
                    }
                    eventData = current;
                    break;
                }

                const chainId = NETWORK_TO_CHAIN_ID[network] || (network ? NETWORK_TO_CHAIN_ID[network.toUpperCase()] : undefined);

                if (!chainId) {
                    console.warn(`[Webhook] Unknown network: ${network}. Payload snippet: ${JSON.stringify(payload).slice(0, 200)}`);
                    return;
                }

                // Extract items to process (Activity or Transaction)
                let items: any[] = [];
                let isSolanaItems = false;

                if (eventData?.activity) {
                    items = Array.isArray(eventData.activity) ? eventData.activity : [eventData.activity];
                    console.log(`[Webhook] Processing as EVM activity (${items.length} items)`);
                } else if (eventData?.transaction) {
                    items = Array.isArray(eventData.transaction) ? eventData.transaction : [eventData.transaction];
                    isSolanaItems = true;
                    console.log(`[Webhook] Processing as Solana transaction (${items.length} items)`);
                } else {
                    console.log(`[Webhook] No recognizable activity or transaction array in eventData`);
                }

                const processItem = async (item: any) => {
                    let txHash = '';
                    let candidates: string[] = [];

                    if (isSolanaItems) {
                        // Solana Structure: Handle cases where transaction/message might be arrays (Alchemy Test Hook)
                        txHash = item.signature;

                        const solTx = Array.isArray(item.transaction) ? item.transaction[0] : item.transaction;
                        if (!txHash && solTx?.signatures) {
                            txHash = solTx.signatures[0];
                        }

                        const solMsg = Array.isArray(solTx?.message) ? solTx.message[0] : solTx?.message;
                        const keys = solMsg?.account_keys || solMsg?.accountKeys || [];
                        candidates = keys.map((k: any) => normalizeAddress(typeof k === 'string' ? k : k.pubkey || k.toString()));

                        if (candidates.length === 0) {
                            console.log(`[Webhook] Solana candidate extraction debug: signature=${txHash}, item keys=${Object.keys(item)}, solTx keys=${solTx ? Object.keys(solTx) : 'null'}, solMsg keys=${solMsg ? Object.keys(solMsg) : 'null'}`);
                        }
                    } else {
                        // EVM Structure
                        txHash = item.hash;
                        const fromAddr = normalizeAddress(item.fromAddress);
                        const toAddr = normalizeAddress(item.toAddress);
                        candidates = [fromAddr, toAddr].filter(Boolean);
                    }

                    if (!txHash) return;

                    // FAST in-memory deduplication check (shared with watcher)
                    if (isTxProcessed(txHash)) {
                        console.log(`[Webhook] Tx already in processedTxs cache: ${txHash.slice(0, 16)}`);
                        return;
                    }

                    const trackedWallets = await prisma.trackedWallet.findMany({
                        where: {
                            address: { in: candidates, mode: 'insensitive' },
                            chainId,
                        }
                    });

                    if (trackedWallets.length === 0) {
                        console.log(`[Webhook] ⚠️ Ignoring tx ${txHash.slice(0, 8)}: No matched tracked wallets in [${candidates.map(c => c.slice(0, 6)).join(', ')}]`);
                        return;
                    }

                    // Mark as processing ONLY if we have matched wallets
                    markTxAsProcessed(txHash);

                    console.log(`[Webhook] 🎯 Found ${trackedWallets.length} tracked wallets for tx ${txHash.slice(0, 8)}`);

                    // Branch by chain type: Solana vs EVM
                    if (chainId === 900) {
                        try {
                            // Solana Logic
                            const { getSolanaConnection, SOLANA_CONFIG } = await import('../config/solanaConfig.js');
                            const { decodeSolanaSwap } = await import('../services/solanaDecoder.js');

                            let tx: any = null;
                            const rpcsToTry = [
                                undefined, // Primary (from .env)
                                SOLANA_CONFIG.RPC_URLS.PUBLIC,
                                SOLANA_CONFIG.RPC_URLS.BACKUP_1,
                                SOLANA_CONFIG.RPC_URLS.BACKUP_2
                            ];

                            for (const rpcUrl of rpcsToTry) {
                                try {
                                    const connection = getSolanaConnection(rpcUrl);
                                    tx = await connection.getParsedTransaction(txHash, {
                                        maxSupportedTransactionVersion: 0,
                                        commitment: 'confirmed'
                                    });
                                    if (tx) {
                                        if (rpcUrl) console.log(`[Webhook] ✅ Successfully fetched Solana tx via fallback RPC: ${rpcUrl}`);
                                        break;
                                    }
                                } catch (err: any) {
                                    const isSslError = err.message?.includes('SSL') || err.cause?.message?.includes('SSL');
                                    console.warn(`[Webhook] Solana fetch failed ${rpcUrl ? 'via ' + rpcUrl : 'via primary'}: ${err.message}${isSslError ? ' (SSL Error)' : ''}`);
                                    if (!isSslError && !err.message?.includes('fetch failed')) {
                                        // If it's not a connection/SSL error, it might be a 404 or something else where retrying won't help as much
                                        // but we try others anyway
                                    }
                                }
                            }

                            if (!tx) {
                                console.error(`[Webhook] ❌ Failed to fetch Solana tx details after trying all RPCs: ${txHash.slice(0, 16)}`);
                                return;
                            }

                            // Trigger copy trade for EACH matched tracked wallet
                            const { handleSwapDetected } = await import('../services/autoTradeService.js');
                            await Promise.allSettled(trackedWallets.map(async (walletRecord) => {
                                const trackedTarget = walletRecord.address;

                                // Decode Solana Swap
                                const swap = await decodeSolanaSwap(tx, trackedTarget);

                                if (swap) {
                                    console.log(`[Webhook] ✅ Solana Swap detected for ${trackedTarget.slice(0, 8)}:`, {
                                        in: swap.tokenIn,
                                        out: swap.tokenOut,
                                        dex: swap.dexName
                                    });
                                    await handleSwapDetected(trackedTarget, swap, chainId);
                                } else {
                                    // console.log(`[Webhook] Solana tx ${txHash.slice(0, 8)} was not a swap for tracked wallet`);
                                }
                            }));
                        } catch (err) {
                            console.error(`[Webhook] Error fetching Solana tx details:`, err);
                        }
                        return;
                    }

                    // EVM Logic (Base, BSC, etc.)
                    const [tx, receipt] = await Promise.all([
                        fetchTransaction(txHash, chainId),
                        fetchTransactionReceipt(txHash, chainId),
                    ]);

                    if (!tx || !receipt) {
                        console.warn(`[Webhook] Could not fetch tx/receipt: ${txHash.slice(0, 16)}`);
                        return;
                    }

                    // Trigger copy trade for EACH matched tracked wallet
                    const { handleSwapDetected } = await import('../services/autoTradeService.js');

                    await Promise.allSettled(trackedWallets.map(async (walletRecord) => {
                        const trackedTarget = walletRecord.address;

                        // Parse as swap - IMPORTANT: Use trackedTarget as the identity for decoding
                        const swap = await parseSwapTransaction(
                            {
                                hash: txHash,
                                from: trackedTarget,
                                to: tx.to,
                                input: tx.input,
                                value: tx.value,
                            },
                            {
                                logs: receipt.logs,
                                status: parseInt(receipt.status, 16),
                            },
                            chainId
                        );

                        if (!swap) {
                            console.log(`[Webhook] Not a swap tx for ${trackedTarget.slice(0, 10)}: ${txHash.slice(0, 16)}`);
                            return;
                        }

                        console.log(`[Webhook] ✅ Swap detected for tracked wallet ${trackedTarget.slice(0, 10)}:`, {
                            tokenIn: swap.tokenIn,
                            tokenOut: swap.tokenOut,
                            dex: swap.dexName,
                        });

                        await handleSwapDetected(trackedTarget, swap, chainId);
                    }));
                };

                // Process items in parallel batches for speed without overload
                const BATCH_SIZE = 5;
                for (let i = 0; i < items.length; i += BATCH_SIZE) {
                    const batch = items.slice(i, i + BATCH_SIZE);
                    await Promise.allSettled(batch.map(processItem));
                }
            } catch (error) {
                console.error(`[Webhook] Error processing Alchemy webhook:`, error);
            }
        }); // End setImmediate
    });

    /**
     * POST /api/webhook/coinbase
     * Coinbase Base webhook handler (fast ack + async processing)
     */
    fastify.post('/coinbase', async (request, reply) => {
        const hasSecretConfig = !!env.security.cdpWebhookSecret || !!env.security.cdpWebhookSecretsJson;
        if (hasSecretConfig) {
            const cdpSecret = getCdpSecretForRequest(request);
            if (!cdpSecret) {
                console.warn('[Webhook] Missing CDP secret for subscription');
                return reply.status(401).send({ error: 'Invalid signature' });
            }
            const toleranceSec = env.security.cdpWebhookToleranceSec ?? 300;
            const ok = verifyCdpSignature(request, cdpSecret, toleranceSec);
            if (!ok) {
                return reply.status(401).send({ error: 'Invalid signature' });
            }
        }

        const payload = request.body as any;
        console.log(`[Webhook] Incoming Coinbase: ${JSON.stringify(payload)}`);
        reply.send({ success: true });

        setImmediate(async () => {
            try {
                const chainId = 8453; // Coinbase Base

                const txHashes = new Set<string>();
                const pushHash = (h?: string) => {
                    if (h && typeof h === 'string') txHashes.add(h);
                };

                // Flexible extraction for different webhook shapes
                pushHash(payload?.txHash);
                pushHash(payload?.transactionHash);
                pushHash(payload?.transaction_hash);
                pushHash(payload?.event?.hash);
                pushHash(payload?.event?.transactionHash);
                pushHash(payload?.event?.transaction_hash);
                pushHash(payload?.event?.data?.transactionHash);
                pushHash(payload?.event?.data?.transaction_hash);
                pushHash(payload?.data?.transactionHash);
                pushHash(payload?.data?.transaction_hash);
                if (Array.isArray(payload?.transactions)) {
                    payload.transactions.forEach((t: any) => pushHash(t?.hash || t?.transactionHash || t?.transaction_hash));
                }
                if (Array.isArray(payload?.activity)) {
                    payload.activity.forEach((a: any) => pushHash(a?.hash));
                }
                if (Array.isArray(payload?.event?.activity)) {
                    payload.event.activity.forEach((a: any) => pushHash(a?.hash));
                }
                if (Array.isArray(payload?.event?.transactions)) {
                    payload.event.transactions.forEach((t: any) => pushHash(t?.hash || t?.transactionHash || t?.transaction_hash));
                }

                if (txHashes.size === 0) {
                    console.warn('[Webhook] Coinbase webhook missing tx hash');
                    return;
                }

                const { handleSwapDetected } = await import('../services/autoTradeService.js');

                const processTx = async (txHash: string) => {
                    if (isTxProcessed(txHash)) return;

                    const [tx, receipt] = await Promise.all([
                        fetchTransaction(txHash, chainId),
                        fetchTransactionReceipt(txHash, chainId),
                    ]);

                    if (!tx || !receipt) {
                        console.warn(`[Webhook] Coinbase: Could not fetch tx/receipt ${txHash.slice(0, 16)}`);
                        return;
                    }

                    const candidates = [normalizeAddress(tx.from), normalizeAddress(tx.to)].filter(Boolean);
                    if (candidates.length === 0) return;

                    const trackedWallets = await prisma.trackedWallet.findMany({
                        where: {
                            address: { in: candidates, mode: 'insensitive' },
                            chainId,
                        }
                    });

                    if (trackedWallets.length === 0) return;

                    markTxAsProcessed(txHash);

                    await Promise.allSettled(trackedWallets.map(async (walletRecord) => {
                        const trackedTarget = walletRecord.address;
                        const swap = await parseSwapTransaction(
                            {
                                hash: txHash,
                                from: trackedTarget,
                                to: tx.to,
                                input: tx.input,
                                value: tx.value,
                            },
                            {
                                logs: receipt.logs,
                                status: parseInt(receipt.status, 16),
                            },
                            chainId
                        );

                        if (!swap) return;
                        await handleSwapDetected(trackedTarget, swap, chainId);
                    }));
                };

                const BATCH_SIZE = 5;
                const hashes = Array.from(txHashes);
                for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
                    const batch = hashes.slice(i, i + BATCH_SIZE);
                    await Promise.allSettled(batch.map(processTx));
                }
            } catch (error) {
                console.error('[Webhook] Error processing Coinbase webhook:', error);
            }
        });
    });
}
