import assert from 'node:assert/strict';
import test from 'node:test';

import { __testables } from '../polymarket.js';
import { computePositionDeltaRatio } from '../polymarketExecutor.js';

test('parseMarket maps outcomes to concrete token ids and orderbook metadata', () => {
  const market = __testables.parseMarket({
    id: '1548069',
    question: 'Bitcoin Up or Down - March 11, 1:00AM-1:05AM ET',
    conditionId: '0xcondition',
    slug: 'btc-updown-5m',
    outcomes: '["Up","Down"]',
    clobTokenIds: '["token-up","token-down"]',
    outcomePrices: '["0.505","0.495"]',
    volume: '2',
    volume24hr: 2,
    liquidity: '20033.2442',
    endDate: '2026-03-11T05:05:00Z',
    closed: false,
    acceptingOrders: true,
    bestBid: 0.5,
    bestAsk: 0.51,
    negRisk: false,
    enableOrderBook: true,
    orderPriceMinTickSize: 0.01
  });

  assert.deepEqual(market.outcomes, [
    {
      name: 'Up',
      price: 0.505,
      probability: '50.5%',
      tokenId: 'token-up'
    },
    {
      name: 'Down',
      price: 0.495,
      probability: '49.5%',
      tokenId: 'token-down'
    }
  ]);
  assert.equal(market.conditionId, '0xcondition');
  assert.equal(market.slug, 'btc-updown-5m');
  assert.equal(market.acceptingOrders, true);
  assert.equal(market.bestBid, 0.5);
  assert.equal(market.bestAsk, 0.51);
  assert.equal(market.tickSize, 0.01);
  assert.equal(market.negRisk, false);
  assert.equal(market.enableOrderBook, true);
});

test('parseMarket tolerates missing token ids without fabricating them', () => {
  const market = __testables.parseMarket({
    id: 'abc',
    question: 'Will X happen?',
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.2","0.8"]',
    volume: '0',
    volume24hr: 0,
    liquidity: '0',
    endDate: '2026-03-11T05:05:00Z',
    closed: false
  });

  assert.equal(market.outcomes[0].tokenId, null);
  assert.equal(market.outcomes[1].tokenId, null);
  assert.equal(market.yesProbability, '20.0%');
  assert.equal(market.noProbability, '80.0%');
});

test('parseMarket tolerates missing endDate from Gamma payloads', () => {
  const market = __testables.parseMarket({
    id: 'missing-date',
    question: 'Will X happen?',
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.2","0.8"]',
    volume: '0',
    volume24hr: 0,
    liquidity: '0',
    closed: false
  });

  assert.equal(market.endDate, null);
});

test('normalizeDate returns null for blank or missing timestamps', () => {
  assert.equal(__testables.normalizeDate(undefined), null);
  assert.equal(__testables.normalizeDate(''), null);
  assert.equal(__testables.normalizeDate('   '), null);
  assert.equal(__testables.normalizeDate('2026-03-15T00:00:00Z'), '2026-03-15T00:00:00Z');
});

test('normalizeSearchEvents accepts both events and results payload shapes', () => {
  assert.deepEqual(
    __testables.normalizeSearchEvents({ events: [{ id: 1 }, { id: 2 }] }),
    [{ id: 1 }, { id: 2 }],
  );
  assert.deepEqual(
    __testables.normalizeSearchEvents({ results: [{ id: 3 }] }),
    [{ id: 3 }],
  );
  assert.deepEqual(__testables.normalizeSearchEvents({}), []);
});

test('buildExactFiveMinuteWindowQuery builds the current ET window title deterministically', () => {
  const start = new Date('2026-03-25T03:00:00Z'); // 11:00PM ET on March 24
  assert.equal(
    __testables.buildExactFiveMinuteWindowQuery({ coin: 'Solana', start }),
    'Solana Up or Down - March 24, 11:00PM-11:05PM ET',
  );
});

test('computePositionDeltaRatio returns proportional changes for mirrored sizing', () => {
  assert.equal(computePositionDeltaRatio({
    type: 'INCREASED',
    previousSize: 100,
    currentSize: 150,
  }), 0.5);

  assert.equal(computePositionDeltaRatio({
    type: 'DECREASED',
    previousSize: 200,
    currentSize: 50,
  }), 0.75);

  assert.equal(computePositionDeltaRatio({
    type: 'OPENED',
    previousSize: 0,
    currentSize: 50,
  }), null);

  assert.equal(computePositionDeltaRatio({
    type: 'DECREASED',
    previousSize: 0,
    currentSize: 50,
  }), null);
});

test('parseMarketWindowLabel recognizes upcoming and live short-window markets in ET', () => {
  const now = new Date('2026-03-24T08:58:00Z');

  const upcoming = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 24, 5:00AM-5:05AM ET',
    now
  );
  const live = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 24, 4:45AM-5:00AM ET',
    now
  );
  const abbreviated = __testables.parseMarketWindowLabel(
    'Bitcoin Up or Down - March 24, 6:55-7AM ET',
    now
  );
  const abbreviatedPm = __testables.parseMarketWindowLabel(
    'Bitcoin Up or Down - March 24, 6-7PM ET',
    now
  );

  assert.equal(upcoming?.status, 'upcoming');
  assert.equal(upcoming?.secondsToStart, 120);
  assert.equal(upcoming?.secondsToEnd, 420);
  assert.equal(live?.status, 'live');
  assert.equal(live?.secondsToEnd, 120);
  
  assert.ok(abbreviated);
  assert.equal(abbreviated.status, 'upcoming');
  
  assert.ok(abbreviatedPm);
  assert.equal(abbreviatedPm.status, 'upcoming');
});

test('compareNewMarketPriority prefers the next starting window over the near-expiry live window', () => {
  const now = new Date('2026-03-24T08:58:00Z');

  const upcoming = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 24, 5:00AM-5:05AM ET',
    now
  );
  const live = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 24, 4:45AM-5:00AM ET',
    now
  );
  const expired = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 24, 4:30AM-4:35AM ET',
    now
  );

  assert.ok(upcoming && live && expired);
  assert.ok(__testables.compareNewMarketPriority(upcoming, live) < 0);
  assert.ok(__testables.compareNewMarketPriority(live, expired) < 0);
  assert.ok(__testables.compareNewMarketPriority(expired, null) < 0);
});

test('isEligibleNewMarketWindow includes tomorrow windows (48h horizon) and excludes near-expiry live windows', () => {
  const now = new Date('2026-03-24T08:58:00Z');

  // March 25, ~24h away -> now eligible under 48h discovery horizon
  const tomorrowWindow = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 25, 5:25AM-5:30AM ET',
    now
  );
  // Near expiry live (< 2min remaining) -> still excluded
  const nearExpiryLive = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 24, 4:45AM-5:00AM ET',
    new Date('2026-03-24T08:59:15Z')
  );
  // Upcoming in a few minutes -> eligible
  const soonUpcoming = __testables.parseMarketWindowLabel(
    'Ethereum Up or Down - March 24, 5:00AM-5:05AM ET',
    now
  );

  assert.equal(__testables.isEligibleNewMarketWindow(tomorrowWindow), true); // within 48h horizon
  assert.equal(__testables.isEligibleNewMarketWindow(nearExpiryLive), false); // near expiry still excluded
  assert.equal(__testables.isEligibleNewMarketWindow(soonUpcoming), true);
});
