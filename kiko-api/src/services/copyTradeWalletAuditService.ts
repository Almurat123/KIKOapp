// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Rowan
// Reason: copy-trade target-wallet identity is funds-sensitive and previous
//         incidents showed LLM/entity drift can mutate repeated characters
//         before persistence.
// Goal: write durable provenance for wallet binding so every copy-trade create
//       can be audited from raw user text to final persisted target wallet.
// Owns: best-effort copy-trade wallet provenance writes.
// Does Not Own: deciding the target wallet, validating signed payloads,
//               webhook subscription sync, or blocking execution.
// Design Language:
// - audit records are append-only evidence, not execution gates
// - audit write failure logs but does not block copy-trade config creation
// - compare model/tool wallet vs final wallet case-insensitively for EVM safety
// - signed HTTP creates are audited as signed-payload provenance when chat text is unavailable
// Document Provenance:
// - Source: production incident analysis of malformed BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: audit trail for raw_user_message, extracted_wallets, llm/tool arg, and final written wallet
// - Verification: verified in unit tests and production table creation
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-deterministic-extraction.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md
import { randomUUID } from 'node:crypto';
import prisma from '../db/prisma.js';
import { normalizeAddress } from '../utils/address.js';

export interface CopyTradeWalletBindingAudit {
    rawUserMessage?: string | null;
    extractedWallets?: string[];
    llmTargetWallet?: string | null;
    finalTargetWallet?: string | null;
    source?: string | null;
    reasonCode?: string | null;
}

export interface RecordCopyTradeWalletAuditInput {
    userId?: string | null;
    configId?: string | null;
    action: string;
    chainId?: number | null;
    binding?: CopyTradeWalletBindingAudit | null;
    finalTargetWallet?: string | null;
    writtenTargetWallet?: string | null;
    source?: string | null;
    reasonCode?: string | null;
}

export async function safeRecordCopyTradeWalletAudit(input: RecordCopyTradeWalletAuditInput): Promise<void> {
    try {
        await recordCopyTradeWalletAudit(input);
    } catch (error: any) {
        console.warn('[CopyTradeWalletAudit] failed to record wallet provenance', {
            action: input.action,
            configId: input.configId || null,
            chainId: input.chainId || null,
            error: error?.message || String(error),
        });
    }
}

async function recordCopyTradeWalletAudit(input: RecordCopyTradeWalletAuditInput): Promise<void> {
    const binding = input.binding || {};
    const finalTargetWallet = normalizeWallet(input.finalTargetWallet || binding.finalTargetWallet || null);
    const writtenTargetWallet = normalizeWallet(input.writtenTargetWallet || finalTargetWallet || null);
    const llmTargetWallet = normalizeWallet(binding.llmTargetWallet || null);
    const extractedWallets = normalizeWalletList(binding.extractedWallets || []);
    const mismatchDetected = detectMismatch({
        llmTargetWallet,
        finalTargetWallet,
        writtenTargetWallet,
        extractedWallets,
    });

    await prisma.$executeRawUnsafe(
        `INSERT INTO "CopyTradeWalletAudit" (
            "id",
            "userId",
            "configId",
            "action",
            "source",
            "chainId",
            "rawUserMessage",
            "extractedWallets",
            "llmTargetWallet",
            "finalTargetWallet",
            "writtenTargetWallet",
            "mismatchDetected",
            "reasonCode"
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13
        )`,
        randomUUID(),
        input.userId || null,
        input.configId || null,
        input.action,
        input.source || binding.source || 'unknown',
        Number.isInteger(Number(input.chainId)) ? Number(input.chainId) : null,
        binding.rawUserMessage || null,
        JSON.stringify(extractedWallets),
        llmTargetWallet,
        finalTargetWallet,
        writtenTargetWallet,
        mismatchDetected,
        input.reasonCode || binding.reasonCode || null,
    );
}

function normalizeWallet(value: string | null): string | null {
    const raw = String(value || '').trim();
    if (!raw) return null;
    return normalizeAddress(raw);
}

function normalizeWalletList(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values || []) {
        const normalized = normalizeWallet(value);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

function detectMismatch(input: {
    llmTargetWallet: string | null;
    finalTargetWallet: string | null;
    writtenTargetWallet: string | null;
    extractedWallets: string[];
}): boolean {
    if (input.llmTargetWallet && input.finalTargetWallet && input.llmTargetWallet !== input.finalTargetWallet) {
        return true;
    }
    if (input.writtenTargetWallet && input.finalTargetWallet && input.writtenTargetWallet !== input.finalTargetWallet) {
        return true;
    }
    if (input.extractedWallets.length === 1 && input.finalTargetWallet && input.extractedWallets[0] !== input.finalTargetWallet) {
        return true;
    }
    return false;
}
