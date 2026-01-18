import 'dotenv/config';
import { GetWalletInfoTool } from '../src/tools/walletInfo.js';

const DEFAULT_ADDRESS = '0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b';
const rawArgs = process.argv.slice(2);
const addressFlagIndex = rawArgs.findIndex(arg => arg === '--address' || arg === '-a');
const addressFromFlag = addressFlagIndex >= 0 ? rawArgs[addressFlagIndex + 1] : undefined;
const ADDRESS = addressFromFlag || DEFAULT_ADDRESS;
const CHAINS = rawArgs
  .filter((arg, index) => index !== addressFlagIndex && index !== addressFlagIndex + 1)
  .filter(arg => !arg.startsWith('-'))
  .map(arg => arg.toLowerCase());
const TARGET_CHAINS = CHAINS.length ? CHAINS : ['eth', 'base', 'bsc'];

async function fetchForChain(chain: string) {
  const chainIdMap: Record<string, number> = {
    eth: 1,
    base: 8453,
    bsc: 56,
  };
  const context = { userAddress: ADDRESS, chainId: chainIdMap[chain] || 1 };
  const result = await GetWalletInfoTool.handler(
    { address: ADDRESS, chain, includeHistory: false },
    context
  );

  console.log(`\n--- ${chain.toUpperCase()} ---`);

  if ('error' in result) {
    console.error('Wallet info call failed:', result.error);
    return;
  }

  console.log(`Native balance: ${result.ethBalance}`);
  if (typeof result.nativeValueUsd === 'number') {
    console.log(`Native value (USD): $${result.nativeValueUsd.toFixed(2)}`);
  }

  if (Array.isArray(result.tokens) && result.tokens.length > 0) {
    console.log('Tokens:');
    result.tokens.forEach(token => {
      const valueUsd = token.valueUsd ? ` ~$${token.valueUsd.toFixed(2)}` : '';
      console.log(
        ` - ${token.symbol || 'UNKNOWN'}: ${token.balance || token.tokenBalance || '0'} ${
          token.contract ? `(${token.contract})` : ''
        }${valueUsd}`
      );
    });
  } else {
    console.log('No token balances returned.');
  }
}

async function main() {
  for (const chain of TARGET_CHAINS) {
    await fetchForChain(chain);
  }
}

main().catch(error => {
  console.error('Unexpected error while fetching wallet info:', error);
  process.exitCode = 1;
});
