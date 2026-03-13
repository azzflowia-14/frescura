"use server"

import { query } from "@/lib/db"
import { getVpdChess } from "@/actions/vpd-chess"
import {
  getSkuInfo,
  bultosToHl,
  unidadesToHl,
  clasificacion,
  getEspeciales,
  ESPECIAL_LABELS,
  type CategoriaEspecial,
} from "@/lib/sku"
import {
  getDiasHabiles,
  getDiasHabilesHastaHoy,
  getDiasHabilesRestantes,
} from "@/lib/dias-habiles"
import * as fs from "fs"
import * as path from "path"

// ─── Objetivos (JSON local) ───────────────────────────────────────────

interface Objetivos {
  cervezas: number
  nabs: number
}

const OBJ_PATH = path.join(process.cwd(), "src/data/objetivos.json")

function readObjetivosFile(): Record<string, Objetivos> {
  try {
    const raw = fs.readFileSync(OBJ_PATH, "utf-8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function getObjetivos(mes: number, anio: number): Promise<Objetivos> {
  const key = `${anio}-${String(mes).padStart(2, "0")}`
  const data = readObjetivosFile()
  return data[key] || { cervezas: 0, nabs: 0 }
}

export async function saveObjetivos(
  mes: number,
  anio: number,
  cervezas: number,
  nabs: number
): Promise<{ ok: boolean }> {
  const key = `${anio}-${String(mes).padStart(2, "0")}`
  const data = readObjetivosFile()
  data[key] = { cervezas, nabs }
  fs.writeFileSync(OBJ_PATH, JSON.stringify(data, null, 2))
  return { ok: true }
}

// ─── Informe Gerencial ────────────────────────────────────────────────

export interface StockHlItem {
  articulo: string
  descripcion: string
  division: string
  marca: string
  bultos: number
  hl: number
  clasificacion: "cervezas" | "nabs" | "otro"
}

export interface EspecialItem {
  articulo: string
  descripcion: string
  marca: string
  stockHl: number
  vpd7Hl: number
  diasCobertura: number | null
  semaforo: "verde" | "amarillo" | "rojo" | "sin-datos"
}

export interface GerencialData {
  mes: number
  anio: number
  // Stock
  stockCervezasHl: number
  stockNabsHl: number
  stockTotalHl: number
  stockItems: StockHlItem[]
  stockPorDivision: { division: string; hl: number }[]
  // Objetivos
  objetivos: Objetivos
  diasHabilesTotales: number
  diasHabilesTranscurridos: number
  diasHabilesRestantes: number
  // VPM
  vpmCervezas: number
  vpmNabs: number
  // Días de piso
  diasPisoCervezas: number | null
  diasPisoNabs: number | null
  // Especiales
  especiales: Record<CategoriaEspecial, { label: string; items: EspecialItem[]; totalHl: number }>
  timestamp: string
}

export async function getGerencialData(
  mes?: number,
  anio?: number
): Promise<GerencialData> {
  const hoy = new Date()
  const m = mes ?? hoy.getMonth() + 1
  const a = anio ?? hoy.getFullYear()

  // Parallel: stock from WMS + VPD 7 days from Chess + objectives
  const [stockRows, vpd7, objetivos] = await Promise.all([
    query<{
      Articulo: string
      Descripción: string
      Cantidad: number
    }>(`
      SELECT Articulo, Descripción, SUM(Cantidad) as Cantidad
      FROM dbo.ConsultaStock
      WHERE Cantidad > 0
      GROUP BY Articulo, Descripción
    `),
    getVpdChess(7),
    getObjetivos(m, a),
  ])

  // Convert stock to HL
  const stockItems: StockHlItem[] = []
  let stockCervezasHl = 0
  let stockNabsHl = 0
  const divHlMap = new Map<string, number>()

  for (const row of stockRows) {
    const art = row.Articulo?.trim()
    if (!art) continue
    const info = getSkuInfo(art)
    const upb = info?.unidadesPorBulto ?? 1
    const bultos = upb > 1 ? row.Cantidad / upb : row.Cantidad
    const hl = unidadesToHl(art, row.Cantidad)
    const clasif = clasificacion(art)

    stockItems.push({
      articulo: art,
      descripcion: row.Descripción?.trim() ?? "",
      division: info?.division ?? "",
      marca: info?.marca ?? "",
      bultos: Math.round(bultos * 100) / 100,
      hl: Math.round(hl * 100) / 100,
      clasificacion: clasif,
    })

    if (clasif === "cervezas") stockCervezasHl += hl
    if (clasif === "nabs") stockNabsHl += hl

    const div = info?.division ?? "Sin clasificar"
    divHlMap.set(div, (divHlMap.get(div) || 0) + hl)
  }

  stockCervezasHl = Math.round(stockCervezasHl * 100) / 100
  stockNabsHl = Math.round(stockNabsHl * 100) / 100

  const stockPorDivision = Array.from(divHlMap.entries())
    .map(([division, hl]) => ({ division, hl: Math.round(hl * 100) / 100 }))
    .sort((a, b) => b.hl - a.hl)

  // Días hábiles
  const diasHabilesTotales = getDiasHabiles(m, a)
  const diasHabilesTranscurridos = getDiasHabilesHastaHoy(m, a)
  const diasHabilesRest = getDiasHabilesRestantes(m, a)

  // VPM (Venta Promedio por día hábil del Mes)
  const vpmCervezas = diasHabilesTotales > 0 ? Math.round((objetivos.cervezas / diasHabilesTotales) * 100) / 100 : 0
  const vpmNabs = diasHabilesTotales > 0 ? Math.round((objetivos.nabs / diasHabilesTotales) * 100) / 100 : 0

  // Días de piso
  const diasPisoCervezas = vpmCervezas > 0 ? Math.round((stockCervezasHl / vpmCervezas) * 10) / 10 : null
  const diasPisoNabs = vpmNabs > 0 ? Math.round((stockNabsHl / vpmNabs) * 10) / 10 : null

  // Productos especiales with VPD 7 days in HL
  const especialesSku = getEspeciales()
  const especiales = {} as GerencialData["especiales"]

  for (const [cat, skus] of Object.entries(especialesSku) as [CategoriaEspecial, typeof especialesSku[CategoriaEspecial]][]) {
    const items: EspecialItem[] = []
    let totalHl = 0

    for (const sku of skus) {
      // Find stock for this article
      const stockItem = stockItems.find((s) => s.articulo === sku.articulo)
      const sHl = stockItem?.hl ?? 0
      totalHl += sHl

      // VPD from Chess (7 days)
      const vpdItem = vpd7.vpd[sku.articulo]
      const vpdBultos = vpdItem?.vpdBultos ?? 0
      const vpd7Hl = bultosToHl(sku.articulo, vpdBultos)

      const diasCobertura = vpd7Hl > 0 ? Math.round((sHl / vpd7Hl) * 10) / 10 : null

      let semaforo: EspecialItem["semaforo"] = "sin-datos"
      if (diasCobertura !== null) {
        if (diasCobertura <= 3) semaforo = "rojo"
        else if (diasCobertura <= 7) semaforo = "amarillo"
        else semaforo = "verde"
      }

      items.push({
        articulo: sku.articulo,
        descripcion: sku.descripcion,
        marca: sku.marca,
        stockHl: Math.round(sHl * 1000) / 1000,
        vpd7Hl: Math.round(vpd7Hl * 1000) / 1000,
        diasCobertura,
        semaforo,
      })
    }

    // Only include items that have stock
    const withStock = items.filter((i) => i.stockHl > 0)
    withStock.sort((a, b) => (a.diasCobertura ?? 999) - (b.diasCobertura ?? 999))

    especiales[cat] = {
      label: ESPECIAL_LABELS[cat],
      items: withStock,
      totalHl: Math.round(totalHl * 100) / 100,
    }
  }

  return {
    mes: m,
    anio: a,
    stockCervezasHl,
    stockNabsHl,
    stockTotalHl: Math.round((stockCervezasHl + stockNabsHl) * 100) / 100,
    stockItems,
    stockPorDivision,
    objetivos,
    diasHabilesTotales,
    diasHabilesTranscurridos,
    diasHabilesRestantes: diasHabilesRest,
    vpmCervezas,
    vpmNabs,
    diasPisoCervezas,
    diasPisoNabs,
    especiales,
    timestamp: new Date().toISOString(),
  }
}
