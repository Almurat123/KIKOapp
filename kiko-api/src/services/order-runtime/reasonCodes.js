"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferOrderReasonCode = inferOrderReasonCode;
function inferOrderReasonCode(input) {
    var message = String(input || '').toLowerCase();
    if (!message)
        return 'unknown';
    if (message.includes('underpriced'))
        return 'underpriced';
    if (message.includes('nonce too low') || message.includes('nonce'))
        return 'nonce_conflict';
    if (message.includes('all rpc endpoints failed'))
        return 'rpc_uncertain';
    if (message.includes('not visible') || message.includes('broadcasted_unseen'))
        return 'pending_visibility';
    if (message.includes('timeout'))
        return 'visibility_timeout';
    if (message.includes('route') && message.includes('not'))
        return 'route_not_found';
    if (message.includes('duplicate'))
        return 'duplicate_lock';
    if (message.includes('insufficient'))
        return 'insufficient_balance';
    if (message.includes('revert'))
        return 'reverted';
    if (message.includes('reject') || message.includes('failed to send'))
        return 'send_rejected';
    return 'unknown';
}
