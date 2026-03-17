"use server"

import { getChessStock, chessGet } from "@/lib/chess"
import { query } from "@/lib/db"
import { getSkuInfo, esMercaderia } from "@/lib/sku"

// ── Types ────────────────────────────────────────────────────────

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

export interface KardexDia {
  fecha: string
  stockEstimado: number
  ingresos: number
  ventas: number
}

export interface KardexSku {
  articulo: string
  descripcion: string
  division: string
  stockHoy: number
  vendido: number
  ingresado: number
  stockInicio: number
}

export interface KardexData {
  evolucion: KardexDia[]
  porSku: KardexSku[]
  detalleSku: KardexDia[] | null // solo si se filtró un artículo
  totales: {
    stockHoy: number
    totalVentas: number
    totalIngresos: number
    stockEstimadoInicio: number
  }
  mes: number
  anio: number
  timestamp: string
  error?: string
}

// ── Helpers ───────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().split("T")[0]
}

function genDates(mes: number, anio: number): string[] {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dates: string[] = []
  const start = new Date(anio, mes - 1, 1)
  const end = new Date(anio, mes, 0) // último día del mes
  const current = new Date(start)
  while (current <= end && current <= hoy) {
    dates.push(fmt(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function extractVentas(res: VentasResponse): VentaLineaRaw[] {
  const resumen = res.dsReporteComprobantesApi?.VentasResumen
  if (Array.isArray(resumen) && resumen.length > 0) return resumen
  if (Array.isArray(res.ventas)) return res.ventas
  for (const val of Object.values(res)) {
    if (Array.isArray(val) && val.length > 0 && (val[0] as Record<string, unknown>).idArticulo !== undefined) {
      return val as VentaLineaRaw[]
    }
  }
  return []
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Main ─────────────────────────────────────────────────────────

export async function getKardexData(
  mes?: number,
  anio?: number,
  articuloFiltro?: string,
): Promise<KardexData> {
  const hoy = new Date()
  const m = mes ?? hoy.getMonth() + 1
  const a = anio ?? hoy.getFullYear()
  const dates = genDates(m, a)

  if (dates.length === 0) {
    return {
      evolucion: [], porSku: [], detalleSku: null,
      totales: { stockHoy: 0, totalVentas: 0, totalIngresos: 0, stockEstimadoInicio: 0 },
      mes: m, anio: a, timestamp: new Date().toISOString(), error: "No hay fechas en el rango",
    }
  }

  const mesStr = String(m).padStart(2, "0")
  const fechaDesde = `${a}-${mesStr}-01`
  const siguienteMes = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`

  // Paralelo: stock Chess + ingresos WMS
  // Ventas Chess se hacen aparte (día por día)
  const [chessStock, ingresosRaw] = await Promise.all([
    getChessStock(),
    query<{ fecha: string; art: string; bultos: number }>(`
      SELECT CONVERT(varchar, c.PltFchIngreso, 23) as fecha,
        RTRIM(d.ArtCod) as art,
        SUM(d.PltPUBQty) as bultos
      FROM PLTCBC c
      INNER JOIN PLTDTL d ON RTRIM(c.PltCod) = RTRIM(d.PltCod)
      WHERE c.PltFchIngreso >= @fechaDesde AND c.PltFchIngreso < @siguienteMes
      GROUP BY CONVERT(varchar, c.PltFchIngreso, 23), d.ArtCod
      ORDER BY fecha
    `, { fechaDesde, siguienteMes }),
  ])

  // Agregar stock actual por artículo
  const stockByArt = new Map<string, { descripcion: string; bultos: number }>()
  for (const r of chessStock) {
    const art = String(r.idArticulo).trim()
    if (!art || !esMercaderia(art)) continue
    const bultos = Number(r.cantBultos) || 0
    if (bultos <= 0) continue
    const existing = stockByArt.get(art)
    if (existing) {
      existing.bultos += bultos
    } else {
      stockByArt.set(art, { descripcion: String(r.dsArticulo || "").trim(), bultos })
    }
  }

  // Ingresos por fecha y artículo
  const ingresosByDateArt = new Map<string, Map<string, number>>() // fecha -> art -> bultos
  for (const r of ingresosRaw) {
    const art = r.art?.trim()
    if (!art || !esMercaderia(art)) continue
    const dateMap = ingresosByDateArt.get(r.fecha) || new Map()
    dateMap.set(art, (dateMap.get(art) || 0) + r.bultos)
    ingresosByDateArt.set(r.fecha, dateMap)
  }

  // Ventas por fecha y artículo (Chess, día por día en batches)
  const ventasByDateArt = new Map<string, Map<string, number>>() // fecha -> art -> bultos netos
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

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const fecha = batch[j]
      if (result.status !== "fulfilled") continue
      const res = result.value
      if (res.Error) continue
      const ventas = extractVentas(res)

      const dateMap = new Map<string, number>()
      for (const v of ventas) {
        const anulado = typeof v.anulado === "boolean" ? v.anulado : v.anulado === "SI" || v.anulado === "true"
        if (anulado) continue
        const art = String(v.idArticulo || "").trim()
        if (!art || !esMercaderia(art)) continue
        const qty = Number(v.cantidadesTotal) || 0
        const rechazo = Number(v.cantidadesRechazo) || 0
        const neto = qty - rechazo
        dateMap.set(art, (dateMap.get(art) || 0) + neto)
      }
      if (dateMap.size > 0) ventasByDateArt.set(fecha, dateMap)
    }
  }

  // Conjunto de todos los artículos involucrados
  const allArts = new Set<string>()
  for (const art of stockByArt.keys()) allArts.add(art)
  for (const dateMap of ventasByDateArt.values()) {
    for (const art of dateMap.keys()) allArts.add(art)
  }
  for (const dateMap of ingresosByDateArt.values()) {
    for (const art of dateMap.keys()) allArts.add(art)
  }

  // Reconstruir stock día a día POR ARTÍCULO (hacia atrás)
  // stockArt[art][fecha] = stock estimado al final del día
  const stockArtByDate = new Map<string, Map<string, number>>() // art -> fecha -> stock

  for (const art of allArts) {
    const stockHoy = stockByArt.get(art)?.bultos ?? 0
    const dayStocks = new Map<string, number>()

    // Último día = stock actual
    let currentStock = stockHoy

    // Recorrer fechas de atrás para adelante
    for (let i = dates.length - 1; i >= 0; i--) {
      const fecha = dates[i]
      dayStocks.set(fecha, round2(currentStock))

      // Para el día anterior: sumar ventas del día, restar ingresos del día
      const ventasDia = ventasByDateArt.get(fecha)?.get(art) ?? 0
      const ingresosDia = ingresosByDateArt.get(fecha)?.get(art) ?? 0
      currentStock = currentStock + ventasDia - ingresosDia
    }

    stockArtByDate.set(art, dayStocks)
  }

  // Agregar evolución total (suma de todos los artículos por día)
  const evolucion: KardexDia[] = []
  let totalVentas = 0
  let totalIngresos = 0

  for (const fecha of dates) {
    let stockDia = 0
    let ingDia = 0
    let ventDia = 0

    for (const art of allArts) {
      stockDia += stockArtByDate.get(art)?.get(fecha) ?? 0
      ventDia += ventasByDateArt.get(fecha)?.get(art) ?? 0
      ingDia += ingresosByDateArt.get(fecha)?.get(art) ?? 0
    }

    totalVentas += ventDia
    totalIngresos += ingDia

    evolucion.push({
      fecha,
      stockEstimado: round2(stockDia),
      ingresos: round2(ingDia),
      ventas: round2(ventDia),
    })
  }

  const stockHoyTotal = round2([...stockByArt.values()].reduce((s, r) => s + r.bultos, 0))
  const stockEstimadoInicio = evolucion.length > 0 ? evolucion[0].stockEstimado : stockHoyTotal

  // Tabla por SKU
  const porSku: KardexSku[] = []
  for (const art of allArts) {
    const stockHoy = stockByArt.get(art)?.bultos ?? 0
    const desc = stockByArt.get(art)?.descripcion ?? ""
    const info = getSkuInfo(art)

    let vendido = 0
    let ingresado = 0
    for (const fecha of dates) {
      vendido += ventasByDateArt.get(fecha)?.get(art) ?? 0
      ingresado += ingresosByDateArt.get(fecha)?.get(art) ?? 0
    }

    const stockInicio = round2(stockHoy + vendido - ingresado)

    porSku.push({
      articulo: art,
      descripcion: desc || info?.descripcion || art,
      division: info?.division ?? "",
      stockHoy: round2(stockHoy),
      vendido: round2(vendido),
      ingresado: round2(ingresado),
      stockInicio,
    })
  }

  porSku.sort((a, b) => b.vendido - a.vendido)

  // Detalle de un SKU específico
  let detalleSku: KardexDia[] | null = null
  if (articuloFiltro) {
    detalleSku = dates.map((fecha) => ({
      fecha,
      stockEstimado: stockArtByDate.get(articuloFiltro)?.get(fecha) ?? 0,
      ingresos: round2(ingresosByDateArt.get(fecha)?.get(articuloFiltro) ?? 0),
      ventas: round2(ventasByDateArt.get(fecha)?.get(articuloFiltro) ?? 0),
    }))
  }

  return {
    evolucion,
    porSku,
    detalleSku,
    totales: {
      stockHoy: stockHoyTotal,
      totalVentas: round2(totalVentas),
      totalIngresos: round2(totalIngresos),
      stockEstimadoInicio: round2(stockEstimadoInicio),
    },
    mes: m,
    anio: a,
    timestamp: new Date().toISOString(),
  }
}
