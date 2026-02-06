import { findTokenPools } from '../services/dex/poolInfo.js';

const chainId = 8453;
const WETH = '0x4200000000000000000000000000000000000006';
const ZORA = '0x1111111111166b7fe7bd91427724b487980afc69';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const tokens = [
  '0x20b1947b1613b125f81d84ab7c44482099098eb7',
  '0xca8b23fdf6c4566fb7a091766478a9129a91a40b'
];

(async()=>{
  for (const t of tokens){
    const pairs:[string,string,string][]=[['WETH',WETH,t],['ZORA',ZORA,t],['USDC',USDC,t],['WETH-ZORA',WETH,ZORA]];
    console.log('\nTOKEN',t);
    for (const [label,a,b] of pairs){
      const pools=await findTokenPools(a,b,chainId).catch(()=>[]);
      console.log(label,'pools',pools.length,pools.slice(0,3).map(p=>`${p.version}:${p.dex}:${p.poolAddress}:${p.fee||0}`));
    }
  }
})();
