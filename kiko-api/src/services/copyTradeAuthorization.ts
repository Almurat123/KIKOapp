import { AppError } from '../middleware/errorHandler.js';
import { getDelegatedEvmWallet } from './privyWallet.js';

export const COPYTRADE_AUTO_TRADING_AUTH_REQUIRED_CODE = 'AUTO_TRADING_AUTH_REQUIRED';

const COPYTRADE_AUTH_GUIDANCE =
  'Open Wallet, tap Settings, then authorize the Auto-Trading EVM button before creating copy trade.';

export function getCopyTradeAuthorizationUserMessage(): string {
  return `Copy trade requires Auto-Trading EVM authorization first. ${COPYTRADE_AUTH_GUIDANCE}`;
}

export async function assertCopyTradeAutoTradingAuthorized(userId: string, chainId?: number): Promise<void> {
  // Keep Solana behavior unchanged for now. This guard is for the EVM auto-trading path the user reported.
  if (Number(chainId) === 900) {
    return;
  }

  const delegatedWallet = await getDelegatedEvmWallet(userId);
  if (delegatedWallet) {
    return;
  }

  throw new AppError(
    400,
    getCopyTradeAuthorizationUserMessage(),
    COPYTRADE_AUTO_TRADING_AUTH_REQUIRED_CODE,
  );
}

export function buildCopyTradeAuthorizationStopResult() {
  const message = getCopyTradeAuthorizationUserMessage();
  return {
    success: false,
    code: COPYTRADE_AUTO_TRADING_AUTH_REQUIRED_CODE,
    authorization_required: true,
    summary: message,
    next_steps: [
      'Open Wallet page.',
      'Tap Settings.',
      'Find Auto-Trading Authorization.',
      'Authorize the EVM button.',
      'Return to chat and create the copy trade again.',
    ],
    settings_path: ['Wallet', 'Settings', 'Auto-Trading Authorization', 'EVM'],
    _must_stop: true,
    _user_message: message,
  };
}
