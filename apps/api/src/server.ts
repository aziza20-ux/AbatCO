import 'dotenv/config'
import { app } from './app.js'
import { prisma } from './prisma.js'

const port = Number(process.env.API_PORT ?? 4000)
const server = app.listen(port, () => console.log(`API listening on port ${port}`))

const shutdown = async () => {
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())