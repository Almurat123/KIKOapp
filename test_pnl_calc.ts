// Simulation of autoTradeService:2815 calculation bug
const sellVolUsd = 78037382463.91286;
const openPositions = [
  { id: 1, entryUsdValue: 25 }, // example
];

for (const pos of openPositions) {
  const realizedPnlUsd = sellVolUsd - (pos.entryUsdValue || 0);
  console.log(`Position ${pos.id} ExitUSD: ${sellVolUsd} RealizedPNL: ${realizedPnlUsd}`);
}
