import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractCandidateAddressesFromParsedSolanaTransaction,
  extractSignerAddressesFromParsedSolanaTransaction,
} from '../services/solana/solanaWebhookHandler.js';

const SIGNER = '7vT6hVh9fdxQ9fvtRB8mKx1R6fJQx6rVYw2JmX1r2QkL';
const SECOND = '6h8x8QX1v4h8Xf5Qh2FjM8fXzM9hQw8Kq2aR2g7n9QbJ';

describe('solana webhook handler address parsing', () => {
  test('extracts signer from message header fallback when signer flags are absent', () => {
    const tx = {
      transaction: {
        message: {
          header: { numRequiredSignatures: 1 },
          staticAccountKeys: [SIGNER, SECOND],
          accountKeys: [{ pubkey: SIGNER }, { pubkey: SECOND }],
        },
      },
      meta: {},
    } as any;

    const signers = extractSignerAddressesFromParsedSolanaTransaction(tx);
    assert.deepEqual(signers, [SIGNER]);
  });

  test('parses candidate addresses from object pubkey forms without object-string artifacts', () => {
    const tx = {
      transaction: {
        message: {
          staticAccountKeys: [{ pubkey: { toBase58: () => SIGNER } }],
          accountKeys: [{ pubkey: SECOND }],
        },
      },
      meta: {
        loadedAddresses: {
          writable: [],
          readonly: [],
        },
      },
    } as any;

    const candidates = extractCandidateAddressesFromParsedSolanaTransaction(tx);
    assert.equal(candidates.includes('[object Object]'), false);
    assert.equal(candidates.includes(SIGNER), true);
    assert.equal(candidates.includes(SECOND), true);
  });
});

