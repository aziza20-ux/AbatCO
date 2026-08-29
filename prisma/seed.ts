import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('abateli@2gmail.com', 10)

  await prisma.user.upsert({
    where: { email: 'eliabndahayo4@gmail.com' },
    update: {},
    create: {
      email: 'eliabndahayo4@gmail.com',
      passwordHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
