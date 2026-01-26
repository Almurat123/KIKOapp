import { getSpecificTokenBalance } from './dist/services/alchemy.js';

const walletAddress = '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E';
const chain = 'base';
const tokenAddress = '0xc8f8C5A9DfF280Cde517D197c82EE10fcB46BB07';

console.log('测试 getSpecificTokenBalance:');
console.log('Wallet:', walletAddress);
console.log('Chain:', chain);
console.log('Token:', tokenAddress);
console.log('---');

try {
  const result = await getSpecificTokenBalance(walletAddress, chain, tokenAddress);
  console.log('结果:');
  console.log('  raw:', result.raw);
  console.log('  decimals:', result.decimals);
  console.log('  formatted:', result.formatted);
  
  const num = parseFloat(result.formatted);
  if (num > 0) {
    console.log('\n✅ 余额 > 0:', num);
  } else {
    console.log('\n❌ 余额为 0 或无');
  }
} catch (err) {
  console.error('❌ 错误:', err.message);
}
