import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await getPool().query('SELECT 1')
    return Response.json({
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch {
    return Response.json(
      {
        status: 'error',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
