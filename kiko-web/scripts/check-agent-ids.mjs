import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const exts = new Set(['.ts', '.tsx']);

const files = [];
const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    if (exts.has(path.extname(ent.name))) files.push(full);
  }
};

walk(root);

const occurrences = new Map();
const literalRegex = /data-agent-id\s*=\s*["']([^"']+)["']/g;
const helperRegex = /agentAttrs\(\s*\{[\s\S]*?id:\s*["']([^"']+)["']/g;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');

  for (const regex of [literalRegex, helperRegex]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const id = match[1];
      if (!occurrences.has(id)) occurrences.set(id, []);
      occurrences.get(id).push(path.relative(process.cwd(), file));
    }
  }
}

const duplicates = [...occurrences.entries()].filter(([, paths]) => paths.length > 1);

if (duplicates.length > 0) {
  console.error('Duplicate data-agent-id values found:');
  for (const [id, paths] of duplicates) {
    console.error(`- ${id}`);
    for (const p of paths) {
      console.error(`  - ${p}`);
    }
  }
  process.exit(1);
}

console.log(`Agent id check passed. Scanned ${files.length} files, found ${occurrences.size} explicit ids.`);
