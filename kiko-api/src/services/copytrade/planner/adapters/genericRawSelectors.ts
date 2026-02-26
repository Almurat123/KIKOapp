import { ethers } from 'ethers';
import type { ExecutionPlanV1, PlannerInput } from '../types.js';
import type { SourceReplayAdapter, SourceReplayRewriteOutput } from './types.js';
import {
  defaultDeadline,
  parseNativeInputAmountWei,
  parseSourceValueWei,
  safeRewriteCalldata
} from './shared.js';

interface GenericRawAdapterConfig {
  selector: string;
  name: string;
}

function buildRawReplayPlan(
  input: PlannerInput,
  selector: string,
  adapterName: string,
  rewrittenCalldata: string,
  sourceValue: bigint
): ExecutionPlanV1 {
  const router = String(input.sourceRouter || '').trim();
  return {
    version: 1,
    chainId: input.chainId,
    side: input.side,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn: input.amountIn,
    minAmountOut: '0',
    receiver: input.walletAddress,
    deadline: defaultDeadline(),
    nonce: `${Date.now()}`,
    templateRef: {
      templateId: `source-raw-replay:${input.chainId}:${router.toLowerCase()}:${selector}`,
      templateVersion: 1,
      router,
      commandType: 'source_raw_calldata_replay'
    },
    execData: {
      commands: '0x',
      inputs: [],
      sourceCalldata: rewrittenCalldata,
      sourceValue: sourceValue > 0n ? sourceValue.toString() : undefined
    },
    constraints: {
      maxSlippageBps: 2500,
      maxGas: '1500000',
      allowPartialFill: false,
      strictTokenCheck: true
    },
    trace: {
      sourceTxHash: input.sourceTxHash,
      sampleIds: [],
      plannerScore: 1,
      reasoning: 'source_raw_calldata_replay_from_target_tx',
      adapterName,
      adapterVersion: '1'
    }
  };
}

function createGenericRawSelectorAdapter(config: GenericRawAdapterConfig): SourceReplayAdapter {
  const selector = String(config.selector || '').toLowerCase();
  return {
    name: config.name,
    version: '1',
    supports(candidate: string): boolean {
      return String(candidate || '').toLowerCase() === selector;
    },
    rewrite(input: PlannerInput): SourceReplayRewriteOutput | null {
      const router = String(input.sourceRouter || '').trim();
      const sourceTxInput = String(input.sourceTxInput || '');
      if (!/^0x[a-fA-F0-9]{40}$/.test(router)) return null;
      if (!sourceTxInput.startsWith('0x') || sourceTxInput.length < 10) return null;

      const desiredValueWei = parseNativeInputAmountWei(input);
      const sourceValueWei = parseSourceValueWei(input.sourceTxValue);
      const replayValueWei = desiredValueWei && desiredValueWei > 0n ? desiredValueWei : sourceValueWei;
      const rewriteValueWei = replayValueWei > 0n ? replayValueWei : 0n;

      const sourceWallet = String(input.sourceWallet || '').toLowerCase();
      const followerWallet = String(input.walletAddress || '').toLowerCase();
      const rewrite = safeRewriteCalldata({
        dataNoPrefix: sourceTxInput.toLowerCase().slice(2),
        selector,
        sourceWallet,
        followerWallet,
        sourceValueWei,
        desiredValueWei: rewriteValueWei,
        tokenIn: String(input.tokenIn || '').toLowerCase(),
        tokenOut: String(input.tokenOut || '').toLowerCase(),
        // Unknown selector families should avoid blindly overwriting calldata head words.
        rewriteHeadWord: false
      });

      const plan = buildRawReplayPlan(input, selector, config.name, `0x${rewrite.data}`, replayValueWei);
      if (replayValueWei <= 0n) {
        rewrite.warnings.push('rewrite:value_not_overridden');
      }
      return {
        plan,
        adapterName: this.name,
        adapterVersion: this.version,
        warnings: rewrite.warnings
      };
    },
    validate(output: SourceReplayRewriteOutput): { ok: boolean; reason?: string } {
      if (output.warnings.some((w) => w.startsWith('validation:'))) {
        return { ok: false, reason: output.warnings.find((w) => w.startsWith('validation:')) };
      }
      if (output.warnings.includes('collision:source_wallet_matches_token')) {
        return { ok: false, reason: 'collision:source_wallet_matches_token' };
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(String(output.plan.templateRef.router || ''))) {
        return { ok: false, reason: 'invalid_router' };
      }
      return { ok: true };
    }
  };
}

export const raw0f27c5c1Adapter = createGenericRawSelectorAdapter({
  selector: '0x0f27c5c1',
  name: 'raw0f27c5c1'
});

export const rawd1ee211dAdapter = createGenericRawSelectorAdapter({
  selector: '0xd1ee211d',
  name: 'rawd1ee211d'
});

export const raw2213bc0bAdapter = createGenericRawSelectorAdapter({
  selector: '0x2213bc0b',
  name: 'raw2213bc0b'
});

export const raw784e2685Adapter = createGenericRawSelectorAdapter({
  selector: '0x784e2685',
  name: 'raw784e2685'
});

export const rawb6f9de95Adapter = createGenericRawSelectorAdapter({
  selector: '0xb6f9de95',
  name: 'rawb6f9de95'
});

export const raw791ac947Adapter = createGenericRawSelectorAdapter({
  selector: '0x791ac947',
  name: 'raw791ac947'
});

export const raw04e45aafAdapter = createGenericRawSelectorAdapter({
  selector: '0x04e45aaf',
  name: 'raw04e45aaf'
});

export const raw0490a7f3Adapter = createGenericRawSelectorAdapter({
  selector: '0x0490a7f3',
  name: 'raw0490a7f3'
});

export function getGenericRawReplaySpender(router: string): string {
  return ethers.getAddress(String(router || ethers.ZeroAddress)).toLowerCase();
}
