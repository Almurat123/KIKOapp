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
    'BASE_MAINNET': 8453,
    'BNB_SMART_CHAIN_MAINNET': 56,
    'SOLANA_MAINNET': 900,      // Solana
    'ETH_MAINNET': 1,
    'ARB_MAINNET': 42161,
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

        const chainId = NETWORK_TO_CHAIN_ID[network];
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
     * POST /api/webhook/alchemy
     * Direct endpoint for Alchemy Address Activity webhooks
     */
    fastify.post('/alchemy', async (request, reply) => {
        const payload = request.body as any;

        // Debug: Log full payload structure (first 2000 chars)
        console.log(`[Webhook] Alchemy payload:`, JSON.stringify(payload, null, 2).slice(0, 2000));

        // Respond immediately with 200 (Alchemy expects this)
        reply.send({ success: true });

        // Process activities asynchronously
        try {
            // Alchemy webhook structure can vary - check multiple paths
            // Standard Address Activity: payload.event.network
            // Some versions: payload.network
            // Activity level: payload.event.activity[0].network
            const network = payload?.event?.network
                || payload?.network
                || payload?.event?.activity?.[0]?.network;

            const chainId = NETWORK_TO_CHAIN_ID[network];

            if (!chainId) {
                console.warn(`[Webhook] Unknown network: ${network}, tried paths: event.network, network, event.activity[0].network`);
                return;
            }

            const activities = payload?.event?.activity || [];

            for (const activity of activities) {
                const txHash = activity.hash;
                const fromAddr = activity.fromAddress?.toLowerCase();
                const toAddr = activity.toAddress?.toLowerCase();

                if (!txHash) continue;

                // FAST in-memory deduplication check (shared with watcher)
                if (isTxProcessed(txHash)) {
                    console.log(`[Webhook] Tx already in processedTxs cache: ${txHash.slice(0, 16)}`);
                    continue;
                }

                // Mark as processing IMMEDIATELY to prevent race conditions
                // Before any await that could allow another request to pass the check
                markTxAsProcessed(txHash);

                // Check if EITHER from or to is a tracked wallet
                // This handles smart wallets, relayers, or cases where the tracked wallet is the recipient
                const candidates = [fromAddr, toAddr].filter(Boolean) as string[];
                let trackedTarget: string | null = null;

                // Find if any of the addresses involved are tracked
                const trackedWallets = await prisma.trackedWallet.findMany({
                    where: {
                        address: { in: candidates },
                        chainId,
                    }
                });

                if (trackedWallets.length === 0) {
                    continue;
                }

                // Fetch full transaction details (once per transaction)
                const [tx, receipt] = await Promise.all([
                    fetchTransaction(txHash, chainId),
                    fetchTransactionReceipt(txHash, chainId),
                ]);

                if (!tx || !receipt) {
                    console.warn(`[Webhook] Could not fetch tx/receipt: ${txHash.slice(0, 16)}`);
                    continue;
                }

                // Trigger copy trade for EACH matched tracked wallet
                // This handles cases where Target A swims with Target B (one sells, one buys)
                const { handleSwapDetected } = await import('../services/autoTradeService.js');

                for (const walletRecord of trackedWallets) {
                    const trackedTarget = walletRecord.address;

                    // Parse as swap - IMPORTANT: Use trackedTarget as the identity for decoding
                    const swap = await parseSwapTransaction(
                        {
                            hash: txHash,
                            from: trackedTarget, // The identity we are decoding FOR
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
