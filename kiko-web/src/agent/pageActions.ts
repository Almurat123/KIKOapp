import type { AgentRouteAction } from './agentSchema';

interface RouteActionConfig {
  matcher: RegExp;
  actions: AgentRouteAction[];
}

const ROUTE_ACTIONS: RouteActionConfig[] = [
  {
    matcher: /^\/$|^\/chat\//,
    actions: [
      {
        id: 'chat.send_message',
        track: 'ui',
        title: 'Send chat message',
        preconditions: ['chat input is visible'],
        expected_result: 'A user message is appended and assistant starts response.',
        fallback: 'Re-focus input, then retry click on send button.',
        params: {
          message: { type: 'string', required: true },
        },
        steps: [
          { action: 'input', target: 'chat.input.textarea', description: 'Fill prompt text.' },
          { action: 'click', target: 'chat.action.send', description: 'Submit message.' },
        ],
      },
      {
        id: 'agent.tx.preview',
        track: 'api',
        title: 'Preview transaction plan via agent API',
        preconditions: ['walletAddress is available', 'chainId is known'],
        expected_result: 'API returns preview steps, risks and estimates.',
        fallback: 'Retry with normalized token symbols and chainId.',
        params: {
          endpoint: '/agent/tx/preview',
          body: {
            tokenIn: 'string',
            tokenOut: 'string',
            amount: 'string',
            chainId: 'number',
          },
        },
        steps: [
          { action: 'api.call', target: '/agent/tx/preview', description: 'Request preview plan.' },
        ],
      },
      {
        id: 'chat.configure_custom_reply_settings',
        track: 'ui',
        title: 'Open Custom Reply settings and toggle swap options',
        preconditions: ['chat or welcome input area is visible'],
        expected_result: 'Custom settings modal opens and target toggles/inputs are updated.',
        fallback: 'Reopen settings from chat toolbar and retry specific toggle id.',
        params: {
          fastSwapMode: { type: 'boolean', required: false },
          checkTokenBeforeSwap: { type: 'boolean', required: false },
          showQuoteBeforeSwap: { type: 'boolean', required: false },
          mevProtection: { type: 'boolean', required: false },
          priceDeviationCheck: { type: 'boolean', required: false },
        },
        steps: [
          { action: 'click', target: 'chat.settings.open|welcome.settings.open', description: 'Open Custom Reply modal.' },
          { action: 'click', target: 'chat.custom_settings.fast_swap.toggle', description: 'Toggle fast swap mode when needed.' },
          { action: 'click', target: 'chat.custom_settings.check_token.toggle', description: 'Toggle token security check when needed.' },
          { action: 'click', target: 'chat.custom_settings.show_quote.toggle', description: 'Toggle quote confirmation when needed.' },
          { action: 'click', target: 'chat.custom_settings.mev.toggle', description: 'Toggle MEV protection when needed.' },
          { action: 'click', target: 'chat.custom_settings.price_deviation.toggle', description: 'Toggle price deviation check when needed.' },
        ],
      },
    ],
  },
  {
    matcher: /^\/trade$/,
    actions: [
      {
        id: 'trade.edit_strategy',
        track: 'ui',
        title: 'Edit copy-trade strategy',
        preconditions: ['strategy cards are visible'],
        expected_result: 'Strategy values are changed and persisted.',
        fallback: 'Reopen dialog and submit changed fields again.',
        params: {
          strategyId: { type: 'string', required: true },
          buyAmountUsd: { type: 'number', required: false },
        },
        steps: [
          { action: 'click', target: 'trade.strategy.card.edit', description: 'Open edit dialog.' },
          { action: 'input', target: 'trade.edit.buy_amount', description: 'Set buy amount.' },
          { action: 'close', target: 'trade.edit.dialog', description: 'Close to trigger autosave.' },
        ],
      },
      {
        id: 'agent.strategies.create',
        track: 'api',
        title: 'Create strategy via agent API',
        preconditions: ['target wallet and risk params are provided'],
        expected_result: 'Strategy is created and listed on Trade page.',
        fallback: 'Retry with minimal required payload.',
        params: {
          endpoint: '/agent/strategies',
          body: {
            targetWallet: 'string',
            buyAmountUsd: 'number',
            chainId: 'number',
          },
        },
        steps: [
          { action: 'api.call', target: '/agent/strategies', description: 'Create strategy.' },
        ],
      },
    ],
  },
  {
    matcher: /^\/wallet$/,
    actions: [
      {
        id: 'wallet.open_swap',
        track: 'ui',
        title: 'Open wallet swap flow',
        preconditions: ['wallet page loaded and authenticated'],
        expected_result: 'Swap modal opens.',
        fallback: 'Navigate /wallet again and retry swap trigger.',
        params: {},
        steps: [
          { action: 'click', target: 'wallet.header.swap', description: 'Open swap modal from wallet header.' },
        ],
      },
      {
        id: 'agent.tx.execute',
        track: 'api',
        title: 'Execute transaction via agent API',
        preconditions: ['preview is approved by user'],
        expected_result: 'Execution response includes tx hash.',
        fallback: 'Call preview again and validate gas/allowance state.',
        params: {
          endpoint: '/agent/tx/execute',
          body: {
            planId: 'string',
            chainId: 'number',
          },
        },
        steps: [
          { action: 'api.call', target: '/agent/tx/execute', description: 'Submit execution request.' },
        ],
      },
    ],
  },
  {
    matcher: /^\/settings$/,
    actions: [
      {
        id: 'settings.toggle_agent_mode',
        track: 'ui',
        title: 'Toggle For Agent Mode in settings',
        preconditions: ['settings page is loaded'],
        expected_result: 'Agent mode switches between ON/OFF and map output updates.',
        fallback: 'Use URL parameter ?agent_mode=1 or ?agent_mode=0 for override.',
        params: {
          enabled: { type: 'boolean', required: true },
        },
        steps: [
          { action: 'click', target: 'settings.agent_mode.toggle', description: 'Toggle Agent mode button.' },
        ],
      },
      {
        id: 'settings.configure_security_signers',
        track: 'ui',
        title: 'Authorize or revoke session signer',
        preconditions: ['wallet is connected and security section is visible'],
        expected_result: 'Signer authorization status changes for selected chain.',
        fallback: 'Retry on the other chain button and re-open settings page.',
        params: {
          chain: { type: 'string', required: true },
        },
        steps: [
          { action: 'click', target: 'settings.security.session_signer.ethereum.toggle|settings.security.session_signer.solana.toggle', description: 'Toggle session signer authorization.' },
        ],
      },
    ],
  },
  {
    matcher: /^\/tokens$/,
    actions: [
      {
        id: 'tokens.search_and_open_detail',
        track: 'ui',
        title: 'Search token and open detail page',
        preconditions: ['tokens page is loaded'],
        expected_result: 'Target token row is visible and detail page opens after click.',
        fallback: 'Reset chain filter to All and retry the search keyword.',
        params: {
          query: { type: 'string', required: true },
          chain: { type: 'string', required: false },
        },
        steps: [
          { action: 'input', target: 'tokens.search.input', description: 'Fill token keyword or address.' },
          { action: 'select', target: 'tokens.chain.dropdown_toggle', description: 'Open chain selector when chain is provided.' },
          { action: 'select', target: 'tokens.chain.option.*', description: 'Choose target chain option.' },
          { action: 'click', target: 'tokens.list.row.*', description: 'Open matching token detail.' },
        ],
      },
      {
        id: 'tokens.change_timeframe_and_sort',
        track: 'ui',
        title: 'Change trending timeframe and sort list',
        preconditions: ['trending table is visible'],
        expected_result: 'Ranking updates to selected timeframe and selected sort column.',
        fallback: 'Switch back to 5m and remove sort to recover baseline order.',
        params: {
          timeframe: { type: 'string', required: true },
          sortBy: { type: 'string', required: false },
        },
        steps: [
          { action: 'select', target: 'tokens.timeframe.5m|tokens.timeframe.1h|tokens.timeframe.24h', description: 'Set timeframe.' },
          { action: 'select', target: 'tokens.sort.*', description: 'Apply sort if needed.' },
        ],
      },
    ],
  },
  {
    matcher: /^\/tokens\/[^/]+\/[^/]+$/,
    actions: [
      {
        id: 'token_detail.execute_trade_intent',
        track: 'ui',
        title: 'Trigger buy/sell intent from token detail',
        preconditions: ['token detail page is loaded'],
        expected_result: 'App navigates to chat with a prefilled trade prompt.',
        fallback: 'Use back navigation and reopen detail page from tokens list.',
        params: {
          side: { type: 'string', required: true },
        },
        steps: [
          { action: 'click', target: 'token_detail.trade.buy|token_detail.trade.sell', description: 'Trigger trade intent.' },
        ],
      },
      {
        id: 'token_detail.copy_address',
        track: 'ui',
        title: 'Copy token contract address',
        preconditions: ['token address bar is visible'],
        expected_result: 'Address is copied to clipboard.',
        fallback: 'Retry copy button and verify clipboard content.',
        params: {},
        steps: [
          { action: 'click', target: 'token_detail.copy_address', description: 'Copy contract address.' },
        ],
      },
    ],
  },
  {
    matcher: /.*/,
    actions: [
      {
        id: 'nav.open_trade_page',
        track: 'ui',
        title: 'Navigate to Trade page',
        preconditions: ['sidebar navigation visible'],
        expected_result: 'Route changes to /trade.',
        fallback: 'Use direct route navigation /trade.',
        params: {},
        steps: [
          { action: 'click', target: 'sidebar.nav.trade', description: 'Open trade page from sidebar.' },
        ],
      },
    ],
  },
];

export const getActionsForRoute = (pathname: string): AgentRouteAction[] => {
  const seen = new Set<string>();
  const out: AgentRouteAction[] = [];

  for (const item of ROUTE_ACTIONS) {
    if (!item.matcher.test(pathname)) continue;
    for (const action of item.actions) {
      if (seen.has(action.id)) continue;
      seen.add(action.id);
      out.push(action);
    }
  }

  return out;
};
