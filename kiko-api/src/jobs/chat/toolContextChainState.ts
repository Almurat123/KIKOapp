const CHAIN_ID_TO_NAME: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    56: 'BNB Chain',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    900: 'Solana',
};

const CHAIN_ID_TO_SLUG: Record<number, string> = {
    1: 'eth',
    10: 'optimism',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    8453: 'base',
    900: 'solana',
};

const CHAIN_ID_TO_NATIVE_SYMBOL: Record<number, string> = {
    1: 'ETH',
    10: 'ETH',
    56: 'BNB',
    137: 'POL',
    42161: 'ETH',
    8453: 'ETH',
    900: 'SOL',
};

type PendingChainSwitchParams = {
    toolContext: Record<string, any>;
    chainId: number;
    chainName?: string;
    evmWalletAddress?: string;
    solanaWalletAddress?: string;
};

type StoredToolContextSnapshot = {
    chainId?: number;
    chainName?: string;
    chain?: string;
    analysisChainId?: number;
    analysisChainName?: string;
    analysisChain?: string;
    walletAddress?: string;
    userAddress?: string;
    evmWalletAddress?: string;
    solanaWalletAddress?: string;
    solanaAddress?: string;
    userSolanaAddress?: string;
    balance?: Record<string, any>;
    nativeBalance?: string;
    balanceSnapshotAt?: string;
};

type ResolveChainSwitchAckParams = PendingChainSwitchParams & {
    status: 'success' | 'failed';
    error?: string;
};

function getAllChainBalanceKey(chainId: number): string | null {
    return CHAIN_ID_TO_SLUG[chainId] || null;
}

function normalizeBalanceEntries(balance: any): Record<string, string> {
    const next: Record<string, string> = {};
    if (!balance || typeof balance !== 'object') return next;
    for (const [key, raw] of Object.entries(balance)) {
        if (raw == null) continue;
        if (typeof raw === 'object') {
            const value = (raw as any).balance ?? (raw as any).tokenBalance ?? (raw as any).formatted ?? (raw as any).amount ?? '0';
            next[key] = String(value);
            const contract = (raw as any).contractAddress || (raw as any).contract;
            if (contract) next[String(contract).toLowerCase()] = String(value);
            continue;
        }
        next[key] = String(raw);
    }
    return next;
}

function snapshotToolContextForRestore(toolContext: Record<string, any> | undefined): StoredToolContextSnapshot {
    const current = toolContext || {};
    const snapshot: StoredToolContextSnapshot = {};
    const keys: Array<keyof StoredToolContextSnapshot> = [
        'chainId',
        'chainName',
        'chain',
        'analysisChainId',
        'analysisChainName',
        'analysisChain',
        'walletAddress',
        'userAddress',
        'evmWalletAddress',
        'solanaWalletAddress',
        'solanaAddress',
        'userSolanaAddress',
        'balance',
        'nativeBalance',
        'balanceSnapshotAt',
    ];
    for (const key of keys) {
        if (current[key] === undefined) continue;
        const value = current[key];
        snapshot[key] = value && typeof value === 'object'
            ? JSON.parse(JSON.stringify(value))
            : value;
    }
    return snapshot;
}

function restoreToolContextSnapshot(
    toolContext: Record<string, any>,
    snapshot: StoredToolContextSnapshot | undefined,
): Record<string, any> {
    const next = { ...(toolContext || {}) };
    const keys: Array<keyof StoredToolContextSnapshot> = [
        'chainId',
        'chainName',
        'chain',
        'analysisChainId',
        'analysisChainName',
        'analysisChain',
        'walletAddress',
        'userAddress',
        'evmWalletAddress',
        'solanaWalletAddress',
        'solanaAddress',
        'userSolanaAddress',
        'balance',
        'nativeBalance',
        'balanceSnapshotAt',
    ];
    for (const key of keys) {
        if (snapshot && snapshot[key] !== undefined) {
            const value = snapshot[key];
            next[key] = value && typeof value === 'object'
                ? JSON.parse(JSON.stringify(value))
                : value;
            continue;
        }
        delete next[key];
    }
    return next;
}

export function buildToolContextForChain(params: {
    toolContext: Record<string, any>;
    chainId: number;
    chainName?: string;
    evmWalletAddress?: string;
    solanaWalletAddress?: string;
}): Record<string, any> {
    const { toolContext, chainId } = params;
    const next = { ...(toolContext || {}) };
    const chainName = params.chainName || CHAIN_ID_TO_NAME[chainId] || `Chain ${chainId}`;
    const chainSlug = CHAIN_ID_TO_SLUG[chainId];
    const allChainBalances = next.allChainBalances && typeof next.allChainBalances === 'object'
        ? next.allChainBalances
        : null;
    const chainSnapshot = chainSlug && allChainBalances ? allChainBalances[chainSlug] : null;

    next.chainId = chainId;
    next.chainName = chainName;
    next.chain = chainSlug || chainName;
    next.analysisChainId = chainId;
    next.analysisChainName = chainName;
    if (chainSlug) next.analysisChain = chainSlug;

    if (params.evmWalletAddress) next.evmWalletAddress = params.evmWalletAddress;
    if (params.solanaWalletAddress) next.solanaWalletAddress = params.solanaWalletAddress;

    if (chainId === 900) {
        const solanaAddress = params.solanaWalletAddress || next.solanaWalletAddress || next.solanaAddress || next.userSolanaAddress;
        if (solanaAddress) {
            next.walletAddress = solanaAddress;
            next.userAddress = solanaAddress;
            next.solanaAddress = solanaAddress;
            next.userSolanaAddress = solanaAddress;
        }
    } else {
        const evmAddress = params.evmWalletAddress || next.evmWalletAddress || next.walletAddress || next.userAddress;
        if (evmAddress) {
            next.walletAddress = evmAddress;
            next.userAddress = evmAddress;
            next.evmWalletAddress = evmAddress;
        }
    }

    if (chainSnapshot && typeof chainSnapshot === 'object') {
        const nativeSymbol = CHAIN_ID_TO_NATIVE_SYMBOL[chainId];
        const snapshotBalance = normalizeBalanceEntries(chainSnapshot.tokens);
        const nativeBalance = chainSnapshot.ethBalanceFormatted ?? chainSnapshot.ethBalance ?? chainSnapshot.nativeBalance;
        if (nativeSymbol && nativeBalance != null) {
            snapshotBalance[nativeSymbol] = String(nativeBalance);
            next.nativeBalance = String(nativeBalance);
        } else {
            delete next.nativeBalance;
        }
        next.balance = snapshotBalance;
        next.balanceSnapshotAt = next.allChainBalancesSnapshotAt || new Date().toISOString();
    } else {
        delete next.balance;
        delete next.nativeBalance;
        delete next.balanceSnapshotAt;
    }

    return next;
}

export function markPendingToolContextChainSwitch(params: PendingChainSwitchParams): Record<string, any> {
    const optimistic = buildToolContextForChain({
        toolContext: params.toolContext || {},
        chainId: params.chainId,
        chainName: params.chainName,
        evmWalletAddress: params.evmWalletAddress,
        solanaWalletAddress: params.solanaWalletAddress,
    });
    const chainName = params.chainName || CHAIN_ID_TO_NAME[params.chainId] || `Chain ${params.chainId}`;
    const next = { ...optimistic };
    next.pendingChainSwitch = {
        targetChainId: params.chainId,
        targetChainName: chainName,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        previousContext: snapshotToolContextForRestore(params.toolContext),
    };
    delete next.lastChainSwitchError;

    return next;
}

export function resolveToolContextChainSwitchAck(params: ResolveChainSwitchAckParams): Record<string, any> {
    const next = { ...(params.toolContext || {}) };
    const pending = next.pendingChainSwitch && typeof next.pendingChainSwitch === 'object'
        ? next.pendingChainSwitch
        : null;
    const chainId = params.chainId || Number(pending?.targetChainId || 0) || 0;
    const chainName = params.chainName || pending?.targetChainName || CHAIN_ID_TO_NAME[chainId] || `Chain ${chainId}`;

    if (params.status === 'success') {
        const applied = buildToolContextForChain({
            toolContext: next,
            chainId,
            chainName,
            evmWalletAddress: params.evmWalletAddress,
            solanaWalletAddress: params.solanaWalletAddress,
        });
        delete applied.pendingChainSwitch;
        delete applied.lastChainSwitchError;
        applied.lastChainSwitch = {
            chainId,
            chainName,
            switchedAt: new Date().toISOString(),
        };
        return applied;
    }

    const restored = restoreToolContextSnapshot(
        next,
        pending?.previousContext && typeof pending.previousContext === 'object'
            ? pending.previousContext as StoredToolContextSnapshot
            : undefined,
    );
    delete restored.pendingChainSwitch;
    restored.lastChainSwitchError = {
        chainId,
        chainName,
        error: params.error || 'Chain switch failed or was rejected by the wallet.',
        failedAt: new Date().toISOString(),
    };
    return restored;
}

export function getConnectedChainLabel(chainId?: number): string {
    if (!chainId) return 'unknown';
    return CHAIN_ID_TO_NAME[chainId] || `Chain ${chainId}`;
}

export function getRequestedChainBalanceKey(chainId?: number): string | null {
    if (!chainId) return null;
    return getAllChainBalanceKey(chainId);
}
