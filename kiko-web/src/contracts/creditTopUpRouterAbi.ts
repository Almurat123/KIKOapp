export const creditTopUpRouterAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'refundAddress', type: 'address' },
      { name: 'metadataHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundDeposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'refundId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundableAmount',
    stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'DepositReceived',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'bytes32' },
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'beneficiary', type: 'address' },
      { indexed: false, name: 'refundAddress', type: 'address' },
      { indexed: false, name: 'treasury', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'refundableUntil', type: 'uint64' },
      { indexed: false, name: 'metadataHash', type: 'bytes32' },
    ],
  },
  {
    type: 'event',
    name: 'DepositRefunded',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'bytes32' },
      { indexed: true, name: 'refundId', type: 'bytes32' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: false, name: 'payer', type: 'address' },
      { indexed: false, name: 'refundAddress', type: 'address' },
      { indexed: false, name: 'treasury', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'totalRefundedAmount', type: 'uint256' },
    ],
  },
] as const;

export default creditTopUpRouterAbi;
