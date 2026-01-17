import * as dotenv from 'dotenv';
dotenv.config();

import {
  CreateCopyTradeConfigTool,
  ListCopyTradeConfigsTool,
  PauseCopyTradeConfigTool,
  DeleteCopyTradeConfigTool,
} from '../skills/CopyTradeSkill/tools/copyTradeTools.js';

async function run() {
  const results: Record<string, any> = {};
  const context = {
    userId: 'demo-user-copy',
    walletAddress: '0x000000000000000000000000000000000000dead',
  };
  const targetWallet = '0x1111111111111111111111111111111111111111';

  try {
    results.create_copy_trade_config = await CreateCopyTradeConfigTool.handler(
      { target_wallet: targetWallet, buy_amount_usd: 5 },
      context
    );
  } catch (e: any) {
    results.create_copy_trade_config = { error: e.message || String(e) };
  }

  try {
    results.list_copy_trade_configs = await ListCopyTradeConfigsTool.handler({}, context);
  } catch (e: any) {
    results.list_copy_trade_configs = { error: e.message || String(e) };
  }

  try {
    results.pause_copy_trade_config = await PauseCopyTradeConfigTool.handler(
      { target_wallet: targetWallet, action: 'pause' },
      context
    );
  } catch (e: any) {
    results.pause_copy_trade_config = { error: e.message || String(e) };
  }

  try {
    results.delete_copy_trade_config = await DeleteCopyTradeConfigTool.handler(
      { target_wallet: targetWallet },
      context
    );
  } catch (e: any) {
    results.delete_copy_trade_config = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('CopyTradeSkill test failed:', e);
  process.exit(1);
});
