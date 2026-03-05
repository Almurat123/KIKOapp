import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { PublicKey } from '@solana/web3.js';
import { __pumpSwapExecutorTest } from '../services/solana/direct/pumpswapExecutor.js';

describe('pump swap executor parsing', () => {
  test('decodes v2 pool coin_creator with correct offsets', () => {
    const data = Buffer.alloc(301, 0);
    const creator = new PublicKey('4wTVyMKp1qLzFGZJv8P2zGjUjpasfT76MhYfNCpQ9R3J');
    const coinCreator = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
    const baseMint = new PublicKey('9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump');
    const quoteMint = new PublicKey('So11111111111111111111111111111111111111112');
    const baseVault = new PublicKey('B8MefT4f5mZmjvS2fcoWwq6xQw8fTgBQtrXvFQipR7rF');
    const quoteVault = new PublicKey('7dHbWXad8eqYJfW5d2mP8GsQhVjhyB4R9f39M6N4HNdC');

    creator.toBuffer().copy(data, 11);
    baseMint.toBuffer().copy(data, 43);
    quoteMint.toBuffer().copy(data, 75);
    baseVault.toBuffer().copy(data, 139);
    quoteVault.toBuffer().copy(data, 171);
    coinCreator.toBuffer().copy(data, 211);

    const decoded = __pumpSwapExecutorTest.decodePumpSwapPoolLayout(data, baseMint);
    assert.equal(decoded.layoutVersion, 2);
    assert.equal(decoded.creator.toBase58(), creator.toBase58());
    assert.equal(decoded.coinCreator.toBase58(), coinCreator.toBase58());
    assert.equal(decoded.baseMint.toBase58(), baseMint.toBase58());
    assert.equal(decoded.quoteMint.toBase58(), quoteMint.toBase58());
    assert.equal(decoded.baseVault.toBase58(), baseVault.toBase58());
    assert.equal(decoded.quoteVault.toBase58(), quoteVault.toBase58());
  });

  test('reads protocol fee recipient from global config recipient array first', () => {
    const data = Buffer.alloc(700, 0);
    const recipient = new PublicKey('62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV');
    recipient.toBuffer().copy(data, 57);

    const parsed = __pumpSwapExecutorTest.resolveProtocolFeeRecipientFromGlobalConfigData(data);
    assert.ok(parsed);
    assert.equal(parsed!.toBase58(), recipient.toBase58());
  });

  test('falls back to reserved fee recipient when recipient array is empty', () => {
    const data = Buffer.alloc(700, 0);
    const reserved = new PublicKey('9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP');
    reserved.toBuffer().copy(data, 385);

    const parsed = __pumpSwapExecutorTest.resolveProtocolFeeRecipientFromGlobalConfigData(data);
    assert.ok(parsed);
    assert.equal(parsed!.toBase58(), reserved.toBase58());
  });

  test('compute buy amounts respects gross input budget and applies slippage haircut', () => {
    const grossBudget = 1_000_000n; // 0.001 SOL
    const baseReserves = 1_000_000_000_000n;
    const quoteReserves = 50_000_000_000n;
    const totalFeeBps = 30n;

    const result = __pumpSwapExecutorTest.computeBuyAmounts(
      grossBudget,
      baseReserves,
      quoteReserves,
      300,
      totalFeeBps,
      0
    );

    assert.ok(result.tokenOutExpected > 0n);
    assert.ok(result.tokenOut > 0n);
    assert.ok(result.tokenOut <= result.tokenOutExpected);
    assert.equal(result.maxQuoteAmountIn, grossBudget);

    const requiredGross = __pumpSwapExecutorTest.quoteGrossQuoteInForTokenOut(
      result.tokenOut,
      baseReserves,
      quoteReserves,
      totalFeeBps
    );
    assert.ok(requiredGross !== null);
    assert.ok(requiredGross! <= grossBudget);
  });

  test('detects pump overflow error texts consistently', () => {
    assert.equal(__pumpSwapExecutorTest.isPumpOverflowErrorMessage('custom program error: 0x1788'), true);
    assert.equal(__pumpSwapExecutorTest.isPumpOverflowErrorMessage('AnchorError occurred. Error Code: Overflow'), true);
    assert.equal(__pumpSwapExecutorTest.isPumpOverflowErrorMessage('custom error: 6023'), true);
    assert.equal(__pumpSwapExecutorTest.isPumpOverflowErrorMessage('insufficient funds'), false);
  });
});
