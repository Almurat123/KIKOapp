"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNonceFloor = resolveNonceFloor;
function resolveNonceFloor(input) {
    var requestedNonce = input.requestedNonce, cachedFloorNonce = input.cachedFloorNonce, txPurpose = input.txPurpose, hasPriorAcceptedLifecycle = input.hasPriorAcceptedLifecycle;
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
        var requested = BigInt(requestedNonce);
        var floor = BigInt(cachedFloorNonce);
        if (requested < floor) {
            return { nonce: floor.toString(), upgraded: true, reason: 'floor_applied' };
        }
        return { nonce: requestedNonce, upgraded: false, reason: 'requested_nonce_kept' };
    }
    catch (_a) {
        return { nonce: requestedNonce, upgraded: false, reason: 'invalid_nonce' };
    }
}
