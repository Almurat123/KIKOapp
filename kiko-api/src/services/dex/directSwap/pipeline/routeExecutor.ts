import { executeInfinitySwap as executeInfinitySwapExecutor } from '../executors/infinity.js';
import { executeV2Swap as executeV2SwapExecutor } from '../executors/v2.js';
import { executeV3Swap as executeV3SwapExecutor } from '../executors/v3.js';
import { executeV4Swap as executeV4SwapExecutor } from '../executors/v4.js';

export async function executeV2Route(...args: any[]): Promise<any> {
  return await (executeV2SwapExecutor as any)(...args);
}

export async function executeV3Route(...args: any[]): Promise<any> {
  return await (executeV3SwapExecutor as any)(...args);
}

export async function executeV4Route(...args: any[]): Promise<any> {
  return await (executeV4SwapExecutor as any)(...args);
}

export async function executeInfinityRoute(...args: any[]): Promise<any> {
  return await (executeInfinitySwapExecutor as any)(...args);
}
