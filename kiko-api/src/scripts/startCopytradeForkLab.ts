import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import {
  buildAnvilArgs,
  buildCopytradeForkLabEnv,
  DEFAULT_FORK_LAB_PRIVATE_KEY,
  resolveCopytradeForkLabTargets,
  formatShellExports,
} from '../services/copytrade-v2/runtime/copytradeForkLab.js';

type ScriptOptions = {
  chains?: number[];
  basePort?: number;
  dryRun: boolean;
  exitAfterReady: boolean;
  accounts: number;
  balance: number;
  json: boolean;
};

function parseNumberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  if (!value) return fallback;
  const parsed = Number(value.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseChains(): number[] | undefined {
  const prefix = '--chains=';
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  if (!value) return undefined;
  const parsed = value.slice(prefix.length)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return parsed.length > 0 ? parsed : undefined;
}

function parseOptions(): ScriptOptions {
  return {
    chains: parseChains(),
    basePort: parseNumberFlag('basePort', 9545),
    dryRun: hasFlag('dry-run'),
    exitAfterReady: hasFlag('exit-after-ready'),
    accounts: parseNumberFlag('accounts', 20),
    balance: parseNumberFlag('balance', 1000000),
    json: hasFlag('json'),
  };
}

async function waitForRpcReady(rpcUrl: string, expectedChainId: number, timeoutMs: number = 15000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        }),
      });
      if (!response.ok) throw new Error(`rpc_http_${response.status}`);
      const payload = await response.json();
      const chainIdHex = String(payload?.result || '');
      if (chainIdHex && Number.parseInt(chainIdHex, 16) === expectedChainId) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Anvil fork on chain ${expectedChainId}`);
}

function attachPrefixedLogs(child: ChildProcessByStdio<null, Readable, Readable>, prefix: string): void {
  const bind = (stream: NodeJS.ReadableStream, printer: (line: string) => void) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += String(chunk);
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        if (line) printer(`[${prefix}] ${line}`);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    });
  };
  bind(child.stdout, (line) => console.log(line));
  bind(child.stderr, (line) => console.error(line));
}

async function main(): Promise<void> {
  const options = parseOptions();
  const targets = resolveCopytradeForkLabTargets({
    chains: options.chains,
    basePort: options.basePort,
  });
  const env = buildCopytradeForkLabEnv(targets, DEFAULT_FORK_LAB_PRIVATE_KEY);

  if (options.dryRun) {
    const payload = {
      mode: 'dry-run',
      targets: targets.map((target) => ({
        ...target,
        anvilArgs: buildAnvilArgs(target, {
          accounts: options.accounts,
          balance: options.balance,
        }),
      })),
      env,
      shellExports: formatShellExports(env),
    };
    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const children: Array<ChildProcessByStdio<null, Readable, Readable>> = [];
  const cleanup = () => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  for (const target of targets) {
    const args = buildAnvilArgs(target, {
      accounts: options.accounts,
      balance: options.balance,
    });
    const child = spawn('anvil', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    attachPrefixedLogs(child, `${target.label}:${target.chainId}`);
    children.push(child);
  }

  await Promise.all(targets.map((target) => waitForRpcReady(target.localRpcUrl, target.chainId)));

  const payload = {
    mode: options.exitAfterReady ? 'ready-exit' : 'running',
    targets,
    env,
    shellExports: formatShellExports(env),
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }

  if (options.exitAfterReady) {
    cleanup();
    return;
  }

  await new Promise(() => {
    // Keep process alive until interrupted.
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
