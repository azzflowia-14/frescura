import sql from "mssql"

const config: sql.config = {
  server: process.env.DB_HOST || "192.168.20.9",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || "SGLWMS_MD_PROD",
  user: process.env.DB_USER || "",
  password: process.env.DB_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
}

let pool: sql.ConnectionPool | null = null

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool
  pool = await sql.connect(config)
  return pool
}

export async function query<T = Record<string, unknown>>(
  queryStr: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const p = await getPool()
  const request = p.request()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }
  const result = await request.query(queryStr)
  return result.recordset as T[]
}

export { sql }
