const CHESS_BASE = "https://mercosurpampeana.chesserp.com/AR910/web/api/chess/v1"
const CHESS_USER = process.env.CHESS_USER || "dcepeda1"
const CHESS_PASSWORD = process.env.CHESS_PASSWORD || "1234"

let sessionId: string | null = null
let sessionExpires: number = 0

async function login(): Promise<string> {
  const now = Date.now()
  if (sessionId && now < sessionExpires) return sessionId

  const res = await fetch(`${CHESS_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: CHESS_USER, password: CHESS_PASSWORD }),
  })

  if (!res.ok) throw new Error(`Chess login failed: ${res.status}`)

  const data = await res.json()

  if (!data.sessionId) throw new Error("No se obtuvo sessionId de Chess")

  sessionId = String(data.sessionId)

  // Expire 5 min before actual to be safe
  const expiresSec = data.expires || 3600
  sessionExpires = now + (expiresSec - 300) * 1000

  return sessionId
}

export async function chessGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const cookie = await login()

  const url = new URL(`${CHESS_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Cookie: cookie,
    },
  })

  if (res.status === 401) {
    // Session expired, retry once
    sessionId = null
    sessionExpires = 0
    const newCookie = await login()
    const retry = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Cookie: newCookie,
      },
    })
    if (!retry.ok) throw new Error(`Chess API error: ${retry.status}`)
    return retry.json()
  }

  if (!res.ok) throw new Error(`Chess API error: ${res.status}`)
  return res.json()
}

// ─── Stock Físico ─────────────────────────────────────────────────

export interface ChessStockLine {
  fecha: string
  idDeposito: number | string
  idAlmacen: number | string
  idArticulo: number | string
  dsArticulo: string
  fecVtoLote: string
  cantBultos: number
  cantUnidades: number
}

interface StockResponse {
  [key: string]: unknown
}

export async function getChessStock(): Promise<ChessStockLine[]> {
  const res = await chessGet<StockResponse>("/stock/")

  // Extract array from response (Chess wraps in dataset)
  for (const val of Object.values(res)) {
    if (Array.isArray(val) && val.length > 0 && val[0].idArticulo !== undefined) {
      return val as ChessStockLine[]
    }
  }
  if (Array.isArray(res)) return res as unknown as ChessStockLine[]
  return []
}
