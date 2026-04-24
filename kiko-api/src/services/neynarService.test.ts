import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNeynarCastReplyParams,
  normalizeNeynarCastHash,
  normalizeNeynarFarcasterWalletEvidence,
} from './neynarService.js';

test('buildNeynarCastReplyParams uses NeynarAPIClient wrapper keys', () => {
  assert.deepEqual(buildNeynarCastReplyParams({
    signerUuid: 'signer-uuid',
    text: ' gm ',
    parentHash: '0xparent',
    parentAuthorFid: 1576616,
    idem: 'reply-idem',
  }), {
    signerUuid: 'signer-uuid',
    text: 'gm',
    parent: '0xparent',
    parentAuthorFid: 1576616,
    idem: 'reply-idem',
  });
});

test('buildNeynarCastReplyParams maps generated-image URLs into Neynar embeds', () => {
  assert.deepEqual(buildNeynarCastReplyParams({
    signerUuid: 'signer-uuid',
    text: 'generated',
    parentHash: '0xparent',
    parentAuthorFid: 1576616,
    idem: 'reply-idem',
    embeds: [
      ' https://cdn.example/generated.png ',
      'data:image/png;base64,not-public',
      'https://cdn.example/generated.png',
    ],
  }), {
    signerUuid: 'signer-uuid',
    text: 'generated',
    parent: '0xparent',
    parentAuthorFid: 1576616,
    idem: 'reply-idem',
    embeds: [{ url: 'https://cdn.example/generated.png' }],
  });
});

test('normalizeNeynarCastHash rejects malformed cast hashes before publish', () => {
  assert.equal(normalizeNeynarCastHash('a2827859051455dd5cb7b0c1b33bb9cf4a8b0edb'), '0xa2827859051455dd5cb7b0c1b33bb9cf4a8b0edb');
  assert.equal(normalizeNeynarCastHash('0xA2827859051455DD5CB7B0C1B33BB9CF4A8B0EDB'), '0xa2827859051455dd5cb7b0c1b33bb9cf4a8b0edb');
  assert.equal(normalizeNeynarCastHash('0XA2827859051455DD5CB7B0C1B33BB9CF4A8B0EDB'), '0xa2827859051455dd5cb7b0c1b33bb9cf4a8b0edb');
  assert.equal(normalizeNeynarCastHash('synthetic-neynar-webhook-test'), null);
  assert.equal(normalizeNeynarCastHash('0xparent'), null);
});

test('normalizeNeynarFarcasterWalletEvidence prioritizes primary verified EVM address', () => {
  const result = normalizeNeynarFarcasterWalletEvidence({
    fid: 3,
    username: 'alice',
    display_name: 'Alice',
    custody_address: '0x9999999999999999999999999999999999999999',
    follower_count: 123,
    following_count: 45,
    profile: {
      bio: {
        text: 'builder on base',
        mentioned_profiles: [{ fid: 9, username: 'bob', display_name: 'Bob' }],
        mentioned_channels: [{ id: 'base', name: 'Base' }],
      },
    },
    verified_accounts: [{ platform: 'x', username: 'alice_x' }],
    experimental: { neynar_user_score: 0.82 },
    pro: { status: 'subscribed' },
    power_badge: true,
    auth_addresses: [{ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', app: { fid: 1 } }],
    viewer_context: {
      following: true,
      followed_by: false,
      blocking: false,
      blocked_by: false,
    },
    verified_addresses: {
      eth_addresses: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x1111111111111111111111111111111111111111',
      ],
      sol_addresses: ['So11111111111111111111111111111111111111112'],
      primary: {
        eth_address: '0x2222222222222222222222222222222222222222',
        sol_address: null,
      },
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.primaryVerifiedEvmAddress, '0x2222222222222222222222222222222222222222');
  assert.deepEqual(result.pnlEligibleEvmAddresses, [
    '0x2222222222222222222222222222222222222222',
    '0x1111111111111111111111111111111111111111',
  ]);
  assert.equal(result.walletCandidates[0]?.isPrimary, true);
  assert.equal(result.walletCandidates[0]?.source, 'neynar_verified_addresses');
  assert.equal(result.walletCandidates[0]?.walletRole, 'verified_wallet');
  assert.equal(result.walletCandidates[0]?.analysisRole, 'trading_wallet_candidate');
  assert.equal(result.walletCandidates[0]?.canAssumeTradingWallet, false);
  assert.equal(result.socialProfile.followerCount, 123);
  assert.deepEqual(result.socialProfile.verifiedAccounts, [{ platform: 'x', username: 'alice_x' }]);
  assert.equal(result.accountStatus.fidRegistered, true);
  assert.equal(result.accountStatus.custodyAddressPresent, true);
  assert.equal(result.accountStatus.hasVerifiedEvmWallet, true);
  assert.equal(result.accountStatus.hasVerifiedSolWallet, true);
  assert.equal(result.accountStatus.hasVerifiedExternalAccounts, true);
  assert.equal(result.accountStatus.authAddressCount, 1);
  assert.equal(result.accountStatus.farcasterProStatus, 'subscribed');
  assert.equal(result.accountStatus.powerBadge, true);
  assert.equal(result.accountStatus.viewerContext.following, true);
  assert.ok(result.accountStatus.statusTags.includes('has_verified_evm_wallet'));
  assert.equal(result.qualitySignals.neynarUserScore, 0.82);
  assert.equal(result.qualitySignals.qualityTier, 'high');
  assert.ok(result.qualitySignals.labels.includes('neynar_score_high'));
  assert.ok(result.identityTags.includes('verified_x'));
  assert.deepEqual(result.tradingWalletCandidateEvmAddresses, [
    '0x2222222222222222222222222222222222222222',
    '0x1111111111111111111111111111111111111111',
  ]);
  assert.deepEqual(result.confirmedTradingWalletAddresses, []);
  assert.match(result.answerPolicy.tradingWalletRule, /verified EVM wallet can be a trading-analysis candidate/i);
  assert.equal(result.nextToolHint.pnlTool, 'analyze_wallet_pnl_batch');
});

test('normalizeNeynarFarcasterWalletEvidence does not invent quality status for missing Neynar user', () => {
  const result = normalizeNeynarFarcasterWalletEvidence(null);

  assert.equal(result.success, false);
  assert.equal(result.accountStatus.fidRegistered, false);
  assert.equal(result.accountStatus.usernamePresent, false);
  assert.equal(result.accountStatus.hasVerifiedEvmWallet, false);
  assert.equal(result.qualitySignals.neynarUserScore, null);
  assert.equal(result.qualitySignals.score, null);
  assert.equal(result.qualitySignals.qualityTier, 'unknown');
  assert.deepEqual(result.identityTags, []);
});

test('normalizeNeynarFarcasterWalletEvidence does not auto-use custody-only address for PNL', () => {
  const result = normalizeNeynarFarcasterWalletEvidence({
    fid: 4,
    username: 'custodyonly',
    custody_address: '0x3333333333333333333333333333333333333333',
    verified_addresses: {
      eth_addresses: [],
      sol_addresses: [],
      primary: {
        eth_address: null,
        sol_address: null,
      },
    },
  });

  assert.equal(result.primaryVerifiedEvmAddress, null);
  assert.deepEqual(result.pnlEligibleEvmAddresses, []);
  assert.equal(result.walletCandidates[0]?.addressType, 'custody_address');
  assert.equal(result.walletCandidates[0]?.walletRole, 'farcaster_wallet');
  assert.equal(result.walletCandidates[0]?.analysisRole, 'account_wallet_only');
  assert.equal(result.walletCandidates[0]?.pnlEligible, false);
  assert.equal(result.walletCandidates[0]?.canAssumeTradingWallet, false);
  assert.equal(result.answerPolicy.canUseForPnlInput, false);
  assert.equal(result.nextToolHint.pnlTool, null);
  assert.match(result.warnings.join('\n'), /custody address is not used automatically/i);
});

test('normalizeNeynarFarcasterWalletEvidence marks Neynar balances as non-PNL evidence', () => {
  const result = normalizeNeynarFarcasterWalletEvidence({
    fid: 5,
    username: 'balance',
    verified_addresses: {
      eth_addresses: ['0x4444444444444444444444444444444444444444'],
      sol_addresses: [],
      primary: {
        eth_address: '0x4444444444444444444444444444444444444444',
        sol_address: null,
      },
    },
  }, {
    includeBalances: true,
    rawBalance: {
      user_balance: {
        address_balances: [
          {
            verified_address: {
              address: '0x4444444444444444444444444444444444444444',
              network: 'base',
            },
            token_balances: [
              {
                token: {
                  symbol: 'USDC',
                  address: '0x5555555555555555555555555555555555555555',
                },
                balance: {
                  in_token: '0',
                  in_usdc: '0',
                },
              },
            ],
          },
        ],
      },
    },
  });

  assert.equal(result.balanceSummary?.provider, 'neynar');
  assert.equal(result.balanceSummary?.canAnswerPnl, false);
  assert.equal(result.answerPolicy.canAnswerCurrentBalances, true);
  assert.equal(result.answerPolicy.canAnswerPnl, false);
  assert.equal(result.balanceSummary?.addressBalances[0]?.tokens[0]?.balanceUsd, '0');
});
