import {
  buildSyntheticHarnessScenario,
  runCopytradeConcurrencyHarness,
} from '../services/copytrade-v2/runtime/copytradeConcurrencyHarness.js';

function parseNumberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return fallback;
  const parsed = Number(arg.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseChainsFlag(): number[] | undefined {
  const prefix = '--chains=';
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return undefined;
  const chains = arg.slice(prefix.length)
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return chains.length > 0 ? chains : undefined;
}

async function main(): Promise<void> {
  const scenario = buildSyntheticHarnessScenario({
    users: parseNumberFlag('users', 20),
    ordersPerUser: parseNumberFlag('ordersPerUser', 8),
    seed: parseNumberFlag('seed', 42),
    baseSpacingMs: parseNumberFlag('baseSpacingMs', 15),
    chains: parseChainsFlag(),
  });

  const summary = await runCopytradeConcurrencyHarness(scenario);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
