"use server"

import { chessGet } from "@/lib/chess"

// Campos que devuelve Chess en dsReporteComprobantesApi.VentasResumen
interface VentaLineaRaw {
  fechaComprobate?: string   // nota: Chess lo escribe sin la "n" final
  fechaComprobante?: string
  idArticulo?: number | string
  dsArticulo?: string
  cantidadesCorCargo?: number
  cantidadesSinCargo?: number
  cantidadesTotal?: number
  cantidadesRechazo?: number
  anulado?: string | boolean
  idDocumento?: string
  dsDocumento?: string
  idCliente?: number | string
  nombreCliente?: string
  idSucursal?: number | string
  dsSucursal?: string
  idVendedor?: number | string
  dsVendedor?: string
  idDeposito?: number | string
  dsDeposito?: string
  subtotalFinal?: number
  idRechazo?: number
  dsRechazo?: string
  [key: string]: unknown
}

interface VentasResponse {
  dsReporteComprobantesApi?: {
    VentasResumen?: VentaLineaRaw[]
  }
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

  // Consultar Chess día por día (mismo patrón que mercosur-region-pampeana)
  const allLines: VentaLineaRaw[] = []

  try {
    const currentDate = new Date(desde)
    const endDate = new Date(hoy)

    while (currentDate <= endDate) {
      const fechaStr = formatDate(currentDate)

      const res = await chessGet<VentasResponse>("/ventas/", {
        fechaDesde: fechaStr,
        fechaHasta: fechaStr,
        detallado: true,
      })

      if (res.Error) {
        // Si un día falla, logueamos y seguimos con el siguiente
        console.error(`Chess error dia ${fechaStr}:`, res.Error.mensaje)
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      const ventas = extractVentas(res)
      if (ventas.length > 0) {
        allLines.push(...ventas)
      }

      currentDate.setDate(currentDate.getDate() + 1)
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

  if (allLines.length === 0) {
    return {
      skus: [],
      fechaDesde,
      fechaHasta,
      diasRango,
      totalRegistros: 0,
      timestamp: new Date().toISOString(),
      error: "No se encontraron datos de ventas en el rango seleccionado",
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
    const fechaRaw = line.fechaComprobante || line.fechaComprobate || ""
    const fecha = fechaRaw.split("T")[0]

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

/** Extract ventas array from response - Chess usa dsReporteComprobantesApi.VentasResumen */
function extractVentas(res: VentasResponse): VentaLineaRaw[] {
  // Path principal: dsReporteComprobantesApi.VentasResumen
  const resumen = res.dsReporteComprobantesApi?.VentasResumen
  if (Array.isArray(resumen) && resumen.length > 0) return resumen

  // Fallback: campo ventas directo
  if (Array.isArray(res.ventas)) return res.ventas

  // Fallback: buscar primer array con datos de artículos
  for (const val of Object.values(res)) {
    if (Array.isArray(val) && val.length > 0 && (val[0].idArticulo !== undefined || val[0].dsArticulo !== undefined)) {
      return val as VentaLineaRaw[]
    }
  }

  // Fallback: response es array directo
  if (Array.isArray(res)) return res as unknown as VentaLineaRaw[]
  return []
}
