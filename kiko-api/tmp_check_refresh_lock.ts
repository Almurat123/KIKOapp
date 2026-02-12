import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(){
  const key='lock:tokenJob:refresh:base';
  const row = await prisma.cache.findUnique({ where:{ key } }).catch(()=>null as any);
  const upd = await prisma.trendingToken.aggregate({ where:{chain:'base'}, _max:{updatedAt:true}, _count:{_all:true} });
  console.log(JSON.stringify({ lock: row, updated: upd }, null, 2));
}
main().finally(()=>prisma.$disconnect());
