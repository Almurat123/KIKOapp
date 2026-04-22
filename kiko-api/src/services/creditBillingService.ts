import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import { env } from '../config/env.js';
import {
    getBillingCategory,
    getUtcDateString,
    normalizeModelForPricing,
} from './billing/billingService.js';
import { getBillingTokenPriceUsd } from './billing/priceService.js';

// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: mixed
// Why: KiKo moved from quota + daily delegated settlement to prepaid credits.
//      The customer-facing source of truth is now an immutable credit ledger
//      backed by per-deposit lots so chat, image, deposit, and refund flows can
//      share one auditable balance model.
// Debug Goal: keep account balances, per-deposit remaining balances, and ledger
//             allocations in sync for every credit/debit/reserve/release/refund path.
// Search Tags: credits ledger proportional lot allocation refund per deposit
// Invariants:
// - `credit_accounts.available_credits + reserved_credits` must equal the sum of remaining and held balances across open deposits.
// - Every non-idempotent balance mutation writes one ledger entry and matching per-deposit allocations.
// - Refunds only return unused paid credits; KIKO bonus credits are reclaimed, never paid out.
// Failure Modes:
// - Updating account balances without updating deposit lots causes refund and debit drift.
// - Replaying the same debit/reserve/refund without idempotency will double-charge or double-release credits.

const CREDIT_DECIMAL_PLACES = 8;
const KIKO_BONUS_MULTIPLIER = new Decimal(1.2);
const STABLECOIN_PRICE_USD = new Decimal(1);
const ZERO = new Decimal(0);

type TxClient = Prisma.TransactionClient;

type CreditLot = {
    id: string;
    paidCredits: Decimal;
    bonusCredits: Decimal;
    heldPaidCredits: Decimal;
    heldBonusCredits: Decimal;
    amountHuman: Decimal;
    assetSymbol: string;
    txHash: string;
};

type CreditAllocation = {
    depositId: string;
    paidCredits: Decimal;
    bonusCredits: Decimal;
};

type CreditReservationState = {
    id: string;
    accountId: string;
    userId: string;
    amountCredits: Decimal;
    availableAfterCredits: Decimal;
    reservedAfterCredits: Decimal;
    allocations: CreditAllocation[];
};

export type CreditBalanceSummary = {
    availableCredits: number;
    reservedCredits: number;
    premiumTextFreeUsed: number;
    premiumTextFreeLimit: number;
    generatedImageFreeUsed: number;
    generatedImageFreeLimit: number;
};

export type TextUsageDecision = {
    allowed: boolean;
    reason?: 'INSUFFICIENT_CREDITS' | 'MODEL_PRICING_NOT_CONFIGURED';
    requestedModel: string;
    modelCategory: 'free' | 'premium' | 'other';
    dateUtc: string;
    isFree: boolean;
    premiumFreeUsed: number;
    premiumFreeLimit: number;
    availableCredits: number;
    requiredCredits: number;
};

export type CreditLedgerListItem = {
    id: string;
    entryType: string;
    direction: string;
    amountCredits: number;
    sourceType: string;
    sourceId: string;
    createdAt: Date;
    metadata: Prisma.JsonValue | null;
};

export type CreditDepositListItem = {
    id: string;
    status: string;
    chainId: number;
    assetSymbol: string;
    txHash: string;
    amountHuman: number;
    paidCredits: number;
    bonusCredits: number;
    remainingPaidCredits: number;
    remainingBonusCredits: number;
    heldPaidCredits: number;
    heldBonusCredits: number;
    refundablePaidCredits: number;
    refundEligible: boolean;
    refundWindowExpiresAt: Date | null;
    refundRequestId: string | null;
    refundRequestStatus: string | null;
    createdAt: Date;
    creditedAt: Date | null;
};

export type CreditRefundListItem = {
    id: string;
    depositId: string;
    status: string;
    assetSymbol: string;
    requestedPaidCredits: number;
    reclaimedBonusCredits: number;
    refundAmountHuman: number;
    payoutTxHash: string | null;
    failureReason: string | null;
    approvedAt: Date | null;
    approvedNote: string | null;
    approvedByUserId: string | null;
    resolvedByUserId: string | null;
    resolvedNote: string | null;
    requestedAt: Date;
    resolvedAt: Date | null;
};

export type AdminCreditRefundListItem = CreditRefundListItem & {
    userId: string;
    refundToAddress: string;
    deposit: {
        txHash: string;
        fromAddress: string | null;
        toAddress: string | null;
        amountHuman: number;
        paidCredits: number;
        bonusCredits: number;
        remainingPaidCredits: number;
        remainingBonusCredits: number;
        createdAt: Date;
        creditedAt: Date | null;
    };
};

export type AdminCreditRefundDetail = AdminCreditRefundListItem & {
    accountId: string;
    tokenAddress: string | null;
    chainId: number;
    metadata: Prisma.JsonValue | null;
};

export type CreditDepositWatcherStatus = {
    watcherKey: string;
    chainId: number;
    paymentAddress: string;
    cursorBlock: string | null;
    lastWebhookBlock: string | null;
    lastWebhookAt: Date | null;
    lastReconciledAt: Date | null;
    stats: Prisma.JsonValue | null;
};

export type DepositIngestionInput = {
    userId: string;
    assetSymbol: string;
    txHash: string;
    logIndex?: number;
    amountRaw: string;
    amountHuman: string | number;
    fromAddress?: string | null;
    toAddress?: string | null;
    tokenAddress?: string | null;
    confirmations?: number;
    requiredConfirmations?: number;
    metadata?: Prisma.JsonValue;
};

export type DepositIngestionResult = {
    depositIds: string[];
    status: 'confirming' | 'below_minimum' | 'credited' | 'duplicate';
    creditedTotalCredits: number;
};

type CreditEntryInput = {
    entryType: string;
    direction: string;
    amountCredits: Decimal;
    paidCreditsDelta: Decimal;
    bonusCreditsDelta: Decimal;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    metadata?: Prisma.JsonValue;
    allocations?: CreditAllocation[];
};

function roundCredits(value: Decimal.Value): Decimal {
    return new Decimal(value || 0).toDecimalPlaces(CREDIT_DECIMAL_PLACES, Decimal.ROUND_HALF_UP);
}

function floorCredits(value: Decimal.Value): Decimal {
    return new Decimal(value || 0).toDecimalPlaces(CREDIT_DECIMAL_PLACES, Decimal.ROUND_DOWN);
}

function toDecimal(value: Decimal.Value | null | undefined): Decimal {
    if (value instanceof Decimal) return value;
    if (value === null || value === undefined) return ZERO;
    if (typeof value === 'object' && 'toString' in (value as any)) {
        return new Decimal(String(value));
    }
    return new Decimal(value as Decimal.Value);
}

function decimalToNumber(value: Decimal.Value): number {
    return Number(roundCredits(value).toFixed(CREDIT_DECIMAL_PLACES));
}

function decimalToString(value: Decimal.Value): string {
    return roundCredits(value).toFixed(CREDIT_DECIMAL_PLACES);
}

function asJsonObject(value: Record<string, any>): Prisma.JsonObject {
    return value as unknown as Prisma.JsonObject;
}

function toInputJson(value?: Prisma.JsonValue): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
}

function getCreditsPerUsd(): Decimal {
    return roundCredits(env.credits.creditsPerUsd || 10);
}

function getSupportedAsset(symbol: string) {
    const normalized = String(symbol || '').trim().toUpperCase();
    return env.credits.supportedAssets.find((asset) => asset.symbol === normalized) || null;
}

function getRefundWindowExpiresAt(value?: Date | null): Date | null {
    if (!value) return null;
    return new Date(value.getTime() + (env.credits.refundWindowHours * 60 * 60 * 1000));
}

function getRefundCutoffDate(): Date {
    return new Date(Date.now() - (env.credits.refundWindowHours * 60 * 60 * 1000));
}

function isRefundEligible(params: {
    depositStatus: string;
    creditedAt?: Date | null;
    createdAt: Date;
    refundablePaid: Decimal;
    refundRequestStatus?: string | null;
}): boolean {
    if (params.depositStatus !== 'credited') return false;
    if (params.refundablePaid.lte(0)) return false;
    if (params.refundRequestStatus) return false;
    const expiresAt = getRefundWindowExpiresAt(params.creditedAt || params.createdAt);
    return !!expiresAt && expiresAt.getTime() > Date.now();
}

function getCreditDepositWatcherKey(): string {
    return `credits:${env.credits.chainId}:${String(env.credits.paymentAddress || '').toLowerCase()}`;
}

function getImagePricing(model: string, quality?: string | null): Decimal | null {
    const normalizedModel = normalizeModelForPricing(model);
    const qualityKey = String(quality || '').trim().toLowerCase() || 'default';
    const familyPricing = env.credits.imagePricing[normalizedModel];
    if (!familyPricing) return null;
    const direct = familyPricing[qualityKey];
    if (Number.isFinite(direct)) return roundCredits(direct);
    const first = Object.values(familyPricing)[0];
    return Number.isFinite(first) ? roundCredits(first) : null;
}

function getTextPricing(model: string) {
    return env.credits.textPricing[normalizeModelForPricing(model)] || null;
}

function getPremiumMinimumRequiredCredits(model: string): Decimal {
    const pricing = getTextPricing(model);
    if (!pricing) return roundCredits(env.credits.minPremiumTextReserveCredits || 0);
    return roundCredits(
        Decimal.max(
            toDecimal(env.credits.minPremiumTextReserveCredits || 0),
            toDecimal(pricing.baseCreditsPerMessage || 0),
        ),
    );
}

function mapDepositLot(row: {
    id: string;
    remainingPaidCredits: any;
    remainingBonusCredits: any;
    heldPaidCredits: any;
    heldBonusCredits: any;
    amountHuman: any;
    assetSymbol: string;
    txHash: string;
}): CreditLot {
    return {
        id: row.id,
        paidCredits: toDecimal(row.remainingPaidCredits),
        bonusCredits: toDecimal(row.remainingBonusCredits),
        heldPaidCredits: toDecimal(row.heldPaidCredits),
        heldBonusCredits: toDecimal(row.heldBonusCredits),
        amountHuman: toDecimal(row.amountHuman),
        assetSymbol: row.assetSymbol,
        txHash: row.txHash,
    };
}

function getSpendablePaid(lot: CreditLot): Decimal {
    return Decimal.max(ZERO, lot.paidCredits.minus(lot.heldPaidCredits));
}

function getSpendableBonus(lot: CreditLot): Decimal {
    return Decimal.max(ZERO, lot.bonusCredits.minus(lot.heldBonusCredits));
}

function getSpendableTotal(lot: CreditLot): Decimal {
    return getSpendablePaid(lot).plus(getSpendableBonus(lot));
}

function getHeldTotal(lot: CreditLot): Decimal {
    return Decimal.max(ZERO, lot.heldPaidCredits).plus(Decimal.max(ZERO, lot.heldBonusCredits));
}

function normalizeAllocationList(allocations: CreditAllocation[]): CreditAllocation[] {
    return allocations
        .map((allocation) => ({
            depositId: allocation.depositId,
            paidCredits: roundCredits(allocation.paidCredits),
            bonusCredits: roundCredits(allocation.bonusCredits),
        }))
        .filter((allocation) => allocation.paidCredits.gt(0) || allocation.bonusCredits.gt(0));
}

function splitLotProportionally(params: {
    spendablePaid: Decimal;
    spendableBonus: Decimal;
    allocationTotal: Decimal;
}): { paidCredits: Decimal; bonusCredits: Decimal } {
    const spendableTotal = params.spendablePaid.plus(params.spendableBonus);
    if (spendableTotal.lte(0) || params.allocationTotal.lte(0)) {
        return { paidCredits: ZERO, bonusCredits: ZERO };
    }
    if (params.spendablePaid.lte(0)) {
        return { paidCredits: ZERO, bonusCredits: roundCredits(params.allocationTotal) };
    }
    if (params.spendableBonus.lte(0)) {
        return { paidCredits: roundCredits(params.allocationTotal), bonusCredits: ZERO };
    }
    const paidCredits = floorCredits(params.allocationTotal.mul(params.spendablePaid).div(spendableTotal));
    const bonusCredits = roundCredits(params.allocationTotal.minus(paidCredits));
    return {
        paidCredits,
        bonusCredits: Decimal.max(ZERO, bonusCredits),
    };
}

function allocateAcrossLots(lots: CreditLot[], totalAmount: Decimal, kind: 'spendable' | 'held'): CreditAllocation[] {
    const candidateLots = lots.filter((lot) => {
        const balance = kind === 'held' ? getHeldTotal(lot) : getSpendableTotal(lot);
        return balance.gt(0);
    });
    const totalAvailable = candidateLots.reduce((sum, lot) => sum.plus(kind === 'held' ? getHeldTotal(lot) : getSpendableTotal(lot)), ZERO);
    if (totalAvailable.lt(totalAmount)) {
        throw new Error('INSUFFICIENT_CREDITS');
    }

    const allocations: CreditAllocation[] = [];
    let remaining = roundCredits(totalAmount);

    candidateLots.forEach((lot, index) => {
        const balance = kind === 'held' ? getHeldTotal(lot) : getSpendableTotal(lot);
        const paidBalance = kind === 'held' ? lot.heldPaidCredits : getSpendablePaid(lot);
        const bonusBalance = kind === 'held' ? lot.heldBonusCredits : getSpendableBonus(lot);
        if (remaining.lte(0) || balance.lte(0)) return;

        const isLast = index === candidateLots.length - 1;
        const proportionalTotal = isLast
            ? remaining
            : Decimal.min(balance, floorCredits(totalAmount.mul(balance).div(totalAvailable)));
        const requestedTotal = Decimal.min(balance, remaining, proportionalTotal);
        const split = splitLotProportionally({
            spendablePaid: paidBalance,
            spendableBonus: bonusBalance,
            allocationTotal: requestedTotal,
        });
        allocations.push({
            depositId: lot.id,
            paidCredits: split.paidCredits,
            bonusCredits: split.bonusCredits,
        });
        remaining = roundCredits(remaining.minus(split.paidCredits).minus(split.bonusCredits));
    });

    if (remaining.gt(0) && allocations.length > 0) {
        const last = allocations[allocations.length - 1];
        const lot = candidateLots.find((candidate) => candidate.id === last.depositId)!;
        const paidBalance = kind === 'held' ? lot.heldPaidCredits : getSpendablePaid(lot);
        const bonusBalance = kind === 'held' ? lot.heldBonusCredits : getSpendableBonus(lot);
        const paidHeadroom = Decimal.max(ZERO, paidBalance.minus(last.paidCredits));
        const paidIncrement = Decimal.min(remaining, paidHeadroom);
        last.paidCredits = roundCredits(last.paidCredits.plus(paidIncrement));
        remaining = roundCredits(remaining.minus(paidIncrement));
        if (remaining.gt(0)) {
            last.bonusCredits = roundCredits(last.bonusCredits.plus(remaining));
            remaining = ZERO;
        }
    }

    if (remaining.gt(0)) {
        throw new Error('INSUFFICIENT_CREDITS');
    }

    return normalizeAllocationList(allocations);
}

async function ensureCreditAccount(userId: string, tx: TxClient = prisma): Promise<{ id: string; availableCredits: Decimal; reservedCredits: Decimal; status: string }> {
    const existing = await tx.creditAccount.findUnique({
        where: { userId },
        select: {
            id: true,
            availableCredits: true,
            reservedCredits: true,
            status: true,
        },
    });
    if (existing) {
        return {
            id: existing.id,
            availableCredits: toDecimal(existing.availableCredits),
            reservedCredits: toDecimal(existing.reservedCredits),
            status: existing.status,
        };
    }
    const created = await tx.creditAccount.create({
        data: {
            userId,
            availableCredits: decimalToString(0),
            reservedCredits: decimalToString(0),
            status: 'active',
        },
        select: {
            id: true,
            availableCredits: true,
            reservedCredits: true,
            status: true,
        },
    });
    return {
        id: created.id,
        availableCredits: toDecimal(created.availableCredits),
        reservedCredits: toDecimal(created.reservedCredits),
        status: created.status,
    };
}

async function loadOpenLots(accountId: string, tx: TxClient): Promise<CreditLot[]> {
    const deposits = await tx.creditDeposit.findMany({
        where: {
            accountId,
            OR: [
                { remainingPaidCredits: { gt: 0 } },
                { remainingBonusCredits: { gt: 0 } },
            ],
        },
        orderBy: [
            { creditedAt: 'asc' },
            { createdAt: 'asc' },
        ],
        select: {
            id: true,
            remainingPaidCredits: true,
            remainingBonusCredits: true,
            heldPaidCredits: true,
            heldBonusCredits: true,
            amountHuman: true,
            assetSymbol: true,
            txHash: true,
        },
    });
    return deposits.map(mapDepositLot);
}

async function createLedgerEntry(params: {
    tx: TxClient;
    accountId: string;
    userId: string;
    availableAfterCredits: Decimal;
    reservedAfterCredits: Decimal;
    input: CreditEntryInput;
}) {
    const existing = await params.tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: params.input.idempotencyKey },
        select: { id: true },
    });
    if (existing) return existing.id;

    const created = await params.tx.creditLedgerEntry.create({
        data: {
            accountId: params.accountId,
            userId: params.userId,
            entryType: params.input.entryType,
            direction: params.input.direction,
            amountCredits: decimalToString(params.input.amountCredits),
            paidCreditsDelta: decimalToString(params.input.paidCreditsDelta),
            bonusCreditsDelta: decimalToString(params.input.bonusCreditsDelta),
            availableAfterCredits: decimalToString(params.availableAfterCredits),
            reservedAfterCredits: decimalToString(params.reservedAfterCredits),
            sourceType: params.input.sourceType,
            sourceId: params.input.sourceId,
            idempotencyKey: params.input.idempotencyKey,
            metadata: toInputJson(params.input.metadata),
        },
        select: { id: true },
    });

    const allocations = normalizeAllocationList(params.input.allocations || []);
    if (allocations.length > 0) {
        await params.tx.creditLedgerAllocation.createMany({
            data: allocations.map((allocation) => ({
                ledgerEntryId: created.id,
                depositId: allocation.depositId,
                paidCreditsDelta: decimalToString(allocation.paidCredits),
                bonusCreditsDelta: decimalToString(allocation.bonusCredits),
            })),
        });
    }

    return created.id;
}

async function applyCreditMutation(params: {
    tx: TxClient;
    userId: string;
    accountId: string;
    amountCredits: Decimal;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    entryType: string;
    direction: string;
    mode: 'credit' | 'debit' | 'reserve' | 'capture' | 'release' | 'refund_hold' | 'refund_debit';
    allocations?: CreditAllocation[];
    metadata?: Prisma.JsonValue;
}) {
    const account = await params.tx.creditAccount.findUnique({
        where: { id: params.accountId },
        select: {
            availableCredits: true,
            reservedCredits: true,
        },
    });
    if (!account) {
        throw new Error('CREDIT_ACCOUNT_NOT_FOUND');
    }
    let available = toDecimal(account.availableCredits);
    let reserved = toDecimal(account.reservedCredits);

    switch (params.mode) {
        case 'credit':
            available = roundCredits(available.plus(params.amountCredits));
            break;
        case 'debit':
        case 'refund_debit':
            if (available.lt(params.amountCredits)) {
                throw new Error('INSUFFICIENT_CREDITS');
            }
            available = roundCredits(available.minus(params.amountCredits));
            break;
        case 'reserve':
        case 'refund_hold':
            if (available.lt(params.amountCredits)) {
                throw new Error('INSUFFICIENT_CREDITS');
            }
            available = roundCredits(available.minus(params.amountCredits));
            reserved = roundCredits(reserved.plus(params.amountCredits));
            break;
        case 'capture':
            if (reserved.lt(params.amountCredits)) {
                throw new Error('INSUFFICIENT_RESERVED_CREDITS');
            }
            reserved = roundCredits(reserved.minus(params.amountCredits));
            break;
        case 'release':
            if (reserved.lt(params.amountCredits)) {
                throw new Error('INSUFFICIENT_RESERVED_CREDITS');
            }
            reserved = roundCredits(reserved.minus(params.amountCredits));
            available = roundCredits(available.plus(params.amountCredits));
            break;
        default:
            throw new Error(`Unsupported credit mutation mode: ${params.mode}`);
    }

    await params.tx.creditAccount.update({
        where: { id: params.accountId },
        data: {
            availableCredits: decimalToString(available),
            reservedCredits: decimalToString(reserved),
        },
    });

    await createLedgerEntry({
        tx: params.tx,
        accountId: params.accountId,
        userId: params.userId,
        availableAfterCredits: available,
        reservedAfterCredits: reserved,
        input: {
            entryType: params.entryType,
            direction: params.direction,
            amountCredits: params.amountCredits,
            paidCreditsDelta: (params.allocations || []).reduce((sum, allocation) => sum.plus(allocation.paidCredits), ZERO),
            bonusCreditsDelta: (params.allocations || []).reduce((sum, allocation) => sum.plus(allocation.bonusCredits), ZERO),
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            idempotencyKey: params.idempotencyKey,
            allocations: params.allocations,
            metadata: params.metadata,
        },
    });
}

async function updateLotsForSpend(tx: TxClient, allocations: CreditAllocation[]) {
    for (const allocation of normalizeAllocationList(allocations)) {
        const deposit = await tx.creditDeposit.findUnique({
            where: { id: allocation.depositId },
            select: {
                remainingPaidCredits: true,
                remainingBonusCredits: true,
            },
        });
        if (!deposit) throw new Error('CREDIT_DEPOSIT_NOT_FOUND');
        await tx.creditDeposit.update({
            where: { id: allocation.depositId },
            data: {
                remainingPaidCredits: decimalToString(toDecimal(deposit.remainingPaidCredits).minus(allocation.paidCredits)),
                remainingBonusCredits: decimalToString(toDecimal(deposit.remainingBonusCredits).minus(allocation.bonusCredits)),
            },
        });
    }
}

async function updateLotsForHold(tx: TxClient, allocations: CreditAllocation[], mode: 'hold' | 'release' | 'capture' | 'refund_debit') {
    for (const allocation of normalizeAllocationList(allocations)) {
        const deposit = await tx.creditDeposit.findUnique({
            where: { id: allocation.depositId },
            select: {
                remainingPaidCredits: true,
                remainingBonusCredits: true,
                heldPaidCredits: true,
                heldBonusCredits: true,
            },
        });
        if (!deposit) throw new Error('CREDIT_DEPOSIT_NOT_FOUND');
        const remainingPaid = toDecimal(deposit.remainingPaidCredits);
        const remainingBonus = toDecimal(deposit.remainingBonusCredits);
        const heldPaid = toDecimal(deposit.heldPaidCredits);
        const heldBonus = toDecimal(deposit.heldBonusCredits);
        const next = (() => {
            if (mode === 'hold') {
                return {
                    remainingPaidCredits: remainingPaid,
                    remainingBonusCredits: remainingBonus,
                    heldPaidCredits: heldPaid.plus(allocation.paidCredits),
                    heldBonusCredits: heldBonus.plus(allocation.bonusCredits),
                };
            }
            if (mode === 'release') {
                return {
                    remainingPaidCredits: remainingPaid,
                    remainingBonusCredits: remainingBonus,
                    heldPaidCredits: heldPaid.minus(allocation.paidCredits),
                    heldBonusCredits: heldBonus.minus(allocation.bonusCredits),
                };
            }
            return {
                remainingPaidCredits: remainingPaid.minus(allocation.paidCredits),
                remainingBonusCredits: remainingBonus.minus(allocation.bonusCredits),
                heldPaidCredits: heldPaid.minus(allocation.paidCredits),
                heldBonusCredits: heldBonus.minus(allocation.bonusCredits),
            };
        })();
        await tx.creditDeposit.update({
            where: { id: allocation.depositId },
            data: {
                remainingPaidCredits: decimalToString(next.remainingPaidCredits),
                remainingBonusCredits: decimalToString(next.remainingBonusCredits),
                heldPaidCredits: decimalToString(next.heldPaidCredits),
                heldBonusCredits: decimalToString(next.heldBonusCredits),
            },
        });
    }
}

export function computePremiumTextCreditsCharge(params: {
    model: string;
    promptTokens: number;
    completionTokens: number;
}): number | null {
    const pricing = getTextPricing(params.model);
    if (!pricing) return null;
    const total = toDecimal(pricing.baseCreditsPerMessage || 0)
        .plus(toDecimal(pricing.inputCreditsPer1kTokens || 0).mul(toDecimal(params.promptTokens || 0)).div(1000))
        .plus(toDecimal(pricing.outputCreditsPer1kTokens || 0).mul(toDecimal(params.completionTokens || 0)).div(1000));
    return decimalToNumber(total);
}

export function computeGeneratedImageCreditsCharge(params: {
    model: string;
    quality?: string | null;
    imageCount: number;
}): number | null {
    const unit = getImagePricing(params.model, params.quality);
    if (!unit) return null;
    return decimalToNumber(unit.mul(Math.max(1, Math.floor(params.imageCount || 1))));
}

export async function getDailyPremiumFreeAssistantMessagesUsed(userId: string, dateUtc: string): Promise<number> {
    return prisma.billingUsageLedger.count({
        where: {
            userId,
            dateUtc: new Date(`${dateUtc}T00:00:00.000Z`),
            isFree: true,
            modelCategory: 'premium',
        },
    });
}

export async function getLifetimeImageFreeRequestsUsed(userId: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ total: string | number | null }>>`
        SELECT COALESCE(SUM(free_request_count), 0) AS total
        FROM generated_image_usage_ledger
        WHERE user_id = ${userId}
    `;
    return Number(rows[0]?.total || 0);
}

export async function getCreditBalanceSummary(userId: string): Promise<CreditBalanceSummary> {
    const dateUtc = getUtcDateString();
    const [account, premiumTextFreeUsed, generatedImageFreeUsed] = await Promise.all([
        ensureCreditAccount(userId),
        getDailyPremiumFreeAssistantMessagesUsed(userId, dateUtc),
        getLifetimeImageFreeRequestsUsed(userId),
    ]);
    return {
        availableCredits: decimalToNumber(account.availableCredits),
        reservedCredits: decimalToNumber(account.reservedCredits),
        premiumTextFreeUsed,
        premiumTextFreeLimit: env.credits.dailyPremiumFreeMessages,
        generatedImageFreeUsed,
        generatedImageFreeLimit: env.credits.lifetimeImageFreeRequests,
    };
}

export async function listCreditLedgerEntries(userId: string): Promise<CreditLedgerListItem[]> {
    const entries = await prisma.creditLedgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return entries.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        direction: entry.direction,
        amountCredits: decimalToNumber(entry.amountCredits),
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        createdAt: entry.createdAt,
        metadata: entry.metadata as Prisma.JsonValue | null,
    }));
}

export async function listCreditDeposits(userId: string): Promise<CreditDepositListItem[]> {
    const deposits = await prisma.creditDeposit.findMany({
        where: { userId },
        include: {
            refundRequests: {
                select: {
                    id: true,
                    status: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return deposits.map((deposit) => ({
        refundRequestId: deposit.refundRequests[0]?.id || null,
        refundRequestStatus: deposit.refundRequests[0]?.status || null,
        id: deposit.id,
        status: deposit.status,
        chainId: deposit.chainId,
        assetSymbol: deposit.assetSymbol,
        txHash: deposit.txHash,
        amountHuman: decimalToNumber(deposit.amountHuman),
        paidCredits: decimalToNumber(deposit.paidCredits),
        bonusCredits: decimalToNumber(deposit.bonusCredits),
        remainingPaidCredits: decimalToNumber(deposit.remainingPaidCredits),
        remainingBonusCredits: decimalToNumber(deposit.remainingBonusCredits),
        heldPaidCredits: decimalToNumber(deposit.heldPaidCredits),
        heldBonusCredits: decimalToNumber(deposit.heldBonusCredits),
        refundablePaidCredits: decimalToNumber(Decimal.max(ZERO, toDecimal(deposit.remainingPaidCredits).minus(deposit.heldPaidCredits))),
        refundEligible: isRefundEligible({
            depositStatus: deposit.status,
            creditedAt: deposit.creditedAt,
            createdAt: deposit.createdAt,
            refundablePaid: Decimal.max(ZERO, toDecimal(deposit.remainingPaidCredits).minus(deposit.heldPaidCredits)),
            refundRequestStatus: deposit.refundRequests[0]?.status || null,
        }),
        refundWindowExpiresAt: getRefundWindowExpiresAt(deposit.creditedAt || deposit.createdAt),
        createdAt: deposit.createdAt,
        creditedAt: deposit.creditedAt,
    }));
}

export async function listCreditRefundRequests(userId: string): Promise<CreditRefundListItem[]> {
    const refunds = await prisma.creditRefundRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return refunds.map((refund) => ({
        id: refund.id,
        depositId: refund.depositId,
        status: refund.status,
        assetSymbol: refund.assetSymbol,
            requestedPaidCredits: decimalToNumber(refund.requestedPaidCredits),
            reclaimedBonusCredits: decimalToNumber(refund.reclaimedBonusCredits),
            refundAmountHuman: decimalToNumber(refund.refundAmountHuman),
            payoutTxHash: refund.payoutTxHash,
            failureReason: refund.failureReason,
            approvedAt: refund.approvedAt,
            approvedNote: refund.approvedNote,
            approvedByUserId: refund.approvedByUserId,
            resolvedByUserId: refund.resolvedByUserId,
            resolvedNote: refund.resolvedNote,
            requestedAt: refund.requestedAt,
            resolvedAt: refund.resolvedAt,
        }));
}

function parseWatcherStats(value: Prisma.JsonValue | null | undefined): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const next: Record<string, number> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) next[key] = numeric;
    }
    return next;
}

export async function updateCreditDepositWatcherState(params: {
    cursorBlock?: string | null;
    lastWebhookBlock?: string | null;
    touchedBy?: 'webhook' | 'reconcile';
    statDeltas?: Record<string, number>;
}) {
    const watcherKey = getCreditDepositWatcherKey();
    const paymentAddress = String(env.credits.paymentAddress || '').trim();
    if (!paymentAddress) return null;

    const existing = await prisma.creditDepositWatcherState.findUnique({
        where: { watcherKey },
    });
    const nextStats = parseWatcherStats(existing?.stats as Prisma.JsonValue | null);
    for (const [key, delta] of Object.entries(params.statDeltas || {})) {
        if (!Number.isFinite(delta)) continue;
        nextStats[key] = (nextStats[key] || 0) + delta;
    }

    return prisma.creditDepositWatcherState.upsert({
        where: { watcherKey },
        create: {
            watcherKey,
            chainId: env.credits.chainId,
            paymentAddress: paymentAddress.toLowerCase(),
            cursorBlock: params.cursorBlock || null,
            lastWebhookBlock: params.lastWebhookBlock || null,
            lastWebhookAt: params.touchedBy === 'webhook' ? new Date() : null,
            lastReconciledAt: params.touchedBy === 'reconcile' ? new Date() : null,
            stats: asJsonObject(nextStats),
        },
        update: {
            ...(params.cursorBlock !== undefined ? { cursorBlock: params.cursorBlock } : {}),
            ...(params.lastWebhookBlock !== undefined ? { lastWebhookBlock: params.lastWebhookBlock } : {}),
            ...(params.touchedBy === 'webhook' ? { lastWebhookAt: new Date() } : {}),
            ...(params.touchedBy === 'reconcile' ? { lastReconciledAt: new Date() } : {}),
            stats: asJsonObject(nextStats),
        },
    });
}

export async function getCreditDepositWatcherStatus(): Promise<CreditDepositWatcherStatus | null> {
    const watcherKey = getCreditDepositWatcherKey();
    const row = await prisma.creditDepositWatcherState.findUnique({
        where: { watcherKey },
    });
    if (!row) return null;
    return {
        watcherKey: row.watcherKey,
        chainId: row.chainId,
        paymentAddress: row.paymentAddress,
        cursorBlock: row.cursorBlock,
        lastWebhookBlock: row.lastWebhookBlock,
        lastWebhookAt: row.lastWebhookAt,
        lastReconciledAt: row.lastReconciledAt,
        stats: row.stats as Prisma.JsonValue | null,
    };
}

function mapAdminRefundItem(refund: any): AdminCreditRefundListItem {
    return {
        id: refund.id,
        userId: refund.userId,
        depositId: refund.depositId,
        status: refund.status,
        assetSymbol: refund.assetSymbol,
        refundToAddress: refund.refundToAddress,
        requestedPaidCredits: decimalToNumber(refund.requestedPaidCredits),
        reclaimedBonusCredits: decimalToNumber(refund.reclaimedBonusCredits),
        refundAmountHuman: decimalToNumber(refund.refundAmountHuman),
        payoutTxHash: refund.payoutTxHash,
        failureReason: refund.failureReason,
        approvedAt: refund.approvedAt,
        approvedNote: refund.approvedNote,
        approvedByUserId: refund.approvedByUserId,
        resolvedByUserId: refund.resolvedByUserId,
        resolvedNote: refund.resolvedNote,
        requestedAt: refund.requestedAt,
        resolvedAt: refund.resolvedAt,
        deposit: {
            txHash: refund.deposit.txHash,
            fromAddress: refund.deposit.fromAddress,
            toAddress: refund.deposit.toAddress,
            amountHuman: decimalToNumber(refund.deposit.amountHuman),
            paidCredits: decimalToNumber(refund.deposit.paidCredits),
            bonusCredits: decimalToNumber(refund.deposit.bonusCredits),
            remainingPaidCredits: decimalToNumber(refund.deposit.remainingPaidCredits),
            remainingBonusCredits: decimalToNumber(refund.deposit.remainingBonusCredits),
            createdAt: refund.deposit.createdAt,
            creditedAt: refund.deposit.creditedAt,
        },
    };
}

export async function listAdminCreditRefundRequests(status?: string | null): Promise<AdminCreditRefundListItem[]> {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const refunds = await prisma.creditRefundRequest.findMany({
        where: normalizedStatus && normalizedStatus !== 'all'
            ? { status: normalizedStatus }
            : undefined,
        include: {
            deposit: true,
        },
        orderBy: [
            { requestedAt: 'desc' },
            { createdAt: 'desc' },
        ],
        take: 200,
    });
    return refunds.map(mapAdminRefundItem);
}

export async function getAdminCreditRefundDetail(refundRequestId: string): Promise<AdminCreditRefundDetail | null> {
    const refund = await prisma.creditRefundRequest.findUnique({
        where: { id: refundRequestId },
        include: {
            deposit: true,
        },
    });
    if (!refund) return null;
    return {
        ...mapAdminRefundItem(refund),
        accountId: refund.accountId,
        tokenAddress: refund.tokenAddress,
        chainId: refund.chainId,
        metadata: refund.deposit.metadata as Prisma.JsonValue | null,
    };
}

export async function evaluateTextUsageAccess(params: { userId: string; model: string }): Promise<TextUsageDecision> {
    const requestedModel = normalizeModelForPricing(params.model);
    const modelCategory = getBillingCategory(requestedModel);
    const dateUtc = getUtcDateString();
    const [account, premiumFreeUsed] = await Promise.all([
        ensureCreditAccount(params.userId),
        getDailyPremiumFreeAssistantMessagesUsed(params.userId, dateUtc),
    ]);
    const availableCredits = decimalToNumber(account.availableCredits);
    const freeLimit = env.credits.dailyPremiumFreeMessages;

    if (modelCategory === 'free') {
        return {
            allowed: true,
            requestedModel,
            modelCategory,
            dateUtc,
            isFree: true,
            premiumFreeUsed,
            premiumFreeLimit: freeLimit,
            availableCredits,
            requiredCredits: 0,
        };
    }

    if (modelCategory === 'premium' && premiumFreeUsed < freeLimit) {
        return {
            allowed: true,
            requestedModel,
            modelCategory,
            dateUtc,
            isFree: true,
            premiumFreeUsed,
            premiumFreeLimit: freeLimit,
            availableCredits,
            requiredCredits: 0,
        };
    }

    const pricing = getTextPricing(requestedModel);
    if (!pricing) {
        return {
            allowed: false,
            reason: 'MODEL_PRICING_NOT_CONFIGURED',
            requestedModel,
            modelCategory,
            dateUtc,
            isFree: false,
            premiumFreeUsed,
            premiumFreeLimit: freeLimit,
            availableCredits,
            requiredCredits: 0,
        };
    }

    const requiredCredits = decimalToNumber(getPremiumMinimumRequiredCredits(requestedModel));
    return {
        allowed: account.availableCredits.gte(requiredCredits),
        reason: account.availableCredits.gte(requiredCredits) ? undefined : 'INSUFFICIENT_CREDITS',
        requestedModel,
        modelCategory,
        dateUtc,
        isFree: false,
        premiumFreeUsed,
        premiumFreeLimit: freeLimit,
        availableCredits,
        requiredCredits,
    };
}

export function getCreditLimitMessage(decision: Pick<TextUsageDecision, 'reason' | 'availableCredits' | 'requiredCredits'>): string {
    if (decision.reason === 'MODEL_PRICING_NOT_CONFIGURED') {
        return 'This premium model is not available for paid usage right now.';
    }
    return `Insufficient credits. You need at least ${decision.requiredCredits.toFixed(2)} credits and currently have ${decision.availableCredits.toFixed(2)}.`;
}

export async function creditDepositLots(params: {
    tx: TxClient;
    accountId: string;
    userId: string;
    deposits: Array<{
        id: string;
        paidCredits: Decimal;
        bonusCredits: Decimal;
        metadata?: Prisma.JsonValue;
    }>;
}) {
    for (const deposit of params.deposits) {
        const amountCredits = roundCredits(deposit.paidCredits.plus(deposit.bonusCredits));
        await applyCreditMutation({
            tx: params.tx,
            userId: params.userId,
            accountId: params.accountId,
            amountCredits,
            sourceType: 'deposit',
            sourceId: deposit.id,
            idempotencyKey: `credit:deposit:${deposit.id}`,
            entryType: 'deposit_credit',
            direction: 'credit',
            mode: 'credit',
            allocations: [
                {
                    depositId: deposit.id,
                    paidCredits: deposit.paidCredits,
                    bonusCredits: deposit.bonusCredits,
                },
            ],
            metadata: deposit.metadata,
        });
    }
}

export async function settleChatUsageCharge(params: {
    userId: string;
    assistantMessageId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    toolCallsCount: number;
    modelCategory: 'free' | 'premium' | 'other';
    isFree: boolean;
}) {
    if (params.isFree || params.modelCategory === 'free') return;
    const creditsCharge = computePremiumTextCreditsCharge({
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
    });
    if (creditsCharge === null) {
        throw new Error('MODEL_PRICING_NOT_CONFIGURED');
    }

    await prisma.$transaction(async (tx) => {
        const account = await ensureCreditAccount(params.userId, tx);
        const existing = await tx.creditLedgerEntry.findUnique({
            where: { idempotencyKey: `debit:chat_usage:${params.assistantMessageId}` },
            select: { id: true },
        });
        if (existing) return;

        const lots = await loadOpenLots(account.id, tx);
        const amountCredits = roundCredits(creditsCharge);
        const allocations = allocateAcrossLots(lots, amountCredits, 'spendable');
        await updateLotsForSpend(tx, allocations);
        await applyCreditMutation({
            tx,
            userId: params.userId,
            accountId: account.id,
            amountCredits,
            sourceType: 'chat_usage',
            sourceId: params.assistantMessageId,
            idempotencyKey: `debit:chat_usage:${params.assistantMessageId}`,
            entryType: 'usage_debit',
            direction: 'debit',
            mode: 'debit',
            allocations,
            metadata: asJsonObject({
                model: normalizeModelForPricing(params.model),
                promptTokens: params.promptTokens,
                completionTokens: params.completionTokens,
                totalTokens: params.totalTokens,
                toolCallsCount: params.toolCallsCount,
                chargedCredits: decimalToNumber(amountCredits),
            }),
        });
    });
}

export async function reserveImageCredits(params: {
    userId: string;
    requestId: string;
    model: string;
    quality?: string | null;
    imageCount: number;
}) {
    const creditsCharge = computeGeneratedImageCreditsCharge(params);
    if (creditsCharge === null) {
        throw new Error('MODEL_PRICING_NOT_CONFIGURED');
    }
    return prisma.$transaction(async (tx) => {
        const account = await ensureCreditAccount(params.userId, tx);
        const existing = await tx.creditLedgerEntry.findUnique({
            where: { idempotencyKey: `reserve:image_usage:${params.requestId}` },
            select: { id: true },
        });
        if (existing) {
            const reservation = await tx.creditLedgerEntry.findUnique({
                where: { idempotencyKey: `reserve:image_usage:${params.requestId}` },
                select: {
                    id: true,
                    accountId: true,
                    userId: true,
                    amountCredits: true,
                    availableAfterCredits: true,
                    reservedAfterCredits: true,
                    allocations: {
                        select: {
                            depositId: true,
                            paidCreditsDelta: true,
                            bonusCreditsDelta: true,
                        },
                    },
                },
            });
            if (!reservation) throw new Error('IMAGE_RESERVATION_NOT_FOUND');
            return {
                id: reservation.id,
                accountId: reservation.accountId,
                userId: reservation.userId,
                amountCredits: toDecimal(reservation.amountCredits),
                availableAfterCredits: toDecimal(reservation.availableAfterCredits),
                reservedAfterCredits: toDecimal(reservation.reservedAfterCredits),
                allocations: reservation.allocations.map((allocation) => ({
                    depositId: allocation.depositId,
                    paidCredits: toDecimal(allocation.paidCreditsDelta),
                    bonusCredits: toDecimal(allocation.bonusCreditsDelta),
                })),
            } satisfies CreditReservationState;
        }
        const amountCredits = roundCredits(creditsCharge);
        const lots = await loadOpenLots(account.id, tx);
        const allocations = allocateAcrossLots(lots, amountCredits, 'spendable');
        await updateLotsForHold(tx, allocations, 'hold');
        await applyCreditMutation({
            tx,
            userId: params.userId,
            accountId: account.id,
            amountCredits,
            sourceType: 'image_usage',
            sourceId: params.requestId,
            idempotencyKey: `reserve:image_usage:${params.requestId}`,
            entryType: 'usage_reserve',
            direction: 'debit',
            mode: 'reserve',
            allocations,
            metadata: asJsonObject({
                model: normalizeModelForPricing(params.model),
                quality: params.quality || null,
                imageCount: params.imageCount,
                chargedCredits: decimalToNumber(amountCredits),
            }),
        });
        const accountAfter = await tx.creditAccount.findUniqueOrThrow({
            where: { id: account.id },
            select: {
                availableCredits: true,
                reservedCredits: true,
            },
        });
        const entry = await tx.creditLedgerEntry.findUniqueOrThrow({
            where: { idempotencyKey: `reserve:image_usage:${params.requestId}` },
            select: { id: true },
        });
        return {
            id: entry.id,
            accountId: account.id,
            userId: params.userId,
            amountCredits,
            availableAfterCredits: toDecimal(accountAfter.availableCredits),
            reservedAfterCredits: toDecimal(accountAfter.reservedCredits),
            allocations,
        } satisfies CreditReservationState;
    });
}

async function loadReservationBySource(tx: TxClient, requestId: string): Promise<CreditReservationState | null> {
    const entry = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: `reserve:image_usage:${requestId}` },
        select: {
            id: true,
            accountId: true,
            userId: true,
            amountCredits: true,
            availableAfterCredits: true,
            reservedAfterCredits: true,
            allocations: {
                select: {
                    depositId: true,
                    paidCreditsDelta: true,
                    bonusCreditsDelta: true,
                },
            },
        },
    });
    if (!entry) return null;
    return {
        id: entry.id,
        accountId: entry.accountId,
        userId: entry.userId,
        amountCredits: toDecimal(entry.amountCredits),
        availableAfterCredits: toDecimal(entry.availableAfterCredits),
        reservedAfterCredits: toDecimal(entry.reservedAfterCredits),
        allocations: entry.allocations.map((allocation) => ({
            depositId: allocation.depositId,
            paidCredits: toDecimal(allocation.paidCreditsDelta),
            bonusCredits: toDecimal(allocation.bonusCreditsDelta),
        })),
    };
}

export async function captureReservedImageCredits(requestId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const reservation = await loadReservationBySource(tx, requestId);
        if (!reservation) return;
        const existingCapture = await tx.creditLedgerEntry.findUnique({
            where: { idempotencyKey: `capture:image_usage:${requestId}` },
            select: { id: true },
        });
        if (existingCapture) return;
        await updateLotsForHold(tx, reservation.allocations, 'capture');
        await applyCreditMutation({
            tx,
            userId: reservation.userId,
            accountId: reservation.accountId,
            amountCredits: reservation.amountCredits,
            sourceType: 'image_usage',
            sourceId: requestId,
            idempotencyKey: `capture:image_usage:${requestId}`,
            entryType: 'usage_capture',
            direction: 'debit',
            mode: 'capture',
            allocations: reservation.allocations,
            metadata: asJsonObject({ reservationLedgerEntryId: reservation.id }),
        });
    });
}

export async function releaseReservedImageCredits(requestId: string, reason: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const reservation = await loadReservationBySource(tx, requestId);
        if (!reservation) return;
        const existingRelease = await tx.creditLedgerEntry.findUnique({
            where: { idempotencyKey: `release:image_usage:${requestId}` },
            select: { id: true },
        });
        if (existingRelease) return;
        const existingCapture = await tx.creditLedgerEntry.findUnique({
            where: { idempotencyKey: `capture:image_usage:${requestId}` },
            select: { id: true },
        });
        if (existingCapture) return;
        await updateLotsForHold(tx, reservation.allocations, 'release');
        await applyCreditMutation({
            tx,
            userId: reservation.userId,
            accountId: reservation.accountId,
            amountCredits: reservation.amountCredits,
            sourceType: 'image_usage',
            sourceId: requestId,
            idempotencyKey: `release:image_usage:${requestId}`,
            entryType: 'usage_release',
            direction: 'credit',
            mode: 'release',
            allocations: reservation.allocations,
            metadata: asJsonObject({ reason, reservationLedgerEntryId: reservation.id }),
        });
    });
}

export async function ingestCreditDeposit(input: DepositIngestionInput): Promise<DepositIngestionResult> {
    const asset = getSupportedAsset(input.assetSymbol);
    if (!asset) throw new Error('UNSUPPORTED_DEPOSIT_ASSET');

    const logIndex = Math.max(0, Math.floor(Number(input.logIndex || 0)));
    const depositKey = `${env.credits.chainId}:${String(input.txHash).toLowerCase()}:${logIndex}`;
    const amountHuman = roundCredits(input.amountHuman);
    const confirmations = Math.max(0, Number(input.confirmations ?? 0));
    const requiredConfirmations = Math.max(1, Number(input.requiredConfirmations ?? asset.requiredConfirmations));

    return prisma.$transaction(async (tx) => {
        const account = await ensureCreditAccount(input.userId, tx);
        const existingDeposit = await tx.creditDeposit.findUnique({
            where: { depositKey },
            select: {
                id: true,
                status: true,
                paidCredits: true,
                bonusCredits: true,
            },
        });
        if (existingDeposit?.status === 'credited') {
            return {
                depositIds: [existingDeposit.id],
                status: 'duplicate',
                creditedTotalCredits: decimalToNumber(toDecimal(existingDeposit.paidCredits).plus(existingDeposit.bonusCredits)),
            };
        }

        const deposit = existingDeposit
            ? await tx.creditDeposit.update({
                where: { depositKey },
                data: {
                    status: confirmations >= requiredConfirmations ? 'confirmed' : 'confirming',
                    confirmations,
                    requiredConfirmations,
                    amountHuman: decimalToString(amountHuman),
                    metadata: toInputJson(input.metadata),
                    fromAddress: input.fromAddress,
                    toAddress: input.toAddress,
                    tokenAddress: input.tokenAddress || asset.tokenAddress,
                },
                select: { id: true },
            })
            : await tx.creditDeposit.create({
                data: {
                    userId: input.userId,
                    accountId: account.id,
                    depositKey,
                    status: confirmations >= requiredConfirmations ? 'confirmed' : 'confirming',
                    chainId: env.credits.chainId,
                    assetSymbol: asset.symbol,
                    tokenAddress: input.tokenAddress || asset.tokenAddress,
                    fromAddress: input.fromAddress,
                    toAddress: input.toAddress || asset.paymentAddress,
                    txHash: String(input.txHash).toLowerCase(),
                    logIndex,
                    amountRaw: input.amountRaw,
                    amountHuman: decimalToString(amountHuman),
                    confirmations,
                    requiredConfirmations,
                    metadata: toInputJson(input.metadata),
                },
                select: { id: true },
            });

        if (confirmations < requiredConfirmations) {
            return {
                depositIds: [deposit.id],
                status: 'confirming',
                creditedTotalCredits: 0,
            };
        }

        const candidateDeposits = await tx.creditDeposit.findMany({
            where: {
                userId: input.userId,
                chainId: env.credits.chainId,
                assetSymbol: asset.symbol,
                status: { in: ['confirmed', 'below_minimum'] },
            },
            orderBy: { createdAt: 'asc' },
        });
        const priceUsd = asset.pricingMode === 'stable_1_to_1'
            ? STABLECOIN_PRICE_USD
            : toDecimal((await getBillingTokenPriceUsd()).priceUsd);
        const minTopUpUsd = toDecimal(env.credits.minimumTopUpUsd);
        const totalUsd = candidateDeposits.reduce((sum, candidate) => sum.plus(toDecimal(candidate.amountHuman).mul(priceUsd)), ZERO);

        if (totalUsd.lt(minTopUpUsd)) {
            await tx.creditDeposit.updateMany({
                where: { id: { in: candidateDeposits.map((candidate) => candidate.id) } },
                data: {
                    status: 'below_minimum',
                    priceUsd: decimalToString(priceUsd),
                    usdValue: decimalToString(0),
                } as any,
            });
            return {
                depositIds: candidateDeposits.map((candidate) => candidate.id),
                status: 'below_minimum',
                creditedTotalCredits: 0,
            };
        }

        const creditedDepositIds: string[] = [];
        let creditedTotalCredits = ZERO;
        for (const candidate of candidateDeposits) {
            const usdValue = roundCredits(toDecimal(candidate.amountHuman).mul(priceUsd));
            const paidCredits = roundCredits(usdValue.mul(getCreditsPerUsd()));
            const bonusCredits = asset.symbol === 'KIKO'
                ? roundCredits(paidCredits.mul(KIKO_BONUS_MULTIPLIER.minus(1)))
                : ZERO;
            await tx.creditDeposit.update({
                where: { id: candidate.id },
                data: {
                    status: 'credited',
                    priceUsd: decimalToString(priceUsd),
                    usdValue: decimalToString(usdValue),
                    paidCredits: decimalToString(paidCredits),
                    bonusCredits: decimalToString(bonusCredits),
                    remainingPaidCredits: decimalToString(paidCredits),
                    remainingBonusCredits: decimalToString(bonusCredits),
                    heldPaidCredits: decimalToString(0),
                    heldBonusCredits: decimalToString(0),
                    creditedAt: new Date(),
                },
            });
            await creditDepositLots({
                tx,
                accountId: account.id,
                userId: input.userId,
                deposits: [{
                    id: candidate.id,
                    paidCredits,
                    bonusCredits,
                    metadata: asJsonObject({
                        assetSymbol: asset.symbol,
                        txHash: candidate.txHash,
                        pricedUsd: decimalToNumber(priceUsd),
                    }),
                }],
            });
            creditedDepositIds.push(candidate.id);
            creditedTotalCredits = creditedTotalCredits.plus(paidCredits).plus(bonusCredits);
        }

        return {
            depositIds: creditedDepositIds,
            status: 'credited',
            creditedTotalCredits: decimalToNumber(creditedTotalCredits),
        };
    });
}

export async function createRefundRequest(params: { userId: string; depositId: string }) {
    return prisma.$transaction(async (tx) => {
        const deposit = await tx.creditDeposit.findFirst({
            where: {
                id: params.depositId,
                userId: params.userId,
                status: 'credited',
            },
        });
        if (!deposit) {
            throw new Error('CREDIT_DEPOSIT_NOT_FOUND');
        }

        const existingRefund = await tx.creditRefundRequest.findUnique({
            where: { depositId: params.depositId },
            select: { id: true, status: true },
        });
        if (existingRefund) {
            throw new Error('REFUND_ALREADY_REQUESTED');
        }

        const cutoff = getRefundCutoffDate();
        if ((deposit.creditedAt || deposit.createdAt) < cutoff) {
            throw new Error('REFUND_WINDOW_EXPIRED');
        }

        const refundablePaid = Decimal.max(ZERO, toDecimal(deposit.remainingPaidCredits).minus(deposit.heldPaidCredits));
        const reclaimableBonus = Decimal.max(ZERO, toDecimal(deposit.remainingBonusCredits).minus(deposit.heldBonusCredits));
        if (refundablePaid.lte(0)) {
            throw new Error('NO_REFUNDABLE_CREDITS');
        }

        const account = await ensureCreditAccount(params.userId, tx);
        const allocations: CreditAllocation[] = [{
            depositId: deposit.id,
            paidCredits: refundablePaid,
            bonusCredits: reclaimableBonus,
        }];
        await updateLotsForHold(tx, allocations, 'hold');
        await applyCreditMutation({
            tx,
            userId: params.userId,
            accountId: account.id,
            amountCredits: roundCredits(refundablePaid.plus(reclaimableBonus)),
            sourceType: 'refund',
            sourceId: deposit.id,
            idempotencyKey: `refund_hold:${deposit.id}`,
            entryType: 'refund_hold',
            direction: 'debit',
            mode: 'refund_hold',
            allocations,
            metadata: asJsonObject({
                depositId: deposit.id,
                assetSymbol: deposit.assetSymbol,
            }),
        });

        const refundAmountHuman = deposit.assetSymbol === 'KIKO'
            ? roundCredits(toDecimal(deposit.amountHuman).mul(refundablePaid).div(Decimal.max(toDecimal(deposit.paidCredits), new Decimal(1))))
            : roundCredits(refundablePaid.div(getCreditsPerUsd()));

        const refund = await tx.creditRefundRequest.create({
            data: {
                userId: params.userId,
                accountId: account.id,
                depositId: deposit.id,
                status: 'pending',
                chainId: deposit.chainId,
                assetSymbol: deposit.assetSymbol,
                tokenAddress: deposit.tokenAddress,
                refundToAddress: deposit.fromAddress || deposit.toAddress || '',
                requestedPaidCredits: decimalToString(refundablePaid),
                reclaimedBonusCredits: decimalToString(reclaimableBonus),
                refundAmountHuman: decimalToString(refundAmountHuman),
            },
        });

        return {
            id: refund.id,
            status: refund.status,
            requestedPaidCredits: decimalToNumber(refundablePaid),
            reclaimedBonusCredits: decimalToNumber(reclaimableBonus),
            refundAmountHuman: decimalToNumber(refundAmountHuman),
            assetSymbol: refund.assetSymbol,
        };
    });
}

export async function approveRefundRequest(params: { refundRequestId: string; adminUserId: string; note?: string | null }) {
    await prisma.$transaction(async (tx) => {
        const refund = await tx.creditRefundRequest.findUnique({
            where: { id: params.refundRequestId },
        });
        if (!refund || refund.status !== 'pending') {
            throw new Error('REFUND_REQUEST_NOT_PENDING');
        }
        await tx.creditRefundRequest.update({
            where: { id: refund.id },
            data: {
                status: 'approved',
                approvedByUserId: params.adminUserId,
                approvedAt: new Date(),
                approvedNote: params.note || null,
            },
        });
    });
}

export async function settleRefundRequest(params: { refundRequestId: string; payoutTxHash: string; adminUserId?: string | null; note?: string | null }) {
    await prisma.$transaction(async (tx) => {
        const refund = await tx.creditRefundRequest.findUnique({
            where: { id: params.refundRequestId },
        });
        if (!refund || (refund.status !== 'pending' && refund.status !== 'approved')) {
            throw new Error('REFUND_REQUEST_NOT_ACTIONABLE');
        }
        const allocations: CreditAllocation[] = [{
            depositId: refund.depositId,
            paidCredits: toDecimal(refund.requestedPaidCredits),
            bonusCredits: toDecimal(refund.reclaimedBonusCredits),
        }];
        await updateLotsForHold(tx, allocations, 'refund_debit');
        await applyCreditMutation({
            tx,
            userId: refund.userId,
            accountId: refund.accountId,
            amountCredits: roundCredits(toDecimal(refund.requestedPaidCredits).plus(refund.reclaimedBonusCredits)),
            sourceType: 'refund',
            sourceId: refund.depositId,
            idempotencyKey: `refund_debit:${refund.depositId}`,
            entryType: 'refund_debit',
            direction: 'debit',
            mode: 'refund_debit',
            allocations,
            metadata: asJsonObject({
                refundRequestId: refund.id,
                payoutTxHash: params.payoutTxHash,
            }),
        });
        await tx.creditRefundRequest.update({
            where: { id: refund.id },
            data: {
                status: 'settled',
                payoutTxHash: params.payoutTxHash,
                resolvedAt: new Date(),
                resolvedByUserId: params.adminUserId || refund.resolvedByUserId,
                resolvedNote: params.note || refund.resolvedNote,
                approvedByUserId: refund.approvedByUserId || params.adminUserId || null,
                approvedAt: refund.approvedAt || new Date(),
            },
        });
    });
}

export async function rejectRefundRequest(params: { refundRequestId: string; failureReason: string; adminUserId?: string | null; note?: string | null }) {
    await prisma.$transaction(async (tx) => {
        const refund = await tx.creditRefundRequest.findUnique({
            where: { id: params.refundRequestId },
        });
        if (!refund || (refund.status !== 'pending' && refund.status !== 'approved')) {
            throw new Error('REFUND_REQUEST_NOT_ACTIONABLE');
        }
        const allocations: CreditAllocation[] = [{
            depositId: refund.depositId,
            paidCredits: toDecimal(refund.requestedPaidCredits),
            bonusCredits: toDecimal(refund.reclaimedBonusCredits),
        }];
        await updateLotsForHold(tx, allocations, 'release');
        await applyCreditMutation({
            tx,
            userId: refund.userId,
            accountId: refund.accountId,
            amountCredits: roundCredits(toDecimal(refund.requestedPaidCredits).plus(refund.reclaimedBonusCredits)),
            sourceType: 'refund',
            sourceId: refund.depositId,
            idempotencyKey: `refund_release:${refund.depositId}`,
            entryType: 'usage_release',
            direction: 'credit',
            mode: 'release',
            allocations,
            metadata: asJsonObject({
                refundRequestId: refund.id,
                failureReason: params.failureReason,
            }),
        });
        await tx.creditRefundRequest.update({
            where: { id: refund.id },
            data: {
                status: 'rejected',
                failureReason: params.failureReason,
                resolvedAt: new Date(),
                resolvedByUserId: params.adminUserId || refund.resolvedByUserId,
                resolvedNote: params.note || refund.resolvedNote,
            },
        });
    });
}
