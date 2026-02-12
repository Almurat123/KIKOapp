import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
async function main(){
 const max=await prisma.trendingToken.aggregate({where:{chain:'base'},_max:{updatedAt:true},_count:{_all:true}});
 const sample=await prisma.trendingToken.findMany({where:{chain:'base'},orderBy:{rank:'asc'},take:5,select:{rank:true,symbol:true,name:true,updatedAt:true}});
 console.log(JSON.stringify({max,sample},null,2));
}
main().finally(()=>prisma.$disconnect());
