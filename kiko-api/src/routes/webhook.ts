/**
 * Webhook Routes
 * Receives notifications from Go webhook service and triggers copy trades
 */

import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { fetchTransaction, fetchTransactionReceipt, isTxProcessed, markTxAsProcessed } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';

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
            return reply.status(500).send({ error: error.message || 'Failed to process transaction' });
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

    fastify.get('/config-check', async (request, reply) => {
        const mask = (s: string | undefined) => s ? `${s.slice(0, 10)}...${s.slice(-4)}` : 'MISSING';
        return reply.send({
            ALCHEMY_AUTH_TOKEN: mask(process.env.ALCHEMY_AUTH_TOKEN),
            ALCHEMY_WEBHOOK_ID_SOL: mask(process.env.ALCHEMY_WEBHOOK_ID_SOL),
            ALCHEMY_WEBHOOK_ID_BASE: mask(process.env.ALCHEMY_WEBHOOK_ID_BASE),
            ALCHEMY_WEBHOOK_ID_BSC: mask(process.env.ALCHEMY_WEBHOOK_ID_BSC),
            SOLANA_RPC_URL: mask(process.env.SOLANA_RPC_URL),
        });
    });

    /**
     * POST /api/webhook/alchemy
     * Direct endpoint for Alchemy Address Activity webhooks
     */
    fastify.post('/alchemy', async (request, reply) => {
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

        // Process activities asynchronously
        try {
            // Alchemy Address Activity webhook structure:
            // EVM: payload.event.network, payload.event.activity
            // Solana: payload.event.event.network, payload.event.event.transaction
            const evmNetwork = payload?.event?.network;
            const solNetwork = payload?.event?.event?.network;
            const network = evmNetwork || solNetwork;

            const chainId = NETWORK_TO_CHAIN_ID[network] || (network ? NETWORK_TO_CHAIN_ID[network.toUpperCase()] : undefined);

            if (!chainId) {
                console.warn(`[Webhook] Unknown network: ${network}`);
                return;
            }

            // Extract items to process (Activity or Transaction)
            let items: any[] = [];
            let isSolanaItems = false;

            if (payload?.event?.activity) {
                items = payload.event.activity;
                console.log(`[Webhook] Processing as EVM activity (${items.length} items)`);
            } else if (payload?.event?.event?.transaction) {
                items = payload.event.event.transaction;
                isSolanaItems = true;
                console.log(`[Webhook] Processing as Solana transaction (${items.length} items)`);
            } else if (payload?.event?.transaction) {
                items = payload.event.transaction;
                isSolanaItems = true;
                console.log(`[Webhook] Processing as Solana transaction (fallback nest) (${items.length} items)`);
            } else {
                console.log(`[Webhook] No recognizable activity or transaction array in payload`);
            }

            for (const item of items) {
                let txHash = '';
                let candidates: string[] = [];

                if (isSolanaItems) {
                    // Solana Structure
                    // item.signature or item.transaction.signatures[0]
                    txHash = item.signature;
                    if (!txHash && item.transaction?.signatures) {
                        txHash = item.transaction.signatures[0];
                    }

                    // Extract all involved accounts as candidates
                    // item.transaction.message.account_keys (array of strings or objects)
                    const keys = item.transaction?.message?.account_keys || [];
                    candidates = keys.map((k: any) => typeof k === 'string' ? k : k.pubkey || k.toString());
                } else {
                    // EVM Structure
                    txHash = item.hash;
                    const fromAddr = item.fromAddress?.toLowerCase();
                    const toAddr = item.toAddress?.toLowerCase();
                    candidates = [fromAddr, toAddr].filter(Boolean);
                }

                if (!txHash) continue;

                // FAST in-memory deduplication check (shared with watcher)
                if (isTxProcessed(txHash)) {
                    console.log(`[Webhook] Tx already in processedTxs cache: ${txHash.slice(0, 16)}`);
                    continue;
                }

                const trackedWallets = await prisma.trackedWallet.findMany({
                    where: {
                        address: { in: candidates },
                        chainId,
                    }
                });

                if (trackedWallets.length === 0) {
                    console.log(`[Webhook] ⚠️ Ignoring tx ${txHash.slice(0, 8)}: No matched tracked wallets in [${candidates.map(c => c.slice(0, 6)).join(', ')}]`);
                    continue;
                }

                // Mark as processing ONLY if we have matched wallets
                markTxAsProcessed(txHash);

                console.log(`[Webhook] 🎯 Found ${trackedWallets.length} tracked wallets for tx ${txHash.slice(0, 8)}`);

                // Branch by chain type: Solana vs EVM
                if (chainId === 900) {
                    // Solana Logic
                    const { getSolanaConnection } = await import('../config/solanaConfig.js');
                    const { decodeSolanaSwap } = await import('../services/solanaDecoder.js');
                    const connection = getSolanaConnection();

                    try {
                        const tx = await connection.getParsedTransaction(txHash, {
                            maxSupportedTransactionVersion: 0,
                            commitment: 'confirmed'
                        });

                        if (!tx) {
                            console.warn(`[Webhook] Could not fetch Solana tx: ${txHash.slice(0, 16)}`);
                            continue;
                        }

                        // Trigger copy trade for EACH matched tracked wallet
                        const { handleSwapDetected } = await import('../services/autoTradeService.js');
                        for (const walletRecord of trackedWallets) {
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
                        }
                    } catch (err) {
                        console.error(`[Webhook] Error fetching Solana tx details:`, err);
                    }
                    continue;
                }

                // EVM Logic (Base, BSC, etc.)
                const [tx, receipt] = await Promise.all([
                    fetchTransaction(txHash, chainId),
                    fetchTransactionReceipt(txHash, chainId),
                ]);

                if (!tx || !receipt) {
                    console.warn(`[Webhook] Could not fetch tx/receipt: ${txHash.slice(0, 16)}`);
                    continue;
                }

                // Trigger copy trade for EACH matched tracked wallet
                const { handleSwapDetected } = await import('../services/autoTradeService.js');

                for (const walletRecord of trackedWallets) {
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
                        continue;
                    }

                    console.log(`[Webhook] ✅ Swap detected for tracked wallet ${trackedTarget.slice(0, 10)}:`, {
                        tokenIn: swap.tokenIn,
                        tokenOut: swap.tokenOut,
                        dex: swap.dexName,
                    });

                    await handleSwapDetected(trackedTarget, swap, chainId);
                }
            }
        } catch (error) {
            console.error(`[Webhook] Error processing Alchemy webhook:`, error);
        }
    });
}
