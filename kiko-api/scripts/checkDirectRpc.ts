import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');

const ALLOWLIST = new Set<string>([
  path.join(SRC_ROOT, 'services', 'rpcManager.ts'),
  path.join(SRC_ROOT, 'config', 'apiEndpoints.ts'),
  path.join(PROJECT_ROOT, 'scripts', 'checkDirectRpc.ts')
]);

const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'JsonRpcProvider', regex: /new\s+JsonRpcProvider\b/ },
  { name: 'Solana Connection', regex: /new\s+Connection\s*\(/ },
  { name: 'Direct RPC URL', regex: /https?:\/\/[^\s'"`]*(?:\brpc\b|\bdrpc\b)[^\s'"`]*/i }
];

function shouldScanFile(filePath: string): boolean {
  if (ALLOWLIST.has(filePath)) return false;
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return false;
  return true;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else if (shouldScanFile(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function scanFile(filePath: string): { line: number; name: string; preview: string }[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const hits: { line: number; name: string; preview: string }[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        hits.push({
          line: i + 1,
          name: pattern.name,
          preview: line.trim()
        });
      }
    }
  }
  return hits;
}

const files = walk(SRC_ROOT);
const violations: { file: string; line: number; name: string; preview: string }[] = [];

for (const file of files) {
  for (const hit of scanFile(file)) {
    violations.push({ file, ...hit });
  }
}

if (violations.length > 0) {
  console.error('[checkDirectRpc] Direct RPC usage detected. Use rpcManager instead.');
  for (const v of violations) {
    const rel = path.relative(PROJECT_ROOT, v.file);
    console.error(`- ${rel}:${v.line} (${v.name}) -> ${v.preview}`);
  }
  process.exit(1);
}

console.log('[checkDirectRpc] OK: no direct RPC usage detected.');
