import { getWalletBalance } from './dist/services/alchemy.js';

const target = '0xc8f8c5a9dff280cde517d197c82ee10fcb46bb07';
const balance = await getWalletBalance('0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E', 'base');

console.log('查找代币:', target);
const found = balance.tokens.find(t => 
  (t.contractAddress || t.contract || '').toLowerCase() === target
);

if (found) {
  console.log('✅ 找到了!');
  console.log('  Symbol:', found.symbol);
  console.log('  Balance:', found.tokenBalance || found.balance);
  console.log('  Contract:', found.contractAddress || found.contract);
} else {
  console.log('❌ 不在前', balance.tokens.length, '个代币中');
}
