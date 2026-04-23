import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEvmApprovalPolicy } from '../capabilities/evmApprovalPolicy.js';

test('confirmed sells prefer explicit approval over permit2', () => {
  const decision = resolveEvmApprovalPolicy({
    chainId: 8453,
    isSellTx: true,
    waitForConfirmation: true,
  });

  assert.equal(decision.preferPermit2, false);
  assert.equal(decision.allowSignedPermit, false);
  assert.equal(decision.reasonCode, 'confirmed_sell_explicit_approval_preferred');
});

test('copytrade exit keeps its stricter explicit approval reason', () => {
  const decision = resolveEvmApprovalPolicy({
    chainId: 8453,
    isSellTx: true,
    waitForConfirmation: true,
    runtimeContext: {
      metadata: {
        flow: 'copytrade_exit',
      },
    } as any,
  });

  assert.equal(decision.preferPermit2, false);
  assert.equal(decision.allowSignedPermit, false);
  assert.equal(decision.reasonCode, 'copytrade_exit_explicit_approval_preferred');
});

test('native-input buys use allowance-holder instead of permit2', () => {
  const decision = resolveEvmApprovalPolicy({
    chainId: 8453,
    isSellTx: false,
    tokenInRequiresApproval: false,
    waitForConfirmation: true,
  });

  assert.equal(decision.preferPermit2, false);
  assert.equal(decision.allowSignedPermit, false);
  assert.equal(decision.reasonCode, 'native_input_allowance_holder_preferred');
});

test('wallet ERC20 input buys prefer explicit approval over permit2', () => {
  const decision = resolveEvmApprovalPolicy({
    chainId: 8453,
    isSellTx: false,
    tokenInRequiresApproval: true,
    waitForConfirmation: true,
    runtimeContext: {
      mode: 'swap-card',
      metadata: {},
    } as any,
  });

  assert.equal(decision.preferPermit2, false);
  assert.equal(decision.allowSignedPermit, false);
  assert.equal(decision.reasonCode, 'wallet_erc20_input_explicit_approval_preferred');
});

test('allowance-mode wallet sells also prefer explicit approval', () => {
  const decision = resolveEvmApprovalPolicy({
    chainId: 8453,
    isSellTx: true,
    waitForConfirmation: false,
    runtimeContext: {
      mode: 'allowance',
      metadata: {},
    } as any,
  });

  assert.equal(decision.preferPermit2, false);
  assert.equal(decision.allowSignedPermit, false);
  assert.equal(decision.reasonCode, 'confirmed_sell_explicit_approval_preferred');
});
