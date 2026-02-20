/**
 * Check on-chain status of an EVM transaction (receipt + tx details).
 * Uses project RPC config. Run: npx tsx src/scripts/checkTxOnChain.ts <chainId> <txHash>
 *
 * Example: npx tsx src/scripts/checkTxOnChain.ts 8453 0xabc...
 */

import { getTransactionReceipt, getTransactionByHash } from '../services/rpcManager.js';
import { getChainConfig } from '../config/chainConfig.js';

const chainId = parseInt(process.argv[2] || '0', 10);
const txHash = (process.argv[3] || '').trim();

if (!chainId || !txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
  console.error('Usage: npx tsx src/scripts/checkTxOnChain.ts <chainId> <txHash>');
  console.error('Example: npx tsx src/scripts/checkTxOnChain.ts 8453 0x...');
  process.exit(1);
}

const chainName = getChainConfig(chainId)?.name || `chain ${chainId}`;

async function main() {
  console.log(`\n🔍 Checking tx on ${chainName} (${chainId})\n  ${txHash}\n`);

  let tx: any = null;
  let receipt: any = null;

  try {
    [tx, receipt] = await Promise.all([
      getTransactionByHash(chainId, txHash),
      getTransactionReceipt(chainId, txHash)
    ]);
  } catch (e: any) {
    console.error('RPC error:', e?.message || e);
    process.exit(2);
  }

  if (!tx && !receipt) {
    console.log('❌ Transaction NOT FOUND on chain.');
    console.log('   Possible reasons: not broadcast, wrong chain, or not mined yet.');
    process.exit(3);
  }

  if (tx) {
    console.log('📄 Transaction (eth_getTransactionByHash):');
    console.log('   from:    ', tx.from);
    console.log('   to:      ', tx.to);
    console.log('   value:   ', tx.value);
    console.log('   block:   ', tx.blockNumber ?? 'pending');
    console.log('   gasLimit:', tx.gas);
    console.log('   nonce:   ', tx.nonce);
  }

  if (receipt) {
    const statusRaw = receipt.status;
    const status = typeof statusRaw === 'string'
      ? (statusRaw === '0x1' ? 1 : 0)
      : Number(receipt.status);
    const success = status === 1;

    console.log('\n📋 Receipt (eth_getTransactionReceipt):');
    console.log('   status:     ', success ? '✅ SUCCESS (1)' : '❌ REVERTED (0)');
    console.log('   blockNumber:', receipt.blockNumber);
    console.log('   gasUsed:    ', receipt.gasUsed);
    console.log('   logs:       ', Array.isArray(receipt.logs) ? receipt.logs.length : 0);

    if (!success) {
      console.log('\n⚠️  Transaction reverted on-chain. No state change applied.');
    }
  } else {
    console.log('\n📋 Receipt: not yet available (tx may be pending or not broadcast).');
  }

  console.log('');
}

main();
