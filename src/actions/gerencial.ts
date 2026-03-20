"use server"

import { query } from "@/lib/db"
import { getVpdChess } from "@/actions/vpd-chess"
import { getChessStock } from "@/lib/chess"
import { loadKardexMes } from "@/lib/kardex"
import {
  getSkuInfo,
  bultosToHl,
  esMercaderia,
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

// ─── Snapshots diarios (stock + piso) ──────────────────────────────────

export interface SnapshotDiario {
  fecha: string // YYYY-MM-DD
  stockCervezasHl: number
  stockNabsHl: number
  diasPisoCervezas: number | null
  diasPisoNabs: number | null
}

const SNAPSHOT_PATH = path.join(process.cwd(), "src/data/stock-diario.json")

function readSnapshots(): SnapshotDiario[] {
  try {
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveSnapshot(snap: SnapshotDiario) {
  const all = readSnapshots()
  const idx = all.findIndex((s) => s.fecha === snap.fecha)
  if (idx >= 0) {
    all[idx] = snap // update today
  } else {
    all.push(snap)
  }
  all.sort((a, b) => a.fecha.localeCompare(b.fecha))
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(all, null, 2))
}

export async function getSnapshots(): Promise<SnapshotDiario[]> {
  return readSnapshots()
}

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
  vpd7Hl: number
  diasPiso: number | null
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

export interface IngresoDia {
  fecha: string
  bultos: number
  hlCervezas: number
  hlNabs: number
  acumCervezas: number
  acumNabs: number
}

export interface IngresoSkuItem {
  articulo: string
  descripcion: string
  bultos: number
  hl: number
  clasificacion: "cervezas" | "nabs" | "otro"
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
  // Ingresos del mes (cumplimiento objetivos)
  ingresos: IngresoDia[]
  ingresoCervezasHl: number
  ingresoNabsHl: number
  cumplimientoCervezas: number // porcentaje 0-100
  cumplimientoNabs: number
  // Ingresos por SKU (para modal detalle)
  ingresosPorSku: IngresoSkuItem[]
  // Especiales
  especiales: Record<CategoriaEspecial, { label: string; items: EspecialItem[]; totalHl: number }>
  // Snapshots diarios (evolución stock + piso)
  snapshots: SnapshotDiario[]
  timestamp: string
}

export async function getGerencialData(
  mes?: number,
  anio?: number
): Promise<GerencialData> {
  const hoy = new Date()
  const m = mes ?? hoy.getMonth() + 1
  const a = anio ?? hoy.getFullYear()

  // Date range for current month
  const mesStr = String(m).padStart(2, "0")
  const fechaDesde = `${a}-${mesStr}-01`
  const siguienteMes = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`

  // Try kardex first (Excel upload), fallback to Chess+WMS
  const kardexData = loadKardexMes(m, a)

  const [chessStock, vpd7, objetivos, ingresosRawWms] = await Promise.all([
    kardexData ? Promise.resolve([]) : getChessStock(),
    getVpdChess(7),
    getObjetivos(m, a),
    kardexData
      ? Promise.resolve([])
      : query<{ fecha: string; art: string; bultos: number }>(`
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

  // Ingresos: from kardex (REMITO + REM.CONSIG.) or WMS fallback
  let ingresosRaw: { fecha: string; art: string; bultos: number }[]
  if (kardexData) {
    const ingMap = new Map<string, number>()
    for (const mov of kardexData.movimientos) {
      if (mov.concepto !== "REMITO" && mov.concepto !== "REM.CONSIG.") continue
      const key = `${mov.fecha}|${mov.codigo}`
      ingMap.set(key, (ingMap.get(key) || 0) + Math.abs(mov.movBultos))
    }
    ingresosRaw = [...ingMap.entries()].map(([key, bultos]) => {
      const [fecha, art] = key.split("|")
      return { fecha, art, bultos }
    })
  } else {
    ingresosRaw = ingresosRawWms
  }

  // Aggregate stock by article
  const artAgg = new Map<string, { descripcion: string; bultos: number }>()
  if (kardexData) {
    for (const r of kardexData.resumenArticulos) {
      if (!esMercaderia(r.codigo)) continue
      if (r.saldoFinal <= 0) continue
      artAgg.set(r.codigo, { descripcion: r.descripcion, bultos: r.saldoFinal })
    }
  } else {
    for (const row of chessStock) {
      const art = String(row.idArticulo).trim()
      if (!art) continue
      if (!esMercaderia(art)) continue
      const existing = artAgg.get(art)
      const bultos = Number(row.cantBultos) || 0
      if (bultos <= 0) continue
      if (existing) {
        existing.bultos += bultos
      } else {
        artAgg.set(art, { descripcion: String(row.dsArticulo || "").trim(), bultos })
      }
    }
  }

  // Convert stock to HL
  const stockItems: StockHlItem[] = []
  let stockCervezasHl = 0
  let stockNabsHl = 0
  const divHlMap = new Map<string, number>()

  for (const [art, data] of artAgg) {
    const info = getSkuInfo(art)
    const bultos = data.bultos
    const hl = bultosToHl(art, bultos)
    const clasif = clasificacion(art)

    // VPD 7 days for this SKU
    const vpdItem = vpd7.vpd[art]
    const vpdBultos = vpdItem?.vpdBultos ?? 0
    const vpd7Hl = Math.round(bultosToHl(art, vpdBultos) * 1000) / 1000
    const diasPisoSku = vpd7Hl > 0 ? Math.round((hl / vpd7Hl) * 10) / 10 : null

    stockItems.push({
      articulo: art,
      descripcion: data.descripcion,
      division: info?.division ?? "",
      marca: info?.marca ?? "",
      bultos: Math.round(bultos * 100) / 100,
      hl: Math.round(hl * 100) / 100,
      clasificacion: clasif,
      vpd7Hl,
      diasPiso: diasPisoSku,
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

  // Ingresos del mes (PLTCBC + PLTDTL from WMS)
  const ingDiaMap = new Map<string, { bultos: number; hlCerv: number; hlNabs: number }>()
  const ingSkuMap = new Map<string, { descripcion: string; bultos: number; hl: number; clasificacion: "cervezas" | "nabs" | "otro" }>()
  let ingresoCervezasHl = 0
  let ingresoNabsHl = 0

  for (const r of ingresosRaw) {
    const art = r.art?.trim()
    if (!art || !esMercaderia(art)) continue
    const hl = bultosToHl(art, r.bultos)
    const clasif = clasificacion(art)
    const existing = ingDiaMap.get(r.fecha) || { bultos: 0, hlCerv: 0, hlNabs: 0 }
    existing.bultos += r.bultos
    if (clasif === "cervezas") { existing.hlCerv += hl; ingresoCervezasHl += hl }
    if (clasif === "nabs") { existing.hlNabs += hl; ingresoNabsHl += hl }
    ingDiaMap.set(r.fecha, existing)

    // Acumular por SKU
    const skuExisting = ingSkuMap.get(art)
    const info = getSkuInfo(art)
    if (skuExisting) {
      skuExisting.bultos += r.bultos
      skuExisting.hl += hl
    } else {
      ingSkuMap.set(art, { descripcion: info?.descripcion ?? art, bultos: r.bultos, hl, clasificacion: clasif })
    }
  }

  ingresoCervezasHl = Math.round(ingresoCervezasHl * 10) / 10
  ingresoNabsHl = Math.round(ingresoNabsHl * 10) / 10

  let acumC = 0, acumN = 0
  const ingresos: IngresoDia[] = [...ingDiaMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, d]) => {
    acumC += d.hlCerv
    acumN += d.hlNabs
    return {
      fecha,
      bultos: d.bultos,
      hlCervezas: Math.round(d.hlCerv * 10) / 10,
      hlNabs: Math.round(d.hlNabs * 10) / 10,
      acumCervezas: Math.round(acumC * 10) / 10,
      acumNabs: Math.round(acumN * 10) / 10,
    }
  })

  const cumplimientoCervezas = objetivos.cervezas > 0 ? Math.round((ingresoCervezasHl / objetivos.cervezas) * 1000) / 10 : 0
  const cumplimientoNabs = objetivos.nabs > 0 ? Math.round((ingresoNabsHl / objetivos.nabs) * 1000) / 10 : 0

  const ingresosPorSku: IngresoSkuItem[] = Array.from(ingSkuMap.entries())
    .map(([articulo, d]) => ({
      articulo,
      descripcion: d.descripcion,
      bultos: Math.round(d.bultos * 100) / 100,
      hl: Math.round(d.hl * 100) / 100,
      clasificacion: d.clasificacion,
    }))
    .sort((a, b) => b.hl - a.hl)

  // ── Snapshots: calcular desde Kardex si disponible, sino JSON legacy ──
  let snapshots: SnapshotDiario[]

  if (kardexData) {
    // Reconstruir evolución diaria de stock separado por cervezas/NABS desde Kardex
    const fechasKardex = [...new Set(kardexData.movimientos.map(mv => mv.fecha))].sort()
    const artCodes = [...new Set(kardexData.movimientos.map(mv => mv.codigo))]

    // Inicializar saldo por artículo con saldo inicial
    const lastSaldoArt = new Map<string, number>()
    for (const mv of kardexData.movimientos) {
      if (mv.concepto === "SALDO INICIAL") {
        lastSaldoArt.set(mv.codigo, mv.saldoBultos)
      }
    }
    // Asegurar todos los artículos tienen saldo inicial (0 si no hubo SALDO INICIAL)
    for (const code of artCodes) {
      if (!lastSaldoArt.has(code)) lastSaldoArt.set(code, 0)
    }

    snapshots = []
    for (const fecha of fechasKardex) {
      // Actualizar saldos con movimientos del día
      const dayMovs = kardexData.movimientos.filter(mv => mv.fecha === fecha && mv.concepto !== "RECUENTO")
      // Agrupar por artículo, tomar el último saldoBultos del día
      const artDaySaldo = new Map<string, number>()
      for (const mv of dayMovs) {
        artDaySaldo.set(mv.codigo, mv.saldoBultos)
      }
      // Actualizar lastSaldoArt con los saldos finales del día
      for (const [code, saldo] of artDaySaldo) {
        lastSaldoArt.set(code, saldo)
      }

      // Calcular stock HL separado por clasificación
      let stockCervHl = 0
      let stockNabsHl2 = 0
      for (const [code, saldo] of lastSaldoArt) {
        if (saldo <= 0) continue
        if (!esMercaderia(code)) continue
        const hl = bultosToHl(code, saldo)
        const clasif = clasificacion(code)
        if (clasif === "cervezas") stockCervHl += hl
        if (clasif === "nabs") stockNabsHl2 += hl
      }

      stockCervHl = Math.round(stockCervHl * 100) / 100
      stockNabsHl2 = Math.round(stockNabsHl2 * 100) / 100

      const dpCerv = vpmCervezas > 0 ? Math.round((stockCervHl / vpmCervezas) * 10) / 10 : null
      const dpNabs = vpmNabs > 0 ? Math.round((stockNabsHl2 / vpmNabs) * 10) / 10 : null

      snapshots.push({
        fecha,
        stockCervezasHl: stockCervHl,
        stockNabsHl: stockNabsHl2,
        diasPisoCervezas: dpCerv,
        diasPisoNabs: dpNabs,
      })
    }
  } else {
    // Fallback: snapshots del JSON legacy + auto-save hoy
    const hoyStr = hoy.toISOString().slice(0, 10)
    const esMesActual = m === hoy.getMonth() + 1 && a === hoy.getFullYear()
    if (esMesActual) {
      saveSnapshot({
        fecha: hoyStr,
        stockCervezasHl,
        stockNabsHl,
        diasPisoCervezas,
        diasPisoNabs,
      })
    }
    snapshots = readSnapshots()
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
    ingresos,
    ingresoCervezasHl,
    ingresoNabsHl,
    cumplimientoCervezas,
    cumplimientoNabs,
    ingresosPorSku,
    especiales,
    snapshots,
    timestamp: new Date().toISOString(),
  }
}
