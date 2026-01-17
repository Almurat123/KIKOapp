import * as dotenv from 'dotenv';
dotenv.config();

import { GetWalletInfoTool } from '../skills/WalletSkill/tools/walletInfo.js';
import { AnalyzeWalletPnlTool } from '../skills/WalletSkill/tools/dunePnlTools.js';
import { GetUserFavoritesTool } from '../skills/WalletSkill/tools/userFavorites.js';

async function run() {
  const results: Record<string, any> = {};
  const testWallet = '0x00000000219ab540356cBB839Cbe05303d7705Fa';

  try {
    results.get_wallet_info = await GetWalletInfoTool.handler({ address: testWallet, chain: 'eth' }, {});
  } catch (e: any) {
    results.get_wallet_info = { error: e.message || String(e) };
  }

  try {
    results.analyze_wallet_pnl = await AnalyzeWalletPnlTool.handler({ address: testWallet, chain: 'ethereum', days: 30 }, {});
  } catch (e: any) {
    results.analyze_wallet_pnl = { error: e.message || String(e) };
  }

  try {
    results.get_user_favorites = await GetUserFavoritesTool.handler({}, { userId: 'demo-user' });
  } catch (e: any) {
    results.get_user_favorites = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('WalletSkill test failed:', e);
  process.exit(1);
});
