import { callEtherscan } from '../config/unifiedScanService.js';
import { ethers } from 'ethers';

async function main(){
  const pair='0xAEC085E5A5CE8d96A7bDd3eB3A62445d4f6CE703';
  const topic0 = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');
  const res = await callEtherscan(8453, {
    module:'logs',
    action:'getLogs',
    address: pair,
    fromBlock: 0,
    toBlock: 99999999,
    page:1,
    offset:10,
    sort:'asc',
    topic0,
  });
  console.log(JSON.stringify(res,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
