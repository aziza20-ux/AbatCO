import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin1234', 10)

  await prisma.user.upsert({
    where: { email: 'admin@abatco.com' },
    update: {},
    create: {
      email: 'admin@abatco.com',
      passwordHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  })

  console.log('Seeded admin — email: admin@abatco.com  password: admin1234')
}

main().catch(console.error).finally(() => prisma.$disconnect())
