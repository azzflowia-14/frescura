const CHESS_BASE = "https://mercosurpampeana.chesserp.com/AR910/web/api/chess/v1"
const CHESS_USER = "sroselli"
const CHESS_PASSWORD = "1234"

let sessionCookie: string | null = null
let sessionExpires: number = 0

async function login(): Promise<string> {
  const now = Date.now()
  if (sessionCookie && now < sessionExpires) return sessionCookie

  const res = await fetch(`${CHESS_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: CHESS_USER, password: CHESS_PASSWORD }),
  })

  if (!res.ok) throw new Error(`Chess login failed: ${res.status}`)

  const data = await res.json()

  // Extract cookie from Set-Cookie header or response body
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) {
    const match = setCookie.match(/JSESSIONID=([^;]+)/)
    if (match) sessionCookie = `JSESSIONID=${match[1]}`
  }
  if (!sessionCookie && data.sessionId) {
    sessionCookie = data.sessionId.includes("JSESSIONID")
      ? data.sessionId
      : `JSESSIONID=${data.sessionId}`
  }

  if (!sessionCookie) throw new Error("No session cookie received from Chess")

  // Expire 5 min before actual to be safe
  const expiresSec = data.expires || 3600
  sessionExpires = now + (expiresSec - 300) * 1000

  return sessionCookie
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
    headers: { Cookie: cookie },
  })

  if (res.status === 401) {
    // Session expired, retry once
    sessionCookie = null
    sessionExpires = 0
    const newCookie = await login()
    const retry = await fetch(url.toString(), {
      headers: { Cookie: newCookie },
    })
    if (!retry.ok) throw new Error(`Chess API error: ${retry.status}`)
    return retry.json()
  }

  if (!res.ok) throw new Error(`Chess API error: ${res.status}`)
  return res.json()
}
