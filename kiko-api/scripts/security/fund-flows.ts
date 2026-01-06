/**
 * Fund flow tracing (local-only).
 * Input: adjacency edges JSON (from explorer/export) or runtime-collected tx edges.
 * Output: multi-hop paths with mixer/exchange labels to /tmp/kiko-security/fund-flows.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { OUTPUT_DIR, OUTPUT_FLOWS, chainConfigs } from './config/rules.js';

interface Edge {
  from: string;
  to: string;
  amount?: string;
  txHash?: string;
  chain?: string;
  labels?: string[];
}

interface FlowResult {
  path: string[];
  chain?: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  evidence?: Record<string, unknown>;
}

const INPUT = process.env.SECURITY_FLOWS_INPUT || 'data/flows.json';
const MAX_HOPS = Number(process.env.SECURITY_FLOWS_MAX_HOPS || 4);

function loadEdges(): Edge[] {
  if (!existsSync(INPUT)) return [];
  const raw = readFileSync(INPUT, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Edge[];
    if (Array.isArray(parsed.edges)) return parsed.edges as Edge[];
  } catch {
    return [];
  }
  return [];
}

function isMixerOrExchange(labels: string[] = []): boolean {
  return labels.some(l => /mixer|tornado|exchange/i.test(l));
}

function bfs(edges: Edge[]): FlowResult[] {
  const adj = new Map<string, Edge[]>();
  edges.forEach(e => {
    const from = e.from.toLowerCase();
    const to = e.to.toLowerCase();

    // Simple filter: self-loops
    if (from === to) return;

    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(e);
  });

  const results: FlowResult[] = [];
  const visitedPaths = new Set<string>(); // Dedup results

  for (const start of adj.keys()) {
    // BFS State: { path: [nodes], visited: Set<nodes>, lastEdge: edge }
    const queue: { path: string[]; visited: Set<string>; lastEdge?: Edge }[] = [
      { path: [start], visited: new Set([start]) }
    ];

    while (queue.length > 0) {
      const { path, visited, lastEdge } = queue.shift()!;
      const node = path[path.length - 1]; // Current tail
      const edgesFrom = adj.get(node) || [];

      // Determine risk of current path ending
      const isHighRisk = lastEdge && isMixerOrExchange(lastEdge.labels);
      const isTerminal = edgesFrom.length === 0;
      const isMaxDepth = path.length >= MAX_HOPS + 1;

      // Save path IF it's interesting: High Risk OR Terminal node
      if ((isHighRisk || isTerminal || isMaxDepth) && path.length > 1) {
        const pathSig = path.join('->');
        if (!visitedPaths.has(pathSig)) {
          visitedPaths.add(pathSig);

          const riskLabel = isHighRisk
            ? 'critical'
            : (lastEdge?.labels?.length ? 'high' : 'medium');

          results.push({
            path,
            chain: lastEdge?.chain,
            risk: riskLabel as FlowResult['risk'],
            reason: lastEdge?.labels?.join(', ') || (isTerminal ? 'terminal wallet' : 'max hops'),
            evidence: {
              txHash: lastEdge?.txHash,
              amount: lastEdge?.amount,
              hops: path.length - 1
            },
          });
        }
      }

      // Stop exploring this branch if max depth or high risk (critical end)
      if (isMaxDepth || isHighRisk) continue;

      for (const e of edgesFrom) {
        const next = e.to.toLowerCase();
        if (visited.has(next)) continue; // Cycle detection O(1)

        const newVisited = new Set(visited);
        newVisited.add(next);

        queue.push({
          path: [...path, next],
          visited: newVisited,
          lastEdge: e
        });
      }
    }
  }
  return results;
}

function writeOutput(flows: FlowResult[]) {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FLOWS, JSON.stringify({ flows }, null, 2), 'utf8');
}

function main() {
  const edges = loadEdges();
  if (edges.length === 0) {
    writeOutput([]);
    return;
  }
  const flows = bfs(edges);
  writeOutput(flows);
}

main();

