import * as dotenv from 'dotenv';
dotenv.config();

import { SimulateSwapTool } from '../skills/SwapSkill/tools/simulateSwap.js';
import { PrepareSwapTransactionTool } from '../skills/SwapSkill/tools/prepareSwap.js';

async function run() {
  const results: Record<string, any> = {};

  try {
    const simulate = await SimulateSwapTool.handler(
      {
        token_in: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC (Base)
        token_out: '0x4200000000000000000000000000000000000006', // WETH (Base)
        amount_in: '10',
        chain_id: 8453,
        slippage: 0.5,
      },
      { accessToken: process.env.TEST_ACCESS_TOKEN }
    );
    results.simulate_swap = simulate;
  } catch (e: any) {
    results.simulate_swap = { error: e.message || String(e) };
  }

  try {
    const prepare = await PrepareSwapTransactionTool.handler(
      {
        token_in: 'USDC',
        token_out: 'ETH',
        amount_in: '10',
        chain_id: 8453,
        slippage: 0.5,
        execute: false,
      },
      {
        toolConfig: { swapMethod: 'confirm' },
      }
    );
    results.prepare_swap_transaction = prepare;
  } catch (e: any) {
    results.prepare_swap_transaction = { error: e.message || String(e) };
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('SwapSkill test failed:', e);
  process.exit(1);
});
