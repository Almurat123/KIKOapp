// Backward-compatible shim.
// Canonical implementation now lives in services/notifications/farcaster.
export type {
    TradeNotificationType,
    TradeNotificationData,
    TradeNotificationParams
} from './notifications/farcaster/index.js';

export {
    NotificationService,
    notificationService
} from './notifications/farcaster/index.js';
