import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const marketId = '0x1234567890abcdef';

  console.log('Seeding database...');
  await prisma.market.upsert({
    where: { marketId },
    update: {},
    create: {
      marketId,
      title: 'ETH > 3500 End of Week?',
      category: 'Crypto',
      currentMu: 3500,
      currentSigma: 200,
      totalLiquidity: 100000,
      globalAccumulator: 0,
      minVarianceBound: 50,
    },
  });
  console.log(`Market ${marketId} seeded!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
