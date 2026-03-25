import assert from 'node:assert/strict';
import test from 'node:test';

import { __testables } from './polymarketTools.js';

test('formatDateLabel truncates ISO timestamps for display', () => {
  assert.equal(__testables.formatDateLabel('2026-03-15T08:09:10Z'), '2026-03-15');
});

test('formatDateLabel returns null for missing timestamps', () => {
  assert.equal(__testables.formatDateLabel(undefined), null);
  assert.equal(__testables.formatDateLabel(''), null);
  assert.equal(__testables.formatDateLabel('   '), null);
});

test('buildPolymarketMarketOverview groups hot, new, and tradable buckets', () => {
  const overview = __testables.buildPolymarketMarketOverview({
    now: new Date('2026-03-24T08:58:00Z'),
    trendingEvents: {
      events: [
        {
          id: 'event-1',
          title: 'Will BTC hit 100k?',
          volume: 125000,
          liquidity: 42000,
          endDate: '2026-03-24T12:00:00Z',
        },
      ],
    } as any,
    trendingMarkets: {
      markets: [
        {
          id: 'market-1',
          slug: 'btc-100k',
          conditionId: '0xcond',
          question: 'Will BTC hit 100k by Friday?',
          yesProbability: '52.0%',
          noProbability: '48.0%',
          volume24hr: 90000,
          liquidity: 18000,
          endDate: '2026-03-24T12:00:00Z',
          acceptingOrders: true,
          bestBid: 0.51,
          bestAsk: 0.52,
          tickSize: 0.01,
          negRisk: false,
          enableOrderBook: true,
          outcomes: [
            { name: 'Yes', probability: '52.0%', tokenId: 'yes-token' },
            { name: 'No', probability: '48.0%', tokenId: 'no-token' },
          ],
        },
      ],
    } as any,
    newMarkets: {
      eligibleWindowCount: 2,
      tradableWindowCount: 1,
      selectionNote: '1 market(s) are tradable now.',
      events: [
        {
          id: 'new-1',
          title: 'Solana Up or Down - March 24, 5:00AM-5:05AM ET',
          creationDate: '2026-03-24T08:55:00Z',
          liquidity: 2500,
          tradable: true,
          tradable_detail: 'ok',
          recommendedWindow: {
            startAt: '2026-03-24T09:00:00Z',
            endAt: '2026-03-24T09:05:00Z',
            status: 'upcoming',
            secondsToStart: 120,
            secondsToEnd: 420,
            durationMinutes: 5,
            label: '2026-03-24',
          },
          markets: [
            {
              id: 'm-1',
              slug: 'sol-up',
              conditionId: '0xsol',
              question: 'Solana Up or Down - March 24, 5:00AM-5:05AM ET',
              acceptingOrders: true,
              bestBid: 0.49,
              bestAsk: 0.51,
              tickSize: 0.01,
              negRisk: false,
              enableOrderBook: true,
              outcomes: [
                { name: 'Up', probability: '50.0%', tokenId: 'up-token' },
                { name: 'Down', probability: '50.0%', tokenId: 'down-token' },
              ],
            },
          ],
        },
      ],
    } as any,
  });

  assert.equal(overview.type, 'Market Overview');
  assert.equal(overview.buckets.hot_24h_events.count, 1);
  assert.equal(overview.buckets.hot_24h_markets.count, 1);
  assert.equal(overview.buckets.newest_short_window.count, 1);
  assert.equal(overview.buckets.tradable_now.count, 1);
  assert.equal(overview.buckets.tradable_now.markets[0].id, 'new-1');
  assert.equal(overview.buckets.newest_short_window.events[0].tradable, true);
  assert.equal(overview.recommended_card?.market_slug, 'sol-up');
});
