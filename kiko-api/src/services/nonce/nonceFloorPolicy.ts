export interface NonceFloorPolicyInput {
    requestedNonce?: string;
    cachedFloorNonce?: string;
    txPurpose?: string;
    hasPriorAcceptedLifecycle?: boolean;
}

export interface NonceFloorPolicyResult {
    nonce?: string;
    upgraded: boolean;
    reason:
        | 'missing_requested_nonce'
        | 'missing_cached_floor'
        | 'speedup_preserved'
        | 'replacement_preserved'
        | 'requested_nonce_kept'
        | 'floor_applied'
        | 'invalid_nonce';
}

export function resolveNonceFloor(input: NonceFloorPolicyInput): NonceFloorPolicyResult {
    const { requestedNonce, cachedFloorNonce, txPurpose, hasPriorAcceptedLifecycle } = input;

    if (!requestedNonce) {
        return { nonce: requestedNonce, upgraded: false, reason: 'missing_requested_nonce' };
    }
    if (!cachedFloorNonce) {
        return { nonce: requestedNonce, upgraded: false, reason: 'missing_cached_floor' };
    }
    if (txPurpose === 'speedup') {
        return { nonce: requestedNonce, upgraded: false, reason: 'speedup_preserved' };
    }
    if (hasPriorAcceptedLifecycle) {
        return { nonce: requestedNonce, upgraded: false, reason: 'replacement_preserved' };
    }

    try {
        const requested = BigInt(requestedNonce);
        const floor = BigInt(cachedFloorNonce);
        if (requested < floor) {
            return { nonce: floor.toString(), upgraded: true, reason: 'floor_applied' };
        }
        return { nonce: requestedNonce, upgraded: false, reason: 'requested_nonce_kept' };
    } catch {
        return { nonce: requestedNonce, upgraded: false, reason: 'invalid_nonce' };
    }
}
