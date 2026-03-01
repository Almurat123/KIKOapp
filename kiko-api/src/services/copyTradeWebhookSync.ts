import {
    reconcileCopyTradeWebhookChain,
    type WebhookReconcileReason,
    type WebhookReconcileResult,
} from './alchemyWebhookReconciler.js';

export async function syncCopyTradeWebhookChain(
    chainId: number,
    reason: WebhookReconcileReason
): Promise<WebhookReconcileResult> {
    const result = await reconcileCopyTradeWebhookChain(chainId, reason);
    if (!result.ok) {
        console.warn('[CopyTradeWebhookSync] reconcile incomplete', result);
    }
    return result;
}
