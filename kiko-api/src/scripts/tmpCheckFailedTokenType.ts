import { detectLaunchpadToken } from '../services/ai/launchpadDetector.js';
import { zoraService } from '../services/zoraService.js';
import { getTokenMetadata } from '../services/rpcService.js';

const chainId = 8453;
const tokens = [
  '0x20b1947b1613b125f81d84ab7c44482099098eb7',
  '0xca8b23fdf6c4566fb7a091766478a9129a91a40b'
];

(async()=>{
  for (const token of tokens) {
    const [det, coin, meta] = await Promise.all([
      detectLaunchpadToken(token, chainId).catch(()=>null),
      zoraService.getCoinByAddress(token).catch(()=>null),
      getTokenMetadata(chainId, token).catch(()=>null)
    ]);
    console.log('\nTOKEN', token);
    console.log('detectLaunchpadToken=', det);
    console.log('zoraCoin=', coin ? { symbol: coin.symbol, coinType: coin.coinType, hook: (coin as any)?.uniswapV4PoolKey?.hookAddress || undefined } : null);
    console.log('meta=', meta);
  }
})();
