import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool, type PoolClient } from 'pg'

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

// Capping our own usage narrowed the race but could not win it: the limit is
// shared with the crawler, which now runs 2h+ every 3h, so a build is usually
// running while it is. Three production deploys in a row died on a single page
// out of 681 — a transient refusal that clears in seconds, failing the whole
// build. So retry the connect instead of surfacing it.
//
// A build can afford to wait; a visitor cannot. During prerender we retry for
// up to ~2min because a slow green build beats a red one. At runtime we retry
// three times over ~1.2s and then fail as before, so a saturated pooler can
// never hold a request open for minutes.
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build'
const RETRY_ATTEMPTS = IS_BUILD ? 8 : 3
const RETRY_BASE_MS = IS_BUILD ? 4000 : 400

function isPoolerSaturated(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('EMAXCONN') || msg.includes('max client connections')
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// pg's Pool.query() acquires through Pool.connect(), so patching connect covers
// both paths the Prisma adapter uses.
export function withConnectRetry(pool: Pool): Pool {
  const baseConnect = pool.connect.bind(pool) as () => Promise<PoolClient>

  const acquire = async (): Promise<PoolClient> => {
    let last: unknown
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      try {
        return await baseConnect()
      } catch (err) {
        if (!isPoolerSaturated(err)) throw err
        last = err
        if (attempt === RETRY_ATTEMPTS - 1) break
        const wait = RETRY_BASE_MS * (attempt + 1)
        console.warn(
          `[prisma] pooler saturated — retry ${attempt + 1}/${RETRY_ATTEMPTS} in ${wait}ms`
        )
        await sleep(wait)
      }
    }
    throw last
  }

  // Both call signatures must be honoured. Pool.query() acquires its client
  // through the CALLBACK form -- `this.connect((err, client) => ...)` -- so an
  // override that only returns a promise silently never calls back and every
  // pool.query() hangs forever.
  pool.connect = function (
    cb?: (
      err: Error | undefined,
      client?: PoolClient,
      done?: (release?: boolean | Error) => void
    ) => void
  ): Promise<PoolClient> | void {
    if (typeof cb !== 'function') return acquire()
    acquire().then(
      (client) => cb(undefined, client, client.release.bind(client)),
      (err) => cb(err as Error, undefined, () => {})
    )
  } as typeof pool.connect

  return pool
}

function createPrismaClient() {
  console.log('[PERF prisma] new Pool+PrismaClient created')
  const pool = withConnectRetry(
    new Pool({
      connectionString: process.env.DATABASE_URL!,
      max: POOL_MAX,
    })
  )
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma
