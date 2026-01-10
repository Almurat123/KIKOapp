import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import prisma from '../db/prisma.js';
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { DecodedSwap } from './txDecoder.js';

// Polling interval
const POLL_INTERVAL = 5000;

export class SolanaWatcher {
    private connection: Connection;
    private interval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    constructor() {
        this.connection = getSolanaConnection();
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[SolanaWatcher] Starting Solana transaction watcher...');
        this.poll();
    }

    stop() {
        this.isRunning = false;
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
        }
        console.log('[SolanaWatcher] Stopped.');
    }

    private async poll() {
        if (!this.isRunning) return;

        try {
            const wallets = await prisma.trackedWallet.findMany({
                where: { chainId: 900 }
            });

            const solanaWallets = wallets.filter((w: any) => !w.address.startsWith('0x'));

            for (const wallet of solanaWallets) {
                await this.checkWallet(wallet.address);
            }
        } catch (error: any) {
            console.error('[SolanaWatcher] Polling error:', error.message);
        }

        if (this.isRunning) {
            this.interval = setTimeout(() => this.poll(), POLL_INTERVAL);
        }
    }

    private async checkWallet(address: string) {
        try {
            const pubkey = new PublicKey(address);
            const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit: 10 });

            // Log signatures found
            if (signatures.length > 0) {
                console.log(`[SolanaWatcher] Found ${signatures.length} signatures for ${address}`);
            }

            for (const sigInfo of signatures) {
                const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
                    maxSupportedTransactionVersion: 0
                });

                if (tx && tx.meta && tx.transaction && tx.transaction.message) {
                    await this.processTransaction(address, tx);
                } else {
                    console.warn(`[SolanaWatcher] Skipping transaction ${sigInfo.signature} due to missing data.`);
                }
            }
        } catch (error: any) {
            console.warn(`[SolanaWatcher] Error checking wallet ${address}:`, error.message);
        }
    }

    private async processTransaction(address: string, tx: ParsedTransactionWithMeta) {
        // Placeholder for transaction processing logic
        // In a real scenario, we'd use txDecoder to parse swaps or transfers
    }
}

export const solanaWatcher = new SolanaWatcher();

// export function startSolanaWatcher() {
//    return solanaWatcher.start();
// }

export function startSolanaWatcher() {
    console.log('[SolanaWatcher] ⚠️ Watcher disabled in favor of Webhooks. Not starting polling.');
    return Promise.resolve();
}

let solanaSwapCallback: ((target: string, swap: any, chainId: number) => Promise<void>) | null = null;
export function onSolanaSwapDetected(callback: (target: string, swap: any, chainId: number) => Promise<void>) {
    solanaSwapCallback = callback;
}
