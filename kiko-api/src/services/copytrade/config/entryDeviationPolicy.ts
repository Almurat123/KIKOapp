export const DEFAULT_COPYTRADE_ENTRY_DEVIATION_BPS = 1500;
const MIN_COPYTRADE_ENTRY_DEVIATION_BPS = 50;
const MAX_COPYTRADE_ENTRY_DEVIATION_BPS = 10000;

export type EntryDeviationSource =
    | 'config_field'
    | 'config_payload'
    | 'legacy_default';

export interface ResolvedEntryDeviationPolicy {
    maxEntryDeviationBps: number;
    source: EntryDeviationSource;
    reasonCode:
        | 'entry_deviation_config_field'
        | 'entry_deviation_signed_payload'
        | 'entry_deviation_legacy_default';
}

function parsePositiveBps(raw: unknown): number | null {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }
    return Math.min(MAX_COPYTRADE_ENTRY_DEVIATION_BPS, Math.max(MIN_COPYTRADE_ENTRY_DEVIATION_BPS, Math.floor(value)));
}

export function resolveMaxEntryDeviationBps(config: any): ResolvedEntryDeviationPolicy {
    const direct = parsePositiveBps(config?.maxEntryDeviationBps);
    if (direct !== null) {
        return {
            maxEntryDeviationBps: direct,
            source: 'config_field',
            reasonCode: 'entry_deviation_config_field',
        };
    }

    const payloadValue = parsePositiveBps(config?.configPayload?.maxEntryDeviationBps);
    if (payloadValue !== null) {
        return {
            maxEntryDeviationBps: payloadValue,
            source: 'config_payload',
            reasonCode: 'entry_deviation_signed_payload',
        };
    }

    return {
        maxEntryDeviationBps: DEFAULT_COPYTRADE_ENTRY_DEVIATION_BPS,
        source: 'legacy_default',
        reasonCode: 'entry_deviation_legacy_default',
    };
}

