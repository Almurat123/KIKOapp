import { CHAINS } from './chainConfig.js';

export interface PreheatConfig {
    enabled: boolean;
    chainIds: number[];
    factoryAllowlist: Record<number, string[]>;
    eventNames: string[];
    callerAddress: string;
    amountInEth: string;
    maxAttempts: number;
    retryScheduleMs: number[];
    ttlMs: number;
    concurrency: number;
}

const DEFAULT_EVENT_NAMES = [
    'tokencreated',
    'newtoken',
    'createdtoken',
    'tokendeployed',
    'deployedtoken',
    // Virtuals (Bonding/Launchpad events)
    'prelaunched',
    'launched',
    'deployed',
    'graduated',
    'paircreated'
];

function parseAddressList(raw?: string): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0)
        .map(v => v.toLowerCase());
}

function parseNumberList(fallback: number[], raw?: string): number[] {
    if (!raw) return fallback;
    const parsed = raw
        .split(',')
        .map(v => Number(v.trim()))
        .filter(v => Number.isFinite(v));
    return parsed.length > 0 ? parsed : fallback;
}

export function getPreheatConfig(): PreheatConfig {
    const enabled = (process.env.PREHEAT_ENABLED || 'true').toLowerCase() === 'true';
    const chainIds = parseNumberList([8453], process.env.PREHEAT_CHAIN_IDS);
    const eventNames = (process.env.PREHEAT_EVENT_NAMES || DEFAULT_EVENT_NAMES.join(','))
        .split(',')
        .map(v => v.trim().toLowerCase())
        .filter(Boolean);

    const DEFAULT_BASE_FACTORIES = [
        // Clanker V4 Factory (Base)
        '0xe85a59c628f7d27878aceb4bf3b35733630083a9',
        // Zora Factory (Base)
        '0x777777751622c0d3258f214f9df38e35bf45baf3',
        // Virtuals (Launchpad/Bonding) - Base mainnet proxies
        // BondingV2
        '0xc3538ddd84619e761b4c03caf2f785f79889958d',
        // BondingV3
        '0xacb04ab3a1076f4e38de1bac1e19e1c60ff343aa',
        // BondingV4
        '0xa31bd6a0edbc4da307b8fa92bd6cf39e0fae262c',
        // FFactoryV2 proxies (PairCreated)
        '0x9037b87e2d4934932548060023d18b88a4be6cfc',
        '0xd7d3c85b4f2e9bee1998cd2e98820e647792d284'
    ];
    const baseFactories = parseAddressList(process.env.PREHEAT_FACTORY_ADDRESSES_BASE);
    const resolvedBaseFactories = baseFactories.length > 0 ? baseFactories : DEFAULT_BASE_FACTORIES;
    const factoryAllowlist: Record<number, string[]> = {
        8453: resolvedBaseFactories
    };

    const callerAddress = (process.env.PREHEAT_CALLER_ADDRESS || '').toLowerCase()
        || '0x000000000000000000000000000000000000dead';
    const amountInEth = process.env.PREHEAT_AMOUNT_IN_ETH || '0.0001';
    const maxAttempts = Number(process.env.PREHEAT_MAX_ATTEMPTS || '6');
    const retryScheduleMs = parseNumberList(
        [500, 1500, 3000, 7000, 15000, 30000],
        process.env.PREHEAT_RETRY_SCHEDULE_MS
    );
    const ttlMs = Number(process.env.PREHEAT_CACHE_TTL_MS || '600000'); // 10 min
    const concurrency = Number(process.env.PREHEAT_CONCURRENCY || '3');

    // Ensure chains are valid
    const supported = chainIds.filter(id => !!CHAINS[id]);

    return {
        enabled,
        chainIds: supported.length > 0 ? supported : [8453],
        factoryAllowlist,
        eventNames,
        callerAddress,
        amountInEth,
        maxAttempts,
        retryScheduleMs,
        ttlMs,
        concurrency
    };
}
