"use server"

import { query } from "@/lib/db"
import { getVpdChess } from "@/actions/vpd-chess"
import { getSkuInfo, bultosToHl, getUnidadesPorBulto } from "@/lib/sku"

export interface AnalisisItem {
  articulo: string
  descripcion: string
  division: string
  marca: string
  bultosStock: number
  hlStock: number
  vpdBultos: number
  diasRestantes: number | null
  diasPiso: number | null
  clasificacion: "ok" | "sobre-stock" | "sub-stock" | "sin-venta" | "sin-stock"
}

export interface AnalisisData {
  items: AnalisisItem[]
  totales: {
    analizados: number
    sobreStock: number
    subStock: number
    sinVenta: number
    ok: number
  }
  porDivision: { division: string; count: number; hlStock: number; avgDiasRestantes: number }[]
  pareto: { articulo: string; descripcion: string; hl: number; acumuladoPct: number }[]
  timestamp: string
}

export async function getAnalisisData(): Promise<AnalisisData> {
  const [stockRows, vpd30] = await Promise.all([
    query<{
      Articulo: string
      Descripción: string
      Cantidad: number
      Vencimiento: string
    }>(`
      SELECT Articulo, Descripción, Cantidad, Vencimiento
      FROM dbo.ConsultaStock
      WHERE Cantidad > 0
    `),
    getVpdChess(30),
  ])

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Group stock by article
  const artMap = new Map<string, {
    descripcion: string
    unidades: number
    minDiasRestantes: number | null
  }>()

  for (const r of stockRows) {
    const art = r.Articulo?.trim()
    if (!art) continue
    const existing = artMap.get(art)
    let dias: number | null = null
    if (r.Vencimiento) {
      const venc = parseDate(String(r.Vencimiento))
      if (venc) dias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    }
    if (existing) {
      existing.unidades += r.Cantidad || 0
      if (dias !== null && (existing.minDiasRestantes === null || dias < existing.minDiasRestantes)) {
        existing.minDiasRestantes = dias
      }
    } else {
      artMap.set(art, {
        descripcion: r.Descripción?.trim() ?? "",
        unidades: r.Cantidad || 0,
        minDiasRestantes: dias,
      })
    }
  }

  // Build analysis items
  const items: AnalisisItem[] = []
  let totalHl = 0

  for (const [art, data] of artMap) {
    const info = getSkuInfo(art)
    const upb = getUnidadesPorBulto(art)
    const bultos = upb > 1 ? data.unidades / upb : data.unidades
    const hl = bultosToHl(art, bultos)
    totalHl += hl

    const vpdItem = vpd30.vpd[art]
    const vpdBultos = vpdItem?.vpdBultos ?? 0
    const diasPiso = vpdBultos > 0 ? Math.round((bultos / vpdBultos) * 10) / 10 : null

    let clasificacion: AnalisisItem["clasificacion"]
    if (vpdBultos <= 0) {
      clasificacion = "sin-venta"
    } else if (diasPiso !== null && diasPiso > 60) {
      clasificacion = "sobre-stock"
    } else if (diasPiso !== null && diasPiso < 7) {
      clasificacion = "sub-stock"
    } else {
      clasificacion = "ok"
    }

    items.push({
      articulo: art,
      descripcion: data.descripcion,
      division: info?.division ?? "",
      marca: info?.marca ?? "",
      bultosStock: Math.round(bultos * 100) / 100,
      hlStock: Math.round(hl * 100) / 100,
      vpdBultos: Math.round(vpdBultos * 100) / 100,
      diasRestantes: data.minDiasRestantes,
      diasPiso,
      clasificacion,
    })
  }

  // Totales
  const totales = {
    analizados: items.length,
    sobreStock: items.filter((i) => i.clasificacion === "sobre-stock").length,
    subStock: items.filter((i) => i.clasificacion === "sub-stock").length,
    sinVenta: items.filter((i) => i.clasificacion === "sin-venta").length,
    ok: items.filter((i) => i.clasificacion === "ok").length,
  }

  // Por división
  const divMap = new Map<string, { count: number; hlStock: number; sumDias: number; countDias: number }>()
  for (const item of items) {
    const div = item.division || "Sin clasificar"
    const existing = divMap.get(div) || { count: 0, hlStock: 0, sumDias: 0, countDias: 0 }
    existing.count++
    existing.hlStock += item.hlStock
    if (item.diasRestantes !== null) {
      existing.sumDias += item.diasRestantes
      existing.countDias++
    }
    divMap.set(div, existing)
  }
  const porDivision = Array.from(divMap.entries())
    .map(([division, d]) => ({
      division,
      count: d.count,
      hlStock: Math.round(d.hlStock * 100) / 100,
      avgDiasRestantes: d.countDias > 0 ? Math.round(d.sumDias / d.countDias) : 0,
    }))
    .sort((a, b) => b.hlStock - a.hlStock)

  // Pareto (top 50 by HL, with accumulated %)
  const sortedByHl = [...items].sort((a, b) => b.hlStock - a.hlStock)
  let acum = 0
  const pareto = sortedByHl.slice(0, 50).map((item) => {
    acum += item.hlStock
    return {
      articulo: item.articulo,
      descripcion: item.descripcion,
      hl: item.hlStock,
      acumuladoPct: totalHl > 0 ? Math.round((acum / totalHl) * 10000) / 100 : 0,
    }
  })

  return {
    items,
    totales,
    porDivision,
    pareto,
    timestamp: new Date().toISOString(),
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
