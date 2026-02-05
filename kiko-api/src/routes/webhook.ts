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
import { handleCdpWebhookPayload } from '../services/preheatService.js';

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
                chainId,
                wallet
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

            // Enqueue copy trade for async execution
            const { enqueueCopyTradeTask } = await import('../services/copyTradeQueue.js');
            enqueueCopyTradeTask(wallet, swap, chainId);

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
        const payloadEventName = payload?.data?.eventName || payload?.event?.eventName || payload?.eventName;
        const payloadContract = payload?.data?.contractAddress || payload?.event?.contractAddress || payload?.contractAddress;
        console.log(`[Webhook] CDP payload: event=${payloadEventName || 'unknown'} contract=${payloadContract || 'unknown'} ${JSON.stringify(payload).slice(0, 600)}`);

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
                    markTxAsProcessed(txHash);

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
                            console.log(`[Webhook] Not a swap tx for ${trackedTarget.slice(0, 10)}: ${txHash.slice(0, 16)}`);
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

    // Coinbase CDP webhook (preheat only; not used for copytrade address tracking).
    /**
     * POST /api/webhook/cdp
     * Coinbase CDP webhooks (onchain activity)
     */
    fastify.post('/cdp', { config: { rawBody: true } }, async (request, reply) => {
        const signature = request.headers['x-hook0-signature'] as string | undefined;
        // If not a CDP webhook, ignore silently (likely Alchemy misrouted)
        if (!signature) {
            console.warn('[Webhook] CDP missing signature', {
                ip: request.ip,
                ua: request.headers['user-agent'],
                ct: request.headers['content-type']
            });
            return reply.send({ success: true, ignored: true });
        }

        const cdpSecretRaw = env.security.coinbaseCdpWebhookSecret;
        const cdpSecrets = cdpSecretRaw
            ? cdpSecretRaw.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        if (cdpSecrets.length > 0) {
            const rawBody = (request as any).rawBody;
            if (!rawBody) {
                console.error('[Webhook] rawBody missing for CDP webhook');
                return reply.status(500).send({ error: 'Internal server error' });
            }

            const isValid = cdpSecrets.some(secret =>
                verifyCdpSignature(signature, rawBody.toString(), request.headers, secret)
            );
            if (!isValid) {
                console.warn('[Webhook] Invalid CDP signature');
                return reply.status(401).send({ error: 'Invalid signature' });
            }
        }

        const payload = request.body as any;
        const payloadEventName = payload?.data?.eventName || payload?.event?.eventName || payload?.eventName;
        const payloadContract = payload?.data?.contractAddress || payload?.event?.contractAddress || payload?.contractAddress;
        console.log(`[Webhook] CDP payload: event=${payloadEventName || 'unknown'} contract=${payloadContract || 'unknown'}`);
        if ((process.env.CDP_DEBUG_PAYLOAD || '').toLowerCase() === 'true') {
            const safe = JSON.stringify(payload);
            console.log(`[Webhook] CDP payload raw: ${safe.slice(0, 2000)}`);
        }

        reply.send({ success: true });

        setImmediate(() => {
            try {
                handleCdpWebhookPayload(payload);
            } catch (err: any) {
                console.error('[Webhook] Error processing CDP webhook:', err?.message || err);
            }
        });
    });
}

function verifyCdpSignature(
    signatureHeader: string,
    rawBody: string,
    headers: Record<string, any>,
    secret: string
): boolean {
    const parts = signatureHeader.split(',').map(p => p.trim());
    const map: Record<string, string> = {};
    for (const part of parts) {
        const [k, v] = part.split('=');
        if (k && v) map[k] = v;
    }

    const timestampRaw = map['t'];
    const signature = map['v1'];
    const signedHeaderNames = map['h'] || '';

    if (!timestampRaw || !signature) return false;

    let timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp)) return false;
    // Support ms timestamps
    if (timestamp > 1e12) timestamp = Math.floor(timestamp / 1000);

    const maxAgeSec = Number(process.env.CDP_WEBHOOK_MAX_AGE_SEC || '300');
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestamp) > maxAgeSec) {
        return false;
    }

    const headerNames = signedHeaderNames.length
        ? signedHeaderNames.split(' ').map(h => h.trim()).filter(Boolean)
        : [];
    const headerValues = headerNames
        .map(name => String(headers[name] ?? headers[name.toLowerCase()] ?? ''))
        .join('.');

    const signedPayload = `${timestampRaw}.${signedHeaderNames}.${headerValues}.${rawBody}`;
    const computed = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
        return false;
    }
}
