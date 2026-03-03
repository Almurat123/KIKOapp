import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSwapTransaction } from '../services/txDecoder.js';

const ETH_UNI_BUY_LOGS = [
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    topics: ['0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c', '0x000000000000000000000000f48a3f7c0575c85cf4529aa220caf3c055773f1c'],
    data: '0x0000000000000000000000000000000000000000000000000001d1935207d302',
  },
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x000000000000000000000000f48a3f7c0575c85cf4529aa220caf3c055773f1c',
      '0x0000000000000000000000006aa28e266cd3031e4b4c4309cb25f7126c8e3bb8',
    ],
    data: '0x0000000000000000000000000000000000000000000000000001d1935207d302',
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x0000000000000000000000006aa28e266cd3031e4b4c4309cb25f7126c8e3bb8',
      '0x000000000000000000000000f48a3f7c0575c85cf4529aa220caf3c055773f1c',
    ],
    data: '0x00000000000000000000000000000000000000000000000003a6110a2fa230e0',
  },
  {
    address: '0xf48A3f7c0575c85cF4529aa220Caf3c055773f1C',
    topics: [],
    data: '0xc4ffcfae50d2e5b5c4469b878b22fbf4b661130902e0ca0c70e9d78a4a6dbe28000000000000000003a6110a2fa230e0',
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x000000000000000000000000f48a3f7c0575c85cf4529aa220caf3c055773f1c',
      '0x0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed',
    ],
    data: '0x00000000000000000000000000000000000000000000000003a6110a2fa230e0',
  },
];

describe('txDecoder transfer evidence', () => {
  test('parses ETH -> UNI buy even without standard pool swap events or known selector', async () => {
    const swap = await parseSwapTransaction(
      {
        hash: '0xb2437f0fcec88aa26effe3f49cd86cfcec07088b714fb39977e9679b19d5cb13',
        from: '0x2cD32fb42748774FAfDE72d8607F16ccc5f5C0ed',
        to: '0x0000000000001fF3684f28c67538d4D072C22734',
        input: '0x2213bc0b',
        value: '511905643352834',
      },
      {
        logs: ETH_UNI_BUY_LOGS as any,
        status: 1,
      },
      1,
      '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
    );

    assert.ok(swap);
    assert.equal(swap?.tokenIn.toLowerCase(), '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    assert.equal(swap?.tokenOut.toLowerCase(), '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984');
  });

  test('keeps plain token transfer without native leg classified as non-swap', async () => {
    const swap = await parseSwapTransaction(
      {
        hash: '0xplain',
        from: '0x2cD32fb42748774FAfDE72d8607F16ccc5f5C0ed',
        to: '0x1234567890123456789012345678901234567890',
        input: '0x',
        value: '0',
      },
      {
        logs: [
          {
            address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
            topics: [
              '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
              '0x0000000000000000000000001234567890123456789012345678901234567890',
              '0x0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed',
            ],
            data: '0x00000000000000000000000000000000000000000000000000000000000f4240',
          },
        ] as any,
        status: 1,
      },
      1,
      '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
    );

    assert.equal(swap, null);
  });
});
