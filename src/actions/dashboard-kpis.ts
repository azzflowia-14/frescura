"use server"

import { query } from "@/lib/db"

export interface DashboardKpis {
  // Stock
  skusEnStock: number
  unidadesTotales: number
  // Frescura
  productosVencidos: number
  productosCriticos: number // 0-15 días
  productosUrgentes: number // 16-30 días
  // FEFO
  fefoViolaciones: number
  // Ocupación
  ubicacionesOcupadas: number
  ubicacionesTotales: number
  porcentajeOcupacion: number
  // Despachos hoy
  despachosHoy: number
  entregasHoy: number
  // Productividad hoy
  operariosActivos: number
  unidadesMovidas: number
  // Quiebres
  articulosSinStock: number
  // Clientes afuera
  clientesAfuera: number
  // Extras
  timestamp: string
  errors: string[]
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const errors: string[] = []
  const hoy = new Date().toISOString().split("T")[0]

  // Ejecutar todas las queries en paralelo
  const [stockRes, fefoRes, ocupRes, despRes, prodRes, sinStockRes, clientesRes] = await Promise.allSettled([
    // 1. Stock + Frescura
    query<{ Articulo: string; Vencimiento: string; Cantidad: number }>(`
      SELECT Articulo, Vencimiento, Cantidad
      FROM dbo.ConsultaStock
      WHERE Cantidad > 0
    `).catch((e) => { errors.push(`Stock: ${e.message}`); return [] }),

    // 2. FEFO Vulnerado count
    query<{ cnt: number }>(`
      SELECT COUNT(*) as cnt FROM dbo.REPORTE_STOCK_FEFO_VULNERADO
    `).catch((e) => { errors.push(`FEFO: ${e.message}`); return [{ cnt: 0 }] }),

    // 3. Ocupación
    query<{ Articulo: string }>(`
      SELECT Articulo FROM dbo.OcupacionActualDeposito
    `).catch((e) => { errors.push(`Ocupación: ${e.message}`); return [] }),

    // 4. Despachos hoy
    query<{ Entregas: number }>(`
      SELECT Entregas FROM dbo.Vista_Orden_de_Salida
      WHERE CONVERT(date, FechaHoraSalida) = @fecha
    `, { fecha: hoy }).catch((e) => { errors.push(`Despachos: ${e.message}`); return [] }),

    // 5. Productividad hoy
    query<{ Usuario: string; ProduccionUnidades: number }>(`
      SELECT Usuario, COALESCE(ProducciónUnidades, 0) as ProduccionUnidades
      FROM dbo.Vista_Productividad_Diaria
      WHERE CONVERT(date, Fecha) = @fecha
    `, { fecha: hoy }).catch((e) => { errors.push(`Productividad: ${e.message}`); return [] }),

    // 6. Artículos sin stock
    query<{ cnt: number }>(`
      SELECT COUNT(*) as cnt FROM dbo.ArticulosSinStock
    `).catch((e) => { errors.push(`SinStock: ${e.message}`); return [{ cnt: 0 }] }),

    // 7. Clientes afuera
    query<{ cnt: number }>(`
      SELECT COUNT(*) as cnt FROM dbo.SGL_MERCOSUR_CLIENTES_QUEDARON_AFUERA_HOY
    `).catch((e) => { errors.push(`Clientes: ${e.message}`); return [{ cnt: 0 }] }),
  ])

  // Process stock + frescura
  const stockRows = stockRes.status === "fulfilled" ? (stockRes.value as { Articulo: string; Vencimiento: string; Cantidad: number }[]) : []
  const skus = new Set(stockRows.map((r) => r.Articulo))
  const unidadesTotales = stockRows.reduce((s, r) => s + (r.Cantidad || 0), 0)

  const ahora = new Date()
  ahora.setHours(0, 0, 0, 0)
  let vencidos = 0
  let criticos = 0
  let urgentes = 0
  const articulosVencimiento = new Map<string, number>()
  for (const r of stockRows) {
    if (!r.Vencimiento) continue
    const venc = parseDate(String(r.Vencimiento))
    if (!venc) continue
    const dias = Math.ceil((venc.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24))
    const art = r.Articulo
    const prev = articulosVencimiento.get(art)
    if (prev === undefined || dias < prev) articulosVencimiento.set(art, dias)
  }
  for (const dias of articulosVencimiento.values()) {
    if (dias < 0) vencidos++
    else if (dias <= 15) criticos++
    else if (dias <= 30) urgentes++
  }

  // FEFO
  const fefoRows = fefoRes.status === "fulfilled" ? (fefoRes.value as { cnt: number }[]) : [{ cnt: 0 }]
  const fefoViolaciones = fefoRows[0]?.cnt || 0

  // Ocupación
  const ocupRows = ocupRes.status === "fulfilled" ? (ocupRes.value as { Articulo: string }[]) : []
  const ubicacionesTotales = ocupRows.length
  const ubicacionesOcupadas = ocupRows.filter((r) => r.Articulo && String(r.Articulo).trim() !== "").length

  // Despachos
  const despRows = despRes.status === "fulfilled" ? (despRes.value as { Entregas: number }[]) : []
  const despachosHoy = despRows.length
  const entregasHoy = despRows.reduce((s, r) => s + (Number(r.Entregas) || 0), 0)

  // Productividad
  const prodRows = prodRes.status === "fulfilled" ? (prodRes.value as { Usuario: string; ProduccionUnidades: number }[]) : []
  const operariosSet = new Set(prodRows.map((r) => r.Usuario))
  const unidadesMovidas = prodRows.reduce((s, r) => s + (Number(r.ProduccionUnidades) || 0), 0)

  // Sin stock
  const sinStockRows = sinStockRes.status === "fulfilled" ? (sinStockRes.value as { cnt: number }[]) : [{ cnt: 0 }]

  // Clientes afuera
  const clientesRows = clientesRes.status === "fulfilled" ? (clientesRes.value as { cnt: number }[]) : [{ cnt: 0 }]

  return {
    skusEnStock: skus.size,
    unidadesTotales,
    productosVencidos: vencidos,
    productosCriticos: criticos,
    productosUrgentes: urgentes,
    fefoViolaciones,
    ubicacionesOcupadas,
    ubicacionesTotales,
    porcentajeOcupacion: ubicacionesTotales > 0 ? Math.round((ubicacionesOcupadas / ubicacionesTotales) * 100) : 0,
    despachosHoy,
    entregasHoy,
    operariosActivos: operariosSet.size,
    unidadesMovidas,
    articulosSinStock: sinStockRows[0]?.cnt || 0,
    clientesAfuera: clientesRows[0]?.cnt || 0,
    timestamp: new Date().toISOString(),
    errors,
  }
}

function parseDate(str: string): Date | null {
  if (!str) return null
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}
