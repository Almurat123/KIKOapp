import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
async function main(){
 const v=await prisma.trendingToken.aggregate({where:{chain:'base'},_max:{updatedAt:true},_count:{_all:true}});
 console.log(JSON.stringify(v,null,2));
}
main().finally(()=>prisma.$disconnect());
