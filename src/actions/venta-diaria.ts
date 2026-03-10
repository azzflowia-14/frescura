"use server"

import { chessGet } from "@/lib/chess"

interface VentaLineaRaw {
  fechaComprobante: string
  idArticulo: number | string
  dsArticulo: string
  cantidadesCorCargo: number
  cantidadesSinCargo: number
  cantidadesTotal: number
  cantidadesRechazo: number
  anulado: string | boolean
  idDocumento: string
  dsDocumento: string
  idCliente: number | string
  nombreCliente: string
  idSucursal: number | string
  dsSucursal: string
  idVendedor: number | string
  dsVendedor: string
  idDeposito: number | string
  dsDeposito: string
}

interface VentasResponse {
  ventas?: VentaLineaRaw[]
  Error?: { mensaje: string }
  [key: string]: unknown
}

export interface SkuVentaDiaria {
  idArticulo: string
  dsArticulo: string
  totalBultos: number
  totalRechazos: number
  ventaNeta: number
  dias: number
  promedioDiario: number
  diasConVenta: number
  frecuencia: number // diasConVenta / dias totales
}

export interface VentaDiariaData {
  skus: SkuVentaDiaria[]
  fechaDesde: string
  fechaHasta: string
  diasRango: number
  totalRegistros: number
  timestamp: string
  error?: string
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function diffDays(from: string, to: string): number {
  const a = new Date(from)
  const b = new Date(to)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export async function getVentaDiariaData(diasAtras: number = 30): Promise<VentaDiariaData> {
  const hoy = new Date()
  const desde = new Date(hoy)
  desde.setDate(desde.getDate() - diasAtras)

  const fechaDesde = formatDate(desde)
  const fechaHasta = formatDate(hoy)
  const diasRango = diffDays(fechaDesde, fechaHasta)

  // Fetch all pages (1000 records per lote)
  const allLines: VentaLineaRaw[] = []
  let lote = 1
  let hasMore = true

  try {
    while (hasMore) {
      const res = await chessGet<VentasResponse>("/ventas/", {
        fechaDesde,
        fechaHasta,
        detallado: true,
        nroLote: lote,
      })

      if (res.Error) {
        return {
          skus: [],
          fechaDesde,
          fechaHasta,
          diasRango,
          totalRegistros: 0,
          timestamp: new Date().toISOString(),
          error: `Error API Chess: ${res.Error.mensaje || "Error desconocido"}`,
        }
      }

      // The response structure may vary - look for the ventas array
      const ventas = extractVentas(res)

      if (!ventas.length) {
        hasMore = false
      } else {
        allLines.push(...ventas)
        // If we got exactly 1000, there might be more
        hasMore = ventas.length >= 1000
        lote++
      }

      // Safety limit: max 50 pages (50,000 records)
      if (lote > 50) break
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      skus: [],
      fechaDesde,
      fechaHasta,
      diasRango,
      totalRegistros: 0,
      timestamp: new Date().toISOString(),
      error: `Error conectando con Chess ERP: ${msg}`,
    }
  }

  // Filter out anulados
  const validLines = allLines.filter((l) => {
    const anulado = typeof l.anulado === "boolean" ? l.anulado : l.anulado === "SI" || l.anulado === "true"
    return !anulado
  })

  // Group by article
  const byArticle = new Map<string, {
    dsArticulo: string
    totalBultos: number
    totalRechazos: number
    fechas: Set<string>
  }>()

  for (const line of validLines) {
    const id = String(line.idArticulo)
    const existing = byArticle.get(id)
    const qty = Number(line.cantidadesTotal) || 0
    const rechazo = Number(line.cantidadesRechazo) || 0
    const fecha = line.fechaComprobante?.split("T")[0] || line.fechaComprobante

    if (existing) {
      existing.totalBultos += qty
      existing.totalRechazos += rechazo
      if (fecha) existing.fechas.add(fecha)
    } else {
      byArticle.set(id, {
        dsArticulo: line.dsArticulo || "",
        totalBultos: qty,
        totalRechazos: rechazo,
        fechas: new Set(fecha ? [fecha] : []),
      })
    }
  }

  // Calculate averages
  const skus: SkuVentaDiaria[] = Array.from(byArticle.entries()).map(([idArticulo, data]) => {
    const ventaNeta = data.totalBultos - data.totalRechazos
    const promedioDiario = diasRango > 0 ? ventaNeta / diasRango : 0
    const diasConVenta = data.fechas.size
    const frecuencia = diasRango > 0 ? diasConVenta / diasRango : 0

    return {
      idArticulo,
      dsArticulo: data.dsArticulo,
      totalBultos: data.totalBultos,
      totalRechazos: data.totalRechazos,
      ventaNeta,
      dias: diasRango,
      promedioDiario,
      diasConVenta,
      frecuencia,
    }
  })

  // Sort by promedioDiario desc
  skus.sort((a, b) => b.promedioDiario - a.promedioDiario)

  return {
    skus,
    fechaDesde,
    fechaHasta,
    diasRango,
    totalRegistros: validLines.length,
    timestamp: new Date().toISOString(),
  }
}

/** Extract ventas array from response (Chess API may nest it differently) */
function extractVentas(res: VentasResponse): VentaLineaRaw[] {
  if (Array.isArray(res.ventas)) return res.ventas
  // Try to find the first array property in the response
  for (const val of Object.values(res)) {
    if (Array.isArray(val) && val.length > 0 && val[0].idArticulo !== undefined) {
      return val as VentaLineaRaw[]
    }
  }
  // If the response itself is an array
  if (Array.isArray(res)) return res as unknown as VentaLineaRaw[]
  return []
}
