import { connectRedis, del } from '../cache/redis.js';

async function main(){
  const chain='base';
  const a='0x22af33fe49fd1fa80c7149773dde5890d3c76f3b';
  await connectRedis();
  await del(`token:baseline:v1:${chain}:${a}`);
  await del(`token:baseline:retry:v1:${chain}:${a}`);
  await del(`token:meta:v1:${chain}:${a}`);
  console.log('deleted keys for', a);
}

main().catch(e=>{console.error(e);process.exitCode=1;});
