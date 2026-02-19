import test from 'node:test';
import assert from 'node:assert/strict';
import { determineCopyTradeDirection } from './copyTradeDirection.js';

const BASE_CHAIN_ID = 8453;
const ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TOKEN_A = '0x1111111111111111111111111111111111111111';
const TOKEN_B = '0x2222222222222222222222222222222222222222';

test('determineCopyTradeDirection marks cash->token as buy', () => {
  const direction = determineCopyTradeDirection({
    chainId: BASE_CHAIN_ID,
    tokenIn: ETH,
    tokenOut: TOKEN_A
  });

  assert.equal(direction.isBuy, true);
  assert.equal(direction.isSell, false);
  assert.equal(direction.isTokenToToken, false);
  assert.equal(direction.source, 'token_pair');
});

test('determineCopyTradeDirection marks token->cash as sell', () => {
  const direction = determineCopyTradeDirection({
    chainId: BASE_CHAIN_ID,
    tokenIn: TOKEN_A,
    tokenOut: USDC
  });

  assert.equal(direction.isBuy, false);
  assert.equal(direction.isSell, true);
  assert.equal(direction.isTokenToToken, false);
  assert.equal(direction.source, 'token_pair');
});

test('determineCopyTradeDirection uses cash hint override when token pair is ambiguous', () => {
  const direction = determineCopyTradeDirection({
    chainId: BASE_CHAIN_ID,
    tokenIn: TOKEN_A,
    tokenOut: TOKEN_B,
    cashLegHint: {
      inferredTxType: 'TARGET_BUY',
      cashSpentUsd: 100
    }
  });

  assert.equal(direction.isBuy, true);
  assert.equal(direction.isSell, false);
  assert.equal(direction.isTokenToToken, false);
  assert.equal(direction.source, 'cash_hint');
});

test('determineCopyTradeDirection keeps token-to-token when no hint is present', () => {
  const direction = determineCopyTradeDirection({
    chainId: BASE_CHAIN_ID,
    tokenIn: TOKEN_A,
    tokenOut: TOKEN_B
  });

  assert.equal(direction.isBuy, false);
  assert.equal(direction.isSell, false);
  assert.equal(direction.isTokenToToken, true);
  assert.equal(direction.source, 'token_pair');
});

test('determineCopyTradeDirection infers buy from cash flow when inferredTxType is missing', () => {
  const direction = determineCopyTradeDirection({
    chainId: BASE_CHAIN_ID,
    tokenIn: TOKEN_A,
    tokenOut: TOKEN_B,
    cashLegHint: {
      cashSpentUsd: 120,
      cashReceivedUsd: 2
    }
  });

  assert.equal(direction.isBuy, true);
  assert.equal(direction.isSell, false);
  assert.equal(direction.isTokenToToken, false);
  assert.equal(direction.source, 'cash_hint');
  assert.equal(direction.inferredTxType, 'TARGET_BUY');
});

test('determineCopyTradeDirection infers sell from cash flow when inferredTxType is TARGET_TOKEN_SWAP', () => {
  const direction = determineCopyTradeDirection({
    chainId: BASE_CHAIN_ID,
    tokenIn: TOKEN_A,
    tokenOut: TOKEN_B,
    cashLegHint: {
      inferredTxType: 'TARGET_TOKEN_SWAP',
      cashSpentUsd: 1,
      cashReceivedUsd: 95
    }
  });

  assert.equal(direction.isBuy, false);
  assert.equal(direction.isSell, true);
  assert.equal(direction.isTokenToToken, false);
  assert.equal(direction.source, 'cash_hint');
  assert.equal(direction.inferredTxType, 'TARGET_SELL');
});
