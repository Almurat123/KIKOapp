// Backward-compatible shim.
// Canonical implementation now lives in services/notifications/farcaster.
export type {
    SendDirectCastParams,
    DirectCastResponse
} from './notifications/farcaster/index.js';

export {
    WarpcastService,
    warpcastService
} from './notifications/farcaster/index.js';
