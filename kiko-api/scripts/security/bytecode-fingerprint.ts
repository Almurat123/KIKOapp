/**
 * Batch bytecode + storage fingerprint (local-only).
 * Input: SECURITY_TARGETS (comma-separated addresses) and RPC per chain.
 * Output: /tmp/kiko-security/fingerprints.jsonl
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { JsonRpcProvider } from 'ethers';
import { OUTPUT_DIR, OUTPUT_FINGERPRINTS, chainConfigs, getRpc } from './config/rules.js';

const TARGETS = (process.env.SECURITY_TARGETS || '').split(',').map(t => t.trim()).filter(Boolean);
const STORAGE_SLOTS = Number(process.env.SECURITY_STORAGE_SLOTS || 5);

interface Fingerprint {
  chain: string;
  address: string;
  bytecodeSize: number;
  selectors: string[];
  selectorsHit: Record<string, boolean>;
  storageSample: { slot: number; value: string }[];
}

const riskySelectors: Record<string, string> = {
  mint: '0x40c10f19',
  burn: '0x9dc29fac',
  selfdestruct: '0x83197ef0',
  delegatecall: '0x4c60f3d4',
  upgradeTo: '0x3659cfe6',
  blacklist: '0x4b5c4271',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sampleStorage(provider: JsonRpcProvider, address: string): Promise<{ slot: number; value: string }[]> {
  const res: { slot: number; value: string }[] = [];
  try {
    for (let i = 0; i < STORAGE_SLOTS; i++) {
      const v = await provider.getStorage(address, i);
      res.push({ slot: i, value: v });
    }
  } catch (e: any) {
    console.error(`[Storage] Failed to read storage for ${address}: ${e.message}`);
  }
  return res;
}

async function processOne(chain: string, address: string, rateLimitMs: number) {
  const rpc = getRpc(chain);
  if (!rpc) return;

  // Skip non-EVM chains (simple check, or use config flag if added)
  if (chain === 'solana') return;

  try {
    const provider = new JsonRpcProvider(rpc);
    const bytecode = await provider.getCode(address);
    if (!bytecode || bytecode === '0x') return;

    // Fix: Size is (hexString.length - 2) / 2
    const bytecodeSize = (bytecode.length - 2) / 2;

    // Fix: Extract selectors using PUSH4 opcode (0x63)
    // Regex looks for 63 followed by 8 hex chars
    const selectorMatches = bytecode.matchAll(/63([0-9a-fA-F]{8})/g);
    const selectors = [...selectorMatches].map(m => '0x' + m[1]);

    // Deduplicate and limit
    const uniqueSelectors = [...new Set(selectors)].slice(0, 200);

    const selectorsHit: Record<string, boolean> = {};
    Object.entries(riskySelectors).forEach(([k, sig]) => {
      selectorsHit[k] = uniqueSelectors.includes(sig);
    });

    const storageSample = await sampleStorage(provider, address);

    const fp: Fingerprint = {
      chain,
      address,
      bytecodeSize,
      selectors: uniqueSelectors,
      selectorsHit,
      storageSample,
    };

    if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
    appendFileSync(OUTPUT_FINGERPRINTS, JSON.stringify(fp) + '\n', 'utf8');

    // Rate limit
    if (rateLimitMs > 0) await sleep(rateLimitMs);

  } catch (error: any) {
    console.error(`[Process] Error processing ${chain}:${address} - ${error.message}`);
  }
}

async function main() {
  if (TARGETS.length === 0) return;
  for (const cfg of chainConfigs) {
    for (const addr of TARGETS) {
      await processOne(cfg.chain, addr, cfg.rateLimitMs || 0);
    }
  }
}

main().catch(err => {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  appendFileSync(OUTPUT_FINGERPRINTS, JSON.stringify({ error: err?.message || 'error' }) + '\n');
  process.exitCode = 1;
});

