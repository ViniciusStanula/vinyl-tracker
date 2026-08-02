import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// node-postgres defaults to 10 connections per pool, and a pool is created per
// process: three workers during a build, plus every serverless instance serving
// production. Nothing capped that, so our own site could claim a large share of
// the pooler's 400-client limit before the crawler was even counted, and a
// build overlapping a crawler run died partway through prerendering:
//
//   Error occurred prerendering page "/artista/lizzo"
//   Raw query failed. Code: `XX000`.
//   Message: `(EMAXCONN) max client connections reached, limit: 400`
//
// It reads as an intermittent red build on a healthy commit, because it is a
// race against whatever else is talking to the database.
//
// Four is generous for this workload. Pages are static or ISR, so queries run
// at build and revalidation rather than per visitor, and the build's own
// concurrency is bounded by its worker count.
const POOL_MAX = 4

function createPrismaClient() {
  console.log('[PERF prisma] new Pool+PrismaClient created')
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: POOL_MAX,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma
