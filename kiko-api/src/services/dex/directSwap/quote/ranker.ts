import type { StrategyQuoteEstimate, TurboCandidateQuote } from './types.js';

function sortByQuotedOutDesc<T extends { quotedOut: bigint }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.quotedOut === b.item.quotedOut) return a.index - b.index;
      return a.item.quotedOut > b.item.quotedOut ? -1 : 1;
    })
    .map((entry) => entry.item);
}

export function rankStrategyQuotes(quotes: StrategyQuoteEstimate[]): StrategyQuoteEstimate[] {
  const positive = quotes.filter((quote) => quote.quotedOut > 0n);
  const nonPositive = quotes.filter((quote) => quote.quotedOut <= 0n);
  return [...sortByQuotedOutDesc(positive), ...nonPositive];
}

export function rankTurboCandidateQuotes(quotes: TurboCandidateQuote[]): TurboCandidateQuote[] {
  const positive = quotes.filter((quote) => quote.quotedOut > 0n);
  const nonPositive = quotes.filter((quote) => quote.quotedOut <= 0n);
  return [...sortByQuotedOutDesc(positive), ...nonPositive];
}
