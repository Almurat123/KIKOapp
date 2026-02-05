import { ethers } from 'ethers';
import { callRpc } from '../services/rpcManager.js';

const DEFAULT_CONTRACT = '0xd422c883527d5f48a63949395074f92f473a1602';
const DEFAULT_TXS = [
  '0x740882ea72a6a7ec3f0ba491b38e9c855b440a2aa94700bcf53fb043de508d7a',
  '0xa399eef0e36005217c191111bea3f150456bb9ee860bd3ea289edfc4e0d0ef41'
];

const POOL_MANAGER_BASE = '0x498581ff718922c3f8e6a244956af099b2652b2b';

const V4_SWAP_TOPIC = ethers.id('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)');
const V4_INIT_TOPIC = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');

const ERC20_SELECTORS: Record<string, string> = {
  '095ea7b3': 'approve(address,uint256)',
  '70a08231': 'balanceOf(address)',
  'a9059cbb': 'transfer(address,uint256)',
  '23b872dd': 'transferFrom(address,address,uint256)',
  '313ce567': 'decimals()',
  '06fdde03': 'name()',
  '95d89b41': 'symbol()',
  '18160ddd': 'totalSupply()'
};

const OWNABLE_SELECTORS: Record<string, string> = {
  '8da5cb5b': 'owner()',
  'f2fde38b': 'transferOwnership(address)',
  '715018a6': 'renounceOwnership()'
};

const EIP1967_IMPL = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_BEACON = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const EIP1967_ADMIN = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

type SelectorInfo = {
  selector: string;
  signatures: string[];
  confidence: 'high' | 'ambiguous' | 'unknown';
  source: string;
};

function toChecksum(addr: string): string {
  return ethers.getAddress(addr);
}

function hexToAddress(hex: string): string | null {
  if (!hex || hex === '0x') return null;
  const clean = hex.replace(/^0x/, '').padStart(64, '0');
  const addr = '0x' + clean.slice(24);
  if (/^0x0{40}$/i.test(addr)) return null;
  return toChecksum(addr);
}

function decodeRevertReason(data?: string): string | null {
  if (!data || data === '0x') return null;
  const selector = data.slice(0, 10).toLowerCase();
  try {
    if (selector === '0x08c379a0') { // Error(string)
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + data.slice(10));
      return decoded[0] as string;
    }
    if (selector === '0x4e487b71') { // Panic(uint256)
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], '0x' + data.slice(10));
      return `Panic(${decoded[0].toString()})`;
    }
  } catch {
    return null;
  }
  return null;
}

function extractSelectors(bytecode: string): string[] {
  const hex = bytecode.replace(/^0x/, '');
  const matches = hex.match(/63[0-9a-fA-F]{8}/g) || [];
  const selectors = new Set(matches.map(m => m.slice(2).toLowerCase()));
  return Array.from(selectors).sort();
}

async function fetch4ByteSignatures(selector: string): Promise<string[]> {
  const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json() as { results?: Array<{ text_signature: string }> };
  const sigs = (json.results || []).map(r => r.text_signature).filter(Boolean);
  return Array.from(new Set(sigs));
}

async function getTx(hash: string) {
  return callRpc<any>(8453, 'eth_getTransactionByHash', [hash]);
}

async function getReceipt(hash: string) {
  return callRpc<any>(8453, 'eth_getTransactionReceipt', [hash]);
}

async function ethCallAt(tx: any) {
  if (!tx) return null;
  const call = {
    from: tx.from,
    to: tx.to,
    data: tx.input,
    value: tx.value
  };
  try {
    const result = await callRpc<string>(8453, 'eth_call', [call, tx.blockNumber]);
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err), data: err?.data };
  }
}

function decodeInputWithSignature(signature: string, input: string): any | null {
  try {
    const iface = new ethers.Interface([`function ${signature}`]);
    const decoded = iface.decodeFunctionData(signature.split('(')[0], input);
    return decoded;
  } catch {
    return null;
  }
}

function decodeV4Logs(logs: any[]) {
  const decoded: any[] = [];
  const swapIface = new ethers.Interface([
    'event Swap(bytes32 indexed poolId,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)'
  ]);
  const initIface = new ethers.Interface([
    'event Initialize(bytes32 indexed poolId,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)'
  ]);

  for (const log of logs) {
    if (!log.topics || !log.topics.length) continue;
    const topic0 = log.topics[0].toLowerCase();
    if (topic0 === V4_SWAP_TOPIC.toLowerCase()) {
      try {
        const parsed = swapIface.parseLog(log);
        if (parsed) {
          decoded.push({ type: 'Swap', address: log.address, args: parsed.args });
        }
      } catch {}
    }
    if (topic0 === V4_INIT_TOPIC.toLowerCase()) {
      try {
        const parsed = initIface.parseLog(log);
        if (parsed) {
          decoded.push({ type: 'Initialize', address: log.address, args: parsed.args });
        }
      } catch {}
    }
  }
  return decoded;
}

async function getStorageAtRange(address: string, start: number, end: number, blockTag: string) {
  const results: Array<{ slot: string; value: string }> = [];
  for (let i = start; i <= end; i++) {
    const slot = ethers.toBeHex(i, 32);
    const value = await callRpc<string>(8453, 'eth_getStorageAt', [address, slot, blockTag]);
    results.push({ slot, value });
  }
  return results;
}

function diffStorage(a: Array<{ slot: string; value: string }>, b: Array<{ slot: string; value: string }>) {
  const mapA = new Map(a.map(x => [x.slot, x.value]));
  const mapB = new Map(b.map(x => [x.slot, x.value]));
  const diffs: Array<{ slot: string; a: string; b: string }> = [];
  for (const slot of mapA.keys()) {
    const va = mapA.get(slot) || '0x';
    const vb = mapB.get(slot) || '0x';
    if (va.toLowerCase() !== vb.toLowerCase()) diffs.push({ slot, a: va, b: vb });
  }
  return diffs;
}

function summarizeCalldata(input: string) {
  const clean = input.startsWith('0x') ? input.slice(2) : input;
  const selector = clean.slice(0, 8);
  const dataLen = (clean.length - 8) / 2;
  return { selector, calldataBytes: dataLen, rawLength: clean.length / 2 };
}

async function main() {
  const contract = (process.argv[2] || DEFAULT_CONTRACT).toLowerCase();
  const txs = process.argv.slice(3);
  const txHashes = txs.length ? txs : DEFAULT_TXS;

  const code = await callRpc<string>(8453, 'eth_getCode', [contract, 'latest']);
  const selectors = extractSelectors(code);

  const selectorInfo: SelectorInfo[] = [];
  for (const sel of selectors) {
    let sigs: string[] = [];
    let confidence: SelectorInfo['confidence'] = 'unknown';
    let source = '4byte';
    if (ERC20_SELECTORS[sel]) {
      sigs = [ERC20_SELECTORS[sel]];
      confidence = 'high';
      source = 'erc20';
    } else if (OWNABLE_SELECTORS[sel]) {
      sigs = [OWNABLE_SELECTORS[sel]];
      confidence = 'high';
      source = 'ownable';
    } else {
      const candidates = await fetch4ByteSignatures(sel);
      sigs = candidates;
      if (candidates.length === 1) confidence = 'high';
      else if (candidates.length > 1) confidence = 'ambiguous';
    }

    selectorInfo.push({ selector: sel, signatures: sigs, confidence, source });
  }

  // proxy check
  const proxySlots: Record<string, string> = {};
  for (const slot of [EIP1967_IMPL, EIP1967_ADMIN, EIP1967_BEACON]) {
    const val = await callRpc<string>(8453, 'eth_getStorageAt', [contract, slot, 'latest']);
    proxySlots[slot] = val;
  }

  // storage scan (0-50)
  const storageScan: Array<{ slot: string; value: string; address?: string }> = [];
  for (let i = 0; i < 50; i++) {
    const slot = ethers.toBeHex(i, 32);
    const val = await callRpc<string>(8453, 'eth_getStorageAt', [contract, slot, 'latest']);
    const addr = hexToAddress(val);
    storageScan.push({ slot, value: val, address: addr || undefined });
  }

  const txReports: any[] = [];
  for (const hash of txHashes) {
    const tx = await getTx(hash);
    const receipt = await getReceipt(hash);
    const calldataSummary = tx?.input ? summarizeCalldata(tx.input) : null;
    let callResult = null;
    if (tx && tx.blockNumber) {
      callResult = await ethCallAt(tx);
    }

    const inputSelector = tx?.input?.slice(2, 10) || '';
    const candidates = selectorInfo.find(s => s.selector === inputSelector)?.signatures || [];
    const decodedCandidates: any[] = [];
    for (const sig of candidates.slice(0, 5)) {
      const decoded = decodeInputWithSignature(sig, tx.input);
      if (decoded) decodedCandidates.push({ signature: sig, decoded });
    }

    const revertReason = decodeRevertReason(callResult?.data);

    const v4Logs = receipt?.logs ? decodeV4Logs(receipt.logs.filter((l: any) => l.address?.toLowerCase() === POOL_MANAGER_BASE.toLowerCase())) : [];

    txReports.push({
      hash,
      status: receipt?.status,
      to: tx?.to,
      from: tx?.from,
      blockNumber: tx?.blockNumber,
      selector: inputSelector,
      calldataSummary,
      selectorCandidates: candidates,
      decodedCandidates,
      callResult,
      revertReason,
      v4Logs
    });
  }

  // storage diff between fail/success blocks (if provided)
  let storageDiff: Array<{ slot: string; a: string; b: string }> = [];
  if (txReports.length >= 2) {
    const fail = txReports[0];
    const succ = txReports[1];
    if (fail.blockNumber && succ.blockNumber) {
      const a = await getStorageAtRange(contract, 0, 50, fail.blockNumber);
      const b = await getStorageAtRange(contract, 0, 50, succ.blockNumber);
      storageDiff = diffStorage(a, b);
    }
  }

  // report
  console.log('=== Reverse Engineering Report ===');
  console.log('Contract:', contract);
  console.log('Bytecode length:', code.length);
  console.log('Proxy slot check:');
  for (const [slot, val] of Object.entries(proxySlots)) {
    console.log(`  ${slot}: ${val} ${hexToAddress(val) ? '(' + hexToAddress(val) + ')' : ''}`);
  }

  console.log('\nSelectors (sample):');
  selectorInfo.slice(0, 20).forEach(s => {
    console.log(`  0x${s.selector} -> ${s.signatures.join(' | ') || 'unknown'} (${s.confidence})`);
  });

  console.log('\nStorage scan (0-10, address-like):');
  storageScan.slice(0, 10).forEach(s => {
    console.log(`  slot ${s.slot}: ${s.value}${s.address ? ' -> ' + s.address : ''}`);
  });

  console.log('\nTx Reports:');
  for (const r of txReports) {
    console.log(`- ${r.hash} status=${r.status} selector=0x${r.selector}`);
    if (r.revertReason) console.log(`  revertReason: ${r.revertReason}`);
    if (r.calldataSummary) console.log(`  calldataBytes: ${r.calldataSummary.calldataBytes}`);
    if (r.decodedCandidates?.length) console.log(`  decodedCandidates: ${r.decodedCandidates.map((d: any) => d.signature).join(', ')}`);
    if (r.v4Logs?.length) console.log(`  v4Logs: ${r.v4Logs.length}`);
  }

  if (storageDiff.length) {
    console.log('\nStorage diff (0-50) between fail/success blocks:');
    storageDiff.forEach(d => console.log(`  ${d.slot}: ${d.a} -> ${d.b}`));
  }

  const output = {
    contract,
    selectors: selectorInfo,
    proxySlots,
    storageScan,
    txReports,
    storageDiff
  };

  console.log('\n=== JSON ===');
  const json = JSON.stringify(output, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
  console.log(json);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
