"use server"

import { chessGet } from "@/lib/chess"

interface VentaLineaRaw {
  idArticulo?: number | string
  dsArticulo?: string
  cantidadesTotal?: number
  cantidadesRechazo?: number
  anulado?: string | boolean
  [key: string]: unknown
}

interface VentasResponse {
  dsReporteComprobantesApi?: { VentasResumen?: VentaLineaRaw[] }
  ventas?: VentaLineaRaw[]
  Error?: { mensaje: string }
  [key: string]: unknown
}

export interface VpdItem {
  idArticulo: string
  dsArticulo: string
  vpdBultos: number // venta promedio diaria en bultos
  totalBultos: number
  totalRechazos: number
  ventaNeta: number
}

export interface VpdData {
  vpd: Record<string, VpdItem> // key = idArticulo
  diasRango: number
  timestamp: string
  error?: string
}

export async function getVpdChess(diasAtras: number = 30): Promise<VpdData> {
  const hoy = new Date()
  const desde = new Date(hoy)
  desde.setDate(desde.getDate() - diasAtras)

  // Generar lista de fechas
  const dates: string[] = []
  const current = new Date(desde)
  while (current <= hoy) {
    dates.push(current.toISOString().split("T")[0])
    current.setDate(current.getDate() + 1)
  }

  const allLines: VentaLineaRaw[] = []

  try {
    // Fetch en batches paralelos de 10 para no saturar Chess
    const batchSize = 10
    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map((fecha) =>
          chessGet<VentasResponse>("/ventas/", {
            fechaDesde: fecha,
            fechaHasta: fecha,
            detallado: true,
          })
        )
      )

      for (const result of results) {
        if (result.status === "fulfilled") {
          const res = result.value
          if (res.Error) continue
          const ventas = extractVentas(res)
          allLines.push(...ventas)
        }
      }
    }
  } catch (e) {
    return {
      vpd: {},
      diasRango: dates.length,
      timestamp: new Date().toISOString(),
      error: `Error Chess API: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  // Filtrar anulados
  const validLines = allLines.filter((l) => {
    const anulado = typeof l.anulado === "boolean" ? l.anulado : l.anulado === "SI" || l.anulado === "true"
    return !anulado
  })

  // Agrupar por artículo
  const byArticle = new Map<string, { dsArticulo: string; total: number; rechazos: number }>()
  for (const line of validLines) {
    const id = String(line.idArticulo || "").trim()
    if (!id) continue
    const qty = Number(line.cantidadesTotal) || 0
    const rechazo = Number(line.cantidadesRechazo) || 0
    const existing = byArticle.get(id)
    if (existing) {
      existing.total += qty
      existing.rechazos += rechazo
    } else {
      byArticle.set(id, { dsArticulo: line.dsArticulo || "", total: qty, rechazos: rechazo })
    }
  }

  // Calcular VPD
  const diasRango = dates.length
  const vpd: Record<string, VpdItem> = {}
  for (const [id, data] of byArticle) {
    const ventaNeta = data.total - data.rechazos
    vpd[id] = {
      idArticulo: id,
      dsArticulo: data.dsArticulo,
      vpdBultos: diasRango > 0 ? Math.round((ventaNeta / diasRango) * 100) / 100 : 0,
      totalBultos: data.total,
      totalRechazos: data.rechazos,
      ventaNeta,
    }
  }

  return {
    vpd,
    diasRango,
    timestamp: new Date().toISOString(),
  }
}

function extractVentas(res: VentasResponse): VentaLineaRaw[] {
  const resumen = res.dsReporteComprobantesApi?.VentasResumen
  if (Array.isArray(resumen) && resumen.length > 0) return resumen
  if (Array.isArray(res.ventas)) return res.ventas
  for (const val of Object.values(res)) {
    if (Array.isArray(val) && val.length > 0 && (val[0].idArticulo !== undefined)) {
      return val as VentaLineaRaw[]
    }
  }
  if (Array.isArray(res)) return res as unknown as VentaLineaRaw[]
  return []
}
