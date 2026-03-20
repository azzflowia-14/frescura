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
  type Clasificacion,
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
  stockAguasHl: number
  stockUngHl: number
  diasPisoCervezas: number | null
  diasPisoAguas: number | null
  diasPisoUng: number | null
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
  aguas: number
  ung: number
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
  const obj = data[key]
  if (!obj) return { cervezas: 0, aguas: 0, ung: 0 }
  // Migración: si tiene "nabs" legacy, repartir en aguas=0 y ung=nabs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = obj as any
  if ("nabs" in raw && !("aguas" in raw)) {
    return { cervezas: Number(raw.cervezas) || 0, aguas: 0, ung: Number(raw.nabs) || 0 }
  }
  return { cervezas: Number(raw.cervezas) || 0, aguas: Number(raw.aguas) || 0, ung: Number(raw.ung) || 0 }
}

export async function saveObjetivos(
  mes: number,
  anio: number,
  cervezas: number,
  aguas: number,
  ung: number
): Promise<{ ok: boolean }> {
  const key = `${anio}-${String(mes).padStart(2, "0")}`
  const data = readObjetivosFile()
  data[key] = { cervezas, aguas, ung }
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
  clasificacion: Clasificacion
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
  hlAguas: number
  hlUng: number
  acumCervezas: number
  acumAguas: number
  acumUng: number
}

export interface IngresoSkuItem {
  articulo: string
  descripcion: string
  bultos: number
  hl: number
  clasificacion: Clasificacion
}

export interface GerencialData {
  mes: number
  anio: number
  // Stock
  stockCervezasHl: number
  stockAguasHl: number
  stockUngHl: number
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
  vpmAguas: number
  vpmUng: number
  // Días de piso
  diasPisoCervezas: number | null
  diasPisoAguas: number | null
  diasPisoUng: number | null
  // Ingresos del mes (cumplimiento objetivos)
  ingresos: IngresoDia[]
  ingresoCervezasHl: number
  ingresoAguasHl: number
  ingresoUngHl: number
  cumplimientoCervezas: number // porcentaje 0-100
  cumplimientoAguas: number
  cumplimientoUng: number
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
  let stockAguasHl = 0
  let stockUngHl = 0
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
    if (clasif === "aguas") stockAguasHl += hl
    if (clasif === "ung") stockUngHl += hl

    const div = info?.division ?? "Sin clasificar"
    divHlMap.set(div, (divHlMap.get(div) || 0) + hl)
  }

  stockCervezasHl = Math.round(stockCervezasHl * 100) / 100
  stockAguasHl = Math.round(stockAguasHl * 100) / 100
  stockUngHl = Math.round(stockUngHl * 100) / 100

  const stockPorDivision = Array.from(divHlMap.entries())
    .map(([division, hl]) => ({ division, hl: Math.round(hl * 100) / 100 }))
    .sort((a, b) => b.hl - a.hl)

  // Días hábiles
  const diasHabilesTotales = getDiasHabiles(m, a)
  const diasHabilesTranscurridos = getDiasHabilesHastaHoy(m, a)
  const diasHabilesRest = getDiasHabilesRestantes(m, a)

  // VPM (Venta Promedio por día hábil del Mes)
  const vpmCervezas = diasHabilesTotales > 0 ? Math.round((objetivos.cervezas / diasHabilesTotales) * 100) / 100 : 0
  const vpmAguas = diasHabilesTotales > 0 ? Math.round((objetivos.aguas / diasHabilesTotales) * 100) / 100 : 0
  const vpmUng = diasHabilesTotales > 0 ? Math.round((objetivos.ung / diasHabilesTotales) * 100) / 100 : 0

  // Días de piso
  const diasPisoCervezas = vpmCervezas > 0 ? Math.round((stockCervezasHl / vpmCervezas) * 10) / 10 : null
  const diasPisoAguas = vpmAguas > 0 ? Math.round((stockAguasHl / vpmAguas) * 10) / 10 : null
  const diasPisoUng = vpmUng > 0 ? Math.round((stockUngHl / vpmUng) * 10) / 10 : null

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

  // Ingresos del mes
  const ingDiaMap = new Map<string, { bultos: number; hlCerv: number; hlAguas: number; hlUng: number }>()
  const ingSkuMap = new Map<string, { descripcion: string; bultos: number; hl: number; clasificacion: Clasificacion }>()
  let ingresoCervezasHl = 0
  let ingresoAguasHl = 0
  let ingresoUngHl = 0

  for (const r of ingresosRaw) {
    const art = r.art?.trim()
    if (!art || !esMercaderia(art)) continue
    const hl = bultosToHl(art, r.bultos)
    const clasif = clasificacion(art)
    const existing = ingDiaMap.get(r.fecha) || { bultos: 0, hlCerv: 0, hlAguas: 0, hlUng: 0 }
    existing.bultos += r.bultos
    if (clasif === "cervezas") { existing.hlCerv += hl; ingresoCervezasHl += hl }
    if (clasif === "aguas") { existing.hlAguas += hl; ingresoAguasHl += hl }
    if (clasif === "ung") { existing.hlUng += hl; ingresoUngHl += hl }
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
  ingresoAguasHl = Math.round(ingresoAguasHl * 10) / 10
  ingresoUngHl = Math.round(ingresoUngHl * 10) / 10

  let acumC = 0, acumA = 0, acumU = 0
  const ingresos: IngresoDia[] = [...ingDiaMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, d]) => {
    acumC += d.hlCerv
    acumA += d.hlAguas
    acumU += d.hlUng
    return {
      fecha,
      bultos: d.bultos,
      hlCervezas: Math.round(d.hlCerv * 10) / 10,
      hlAguas: Math.round(d.hlAguas * 10) / 10,
      hlUng: Math.round(d.hlUng * 10) / 10,
      acumCervezas: Math.round(acumC * 10) / 10,
      acumAguas: Math.round(acumA * 10) / 10,
      acumUng: Math.round(acumU * 10) / 10,
    }
  })

  const cumplimientoCervezas = objetivos.cervezas > 0 ? Math.round((ingresoCervezasHl / objetivos.cervezas) * 1000) / 10 : 0
  const cumplimientoAguas = objetivos.aguas > 0 ? Math.round((ingresoAguasHl / objetivos.aguas) * 1000) / 10 : 0
  const cumplimientoUng = objetivos.ung > 0 ? Math.round((ingresoUngHl / objetivos.ung) * 1000) / 10 : 0

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
    // Reconstruir evolución diaria de stock separado por cervezas/aguas/ung desde Kardex
    const fechasKardex = [...new Set(kardexData.movimientos.map(mv => mv.fecha))].sort()
    const artCodes = [...new Set(kardexData.movimientos.map(mv => mv.codigo))]

    // Inicializar saldo por artículo con saldo inicial
    const lastSaldoArt = new Map<string, number>()
    for (const mv of kardexData.movimientos) {
      if (mv.concepto === "SALDO INICIAL") {
        lastSaldoArt.set(mv.codigo, mv.saldoBultos)
      }
    }
    for (const code of artCodes) {
      if (!lastSaldoArt.has(code)) lastSaldoArt.set(code, 0)
    }

    snapshots = []
    for (const fecha of fechasKardex) {
      const dayMovs = kardexData.movimientos.filter(mv => mv.fecha === fecha && mv.concepto !== "RECUENTO")
      const artDaySaldo = new Map<string, number>()
      for (const mv of dayMovs) {
        artDaySaldo.set(mv.codigo, mv.saldoBultos)
      }
      for (const [code, saldo] of artDaySaldo) {
        lastSaldoArt.set(code, saldo)
      }

      let snapCervHl = 0
      let snapAguasHl = 0
      let snapUngHl = 0
      for (const [code, saldo] of lastSaldoArt) {
        if (saldo <= 0) continue
        if (!esMercaderia(code)) continue
        const hl = bultosToHl(code, saldo)
        const clasif = clasificacion(code)
        if (clasif === "cervezas") snapCervHl += hl
        if (clasif === "aguas") snapAguasHl += hl
        if (clasif === "ung") snapUngHl += hl
      }

      snapCervHl = Math.round(snapCervHl * 100) / 100
      snapAguasHl = Math.round(snapAguasHl * 100) / 100
      snapUngHl = Math.round(snapUngHl * 100) / 100

      const dpCerv = vpmCervezas > 0 ? Math.round((snapCervHl / vpmCervezas) * 10) / 10 : null
      const dpAguas = vpmAguas > 0 ? Math.round((snapAguasHl / vpmAguas) * 10) / 10 : null
      const dpUng = vpmUng > 0 ? Math.round((snapUngHl / vpmUng) * 10) / 10 : null

      snapshots.push({
        fecha,
        stockCervezasHl: snapCervHl,
        stockAguasHl: snapAguasHl,
        stockUngHl: snapUngHl,
        diasPisoCervezas: dpCerv,
        diasPisoAguas: dpAguas,
        diasPisoUng: dpUng,
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
        stockAguasHl,
        stockUngHl,
        diasPisoCervezas,
        diasPisoAguas,
        diasPisoUng,
      })
    }
    snapshots = readSnapshots()
  }

  return {
    mes: m,
    anio: a,
    stockCervezasHl,
    stockAguasHl,
    stockUngHl,
    stockTotalHl: Math.round((stockCervezasHl + stockAguasHl + stockUngHl) * 100) / 100,
    stockItems,
    stockPorDivision,
    objetivos,
    diasHabilesTotales,
    diasHabilesTranscurridos,
    diasHabilesRestantes: diasHabilesRest,
    vpmCervezas,
    vpmAguas,
    vpmUng,
    diasPisoCervezas,
    diasPisoAguas,
    diasPisoUng,
    ingresos,
    ingresoCervezasHl,
    ingresoAguasHl,
    ingresoUngHl,
    cumplimientoCervezas,
    cumplimientoAguas,
    cumplimientoUng,
    ingresosPorSku,
    especiales,
    snapshots,
    timestamp: new Date().toISOString(),
  }
}
