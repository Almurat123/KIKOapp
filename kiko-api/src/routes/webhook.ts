/**
 * Webhook Routes
 * Receives notifications from Go webhook service and triggers copy trades
 */

import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import {
    claimTxProcessingLockDistributed,
    fetchTransaction,
    fetchTransactionReceipt,
    isTxProcessedDistributed,
    markTxAsProcessedDistributed,
    releaseTxProcessingLockDistributed
} from '../services/watcherService.js';
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

const IS_PRODUCTION = env.nodeEnv === 'production' || env.nodeEnv === 'prod';
let lastMissingAlchemySecretWarnAt = 0;

function parseAlchemyNetworkFromRawBody(rawBody: string): string | undefined {
    try {
        const payload = JSON.parse(rawBody);
        const evmNetwork = payload?.event?.network;
        const solNetwork = payload?.event?.event?.network || payload?.event?.network;
        return evmNetwork || solNetwork || payload?.network;
    } catch {
        return undefined;
    }
}

function extractAlchemyNetwork(payload: any): string | undefined {
    const evmNetwork = payload?.event?.network;
    const solNetwork = payload?.event?.event?.network || payload?.event?.network;
    return evmNetwork || solNetwork || payload?.network;
}

function selectAlchemySecretsForNetwork(rawNetwork?: string): string[] {
    const network = String(rawNetwork || '').toUpperCase();
    const secrets: string[] = [];

    if (!network) {
        if (env.security.alchemyWebhookSecretBase) secrets.push(env.security.alchemyWebhookSecretBase);
        if (env.security.alchemyWebhookSecretBsc) secrets.push(env.security.alchemyWebhookSecretBsc);
        if (env.security.alchemyWebhookSecretSol) secrets.push(env.security.alchemyWebhookSecretSol);
    } else if (network.includes('BASE')) {
        if (env.security.alchemyWebhookSecretBase) secrets.push(env.security.alchemyWebhookSecretBase);
    } else if (network.includes('BSC') || network.includes('BNB')) {
        if (env.security.alchemyWebhookSecretBsc) secrets.push(env.security.alchemyWebhookSecretBsc);
    } else if (network.includes('SOL')) {
        if (env.security.alchemyWebhookSecretSol) secrets.push(env.security.alchemyWebhookSecretSol);
    }

    // Legacy/global fallback for compatibility
    if (env.security.alchemyWebhookSecret) secrets.push(env.security.alchemyWebhookSecret);

    return [...new Set(secrets.filter(Boolean))];
}

function safeSecretEquals(provided: unknown, expected: string): boolean {
    if (typeof provided !== 'string') return false;
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export default async function webhookRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/webhook/process-tx
     * Called by Go webhook service when Alchemy detects a transaction
     */
    fastify.post<{ Body: ProcessTxBody }>('/process-tx', async (request, reply) => {
        // 1. Verify internal secret if configured
        const internalSecret = env.security.internalWebhookSecret;
        if (!internalSecret) {
            if (IS_PRODUCTION) {
                console.error('[Webhook] INTERNAL_WEBHOOK_SECRET is required in production');
                return reply.status(503).send({ error: 'Webhook is not configured securely' });
            }
            console.warn('[Webhook] INTERNAL_WEBHOOK_SECRET is missing (development mode only)');
        } else {
            const providedSecret = request.headers['x-internal-secret'];
            if (!safeSecretEquals(providedSecret, internalSecret)) {
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

        let txLockValue: string | null = null;
        try {
            txLockValue = await claimTxProcessingLockDistributed(txHash, chainId);
            if (!txLockValue) {
                return reply.send({ success: true, skipped: true, reason: 'already_processing_or_processed' });
            }
            if (await isTxProcessedDistributed(txHash, chainId)) {
                return reply.send({ success: true, skipped: true, reason: 'already_processed_cache' });
            }

            // Check if already processed
            const existingPosition = await prisma.position.findFirst({
                where: {
                    chainId,
                    OR: [
                        { leaderTxHash: txHash },
                        { entryTxHash: txHash }
                    ]
                }
            });
            if (existingPosition) {
                console.log(`[Webhook] Tx already processed: ${txHash.slice(0, 16)}`);
                await markTxAsProcessedDistributed(txHash, chainId);
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
                chainId,
                wallet
            );

            if (!swap) {
                console.log(`[Webhook] Not a swap tx: ${txHash.slice(0, 16)}`);
                await markTxAsProcessedDistributed(txHash, chainId);
                return reply.send({ success: true, skipped: true, reason: 'not_a_swap' });
            }

            console.log(`[Webhook] ✅ Swap detected:`, {
                wallet: wallet.slice(0, 10),
                tokenIn: swap.tokenIn,
                tokenOut: swap.tokenOut,
                dex: swap.dexName,
            });

            // Enqueue copy trade for async execution
            const { enqueueCopyTradeTask } = await import('../services/copyTradeQueue.js');
            enqueueCopyTradeTask(wallet, swap, chainId);
            await markTxAsProcessedDistributed(txHash, chainId);

            return reply.send({ success: true, swap: { tokenIn: swap.tokenIn, tokenOut: swap.tokenOut } });
        } catch (error: any) {
            console.error(`[Webhook] Error processing tx:`, error);
            return reply.status(500).send({ error: 'Failed to process transaction' });
        } finally {
            if (txLockValue) {
                await releaseTxProcessingLockDistributed(txHash, chainId, txLockValue);
            }
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
    fastify.post('/alchemy', { config: { rawBody: true } }, async (request, reply) => {
        // 1. Signature Verification for Alchemy
        const content = (request as any).rawBody;
        const payloadForNetwork = request.body as any;
        const parsedNetwork = content
            ? parseAlchemyNetworkFromRawBody(content)
            : extractAlchemyNetwork(payloadForNetwork);
        const alchemySecrets = selectAlchemySecretsForNetwork(parsedNetwork);

        if (alchemySecrets.length === 0) {
            const now = Date.now();
            if (IS_PRODUCTION && !env.security.allowUnsignedAlchemyWebhook) {
                if (now - lastMissingAlchemySecretWarnAt > 60_000) {
                    lastMissingAlchemySecretWarnAt = now;
                    console.error('[Webhook] Alchemy webhook signing key missing in production; rejecting /alchemy webhook requests');
                }
                return reply.status(503).send({ error: 'Alchemy webhook secret not configured' });
            }
            if (now - lastMissingAlchemySecretWarnAt > 60_000) {
                lastMissingAlchemySecretWarnAt = now;
                console.warn('[Webhook] Alchemy webhook signing key missing; accepting unsigned /alchemy webhook requests');
            }
        } else {
            const signature = request.headers['x-alchemy-signature'] as string;
            if (!signature) {
                console.warn(`[Webhook] Missing Alchemy signature from ${request.ip}`);
                return reply.status(401).send({ error: 'Missing signature' });
            }
            if (!content) {
                if (IS_PRODUCTION && !env.security.allowUnsignedAlchemyWebhook) {
                    console.error('[Webhook] rawBody missing on /alchemy while signature verification is required');
                    return reply.status(503).send({ error: 'Webhook raw body unavailable for signature verification' });
                }
                console.warn('[Webhook] rawBody missing on /alchemy; skipping signature verification due to unsigned mode');
            }

            let signatureValid = false;
            if (content) {
                for (const secret of alchemySecrets) {
                    const hmac = crypto.createHmac('sha256', secret);
                    hmac.update(content);
                    const digest = hmac.digest('hex');
                    if (safeSecretEquals(signature, digest)) {
                        signatureValid = true;
                        break;
                    }
                }
            } else {
                signatureValid = env.security.allowUnsignedAlchemyWebhook;
            }

            if (!signatureValid) {
                console.warn(`[Webhook] Invalid Alchemy signature. Got ${signature?.slice?.(0, 12) || 'unknown'}...`);
                return reply.status(401).send({ error: 'Invalid signature' });
            }
        }

        const payload = request.body as any;
        const rawNetwork = extractAlchemyNetwork(payload) || 'unknown';
        const sampleActivity = payload?.event?.activity?.[0] || payload?.event?.activity;
        const sampleTx = payload?.event?.event?.transaction?.[0] || payload?.event?.event?.transaction;
        const sampleHash = sampleActivity?.hash || sampleTx?.signature || 'n/a';
        const sampleCategory = sampleActivity?.category || 'n/a';
        const sampleAsset = sampleActivity?.asset || sampleActivity?.rawContract?.address || 'n/a';
        console.log(
            `[Webhook] Alchemy payload: network=${rawNetwork} hash=${String(sampleHash).slice(0, 12)} category=${sampleCategory} asset=${sampleAsset}`
        );

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
                    const byTxHash = new Map<string, any>();
                    for (const activity of items) {
                        const hash = String(activity?.hash || '').toLowerCase();
                        if (!hash) continue;
                        const prev = byTxHash.get(hash);
                        if (!prev) {
                            byTxHash.set(hash, activity);
                            continue;
                        }
                        const prevScore = Number(!!prev?.rawContract?.address) + Number(!!prev?.fromAddress) + Number(!!prev?.toAddress);
                        const currScore = Number(!!activity?.rawContract?.address) + Number(!!activity?.fromAddress) + Number(!!activity?.toAddress);
                        if (currScore >= prevScore) byTxHash.set(hash, activity);
                    }
                    if (byTxHash.size > 0 && byTxHash.size !== items.length) {
                        console.log(`[Webhook] Deduped EVM activities from ${items.length} to ${byTxHash.size}`);
                        items = Array.from(byTxHash.values());
                    }
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
                    if (await isTxProcessedDistributed(txHash, chainId)) {
                        console.log(`[Webhook] Tx already in processedTxs cache: ${txHash.slice(0, 16)}`);
                        return;
                    }
                    const txLockValue = await claimTxProcessingLockDistributed(txHash, chainId);
                    if (!txLockValue) {
                        console.log(`[Webhook] Tx already in-flight: ${txHash.slice(0, 16)}`);
                        return;
                    }

                    try {
                        const trackedWallets = await prisma.trackedWallet.findMany({
                            where: {
                                address: { in: candidates, mode: 'insensitive' },
                                chainId,
                            }
                        });

                        if (trackedWallets.length === 0) {
                            console.log(
                                `[Webhook] Ignore tx ${txHash.slice(0, 12)}: no tracked wallets (from/to ${candidates.map(c => c.slice(0, 6)).join(', ')})`
                            );
                            return;
                        }

                        console.log(`[Webhook] 🎯 Found ${trackedWallets.length} tracked wallets for tx ${txHash.slice(0, 8)}`);

                        // Branch by chain type: Solana vs EVM
                        if (chainId === 900) {
                            try {
                                // Solana Logic
                                const { getSolanaConnection } = await import('../services/rpcManager.js');
                                const { decodeSolanaSwap } = await import('../services/solanaDecoder.js');

                            let tx: any = null;
                            const strategies: Array<'fast' | 'cheap'> = ['fast', 'cheap'];
                            for (const strategy of strategies) {
                                try {
                                    const connection = getSolanaConnection(strategy, 'critical');
                                    tx = await connection.getParsedTransaction(txHash, {
                                        maxSupportedTransactionVersion: 0,
                                        commitment: 'confirmed'
                                    });
                                    if (tx) {
                                        console.log(`[Webhook] ✅ Successfully fetched Solana tx via rpcManager (${strategy})`);
                                        break;
                                    }
                                } catch (err: any) {
                                    const isSslError = err.message?.includes('SSL') || err.cause?.message?.includes('SSL');
                                    console.warn(`[Webhook] Solana fetch failed via rpcManager (${strategy}): ${err.message}${isSslError ? ' (SSL Error)' : ''}`);
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

                            await markTxAsProcessedDistributed(txHash, chainId);

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
                        const fetchWithRetry = async () => {
                            const maxAttempts = 3;
                            let tx: any = null;
                            let receipt: any = null;
                            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                [tx, receipt] = await Promise.all([
                                    fetchTransaction(txHash, chainId),
                                    fetchTransactionReceipt(txHash, chainId),
                                ]);
                                if (tx && receipt) break;
                                if (attempt < maxAttempts) {
                                    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
                                }
                            }
                            return { tx, receipt, attempts: maxAttempts };
                        };

                        const { tx, receipt, attempts } = await fetchWithRetry();

                        if (!tx || !receipt) {
                            console.warn(`[Webhook] Could not fetch tx/receipt after retries: ${txHash.slice(0, 16)}`, {
                                txMissing: !tx,
                                receiptMissing: !receipt,
                                attempts
                            });
                            return;
                        }

                        // Mark as processed only after tx/receipt fetch succeeded
                        await markTxAsProcessedDistributed(txHash, chainId);

                        // Trigger copy trade for EACH matched tracked wallet
                        const { handleSwapDetected } = await import('../services/autoTradeService.js');

                        await Promise.allSettled(trackedWallets.map(async (walletRecord) => {
                        const trackedTarget = walletRecord.address;

                        // Parse as swap - IMPORTANT: Use trackedTarget as the identity for decoding
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
                            chainId,
                            trackedTarget
                        );

                        if (!swap) {
                            const selector = tx.input?.slice(0, 10) || '0x';
                            console.log(
                                `[Webhook] Not swap: tx=${txHash.slice(0, 12)} to=${(tx.to || '').slice(0, 10)} sel=${selector} status=${parseInt(receipt.status, 16)} logs=${receipt.logs?.length ?? 0}`
                            );
                            return;
                        }

                        console.log(`[Webhook] ✅ Swap detected for tracked wallet ${trackedTarget.slice(0, 10)}:`, {
                            tokenIn: swap.tokenIn,
                            tokenOut: swap.tokenOut,
                            dex: swap.dexName,
                        });

                        const { enqueueCopyTradeTask } = await import('../services/copyTradeQueue.js');
                        enqueueCopyTradeTask(trackedTarget, swap, chainId);
                        }));
                    } finally {
                        await releaseTxProcessingLockDistributed(txHash, chainId, txLockValue);
                    }
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

}
