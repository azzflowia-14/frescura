import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs"
import { join } from "path"

// ─── Types ──────────────────────────────────────────────────

export type KardexConcepto =
  | "SALDO INICIAL"
  | "REC.DEPOS."
  | "CARGA"
  | "DESCARGA"
  | "REMITO"
  | "ENV.DEPOS."
  | "SOBRANTE"
  | "FALTANTE"
  | "REM.CONSIG."
  | "DEVOLUCION"
  | "RECUENTO"

export interface KardexMovimiento {
  codigo: string
  descripcion: string
  fecha: string            // YYYY-MM-DD
  vctoLote: string | null
  concepto: string
  tipo: string
  serie: string
  numero: string
  movBultos: number        // negativo en CARGA
  movUnids: number
  movPeso: number
  saldoBultos: number      // balance corrido
  saldoUnids: number
  saldoPeso: number
  saldoCpp: number
  saldoImporte: number
  recuentoBultos: number | null
  recuentoUnids: number | null
  calcBultos: number | null
  calcUnids: number | null
}

export interface KardexArticuloResumen {
  codigo: string
  descripcion: string
  saldoInicial: number
  saldoFinal: number
  totalIngresos: number    // REC.DEPOS.
  totalCargas: number      // |CARGA| (absoluto)
  totalDescargas: number
  totalFaltantes: number
  totalSobrantes: number
  totalDevoluciones: number
  totalRemitos: number
  totalEnvDepos: number
  totalRemConsig: number
  recuentoBultos: number | null
  diferenciaRecuento: number | null
}

export interface KardexDiaAgregado {
  fecha: string
  stockFinal: number
  ingresos: number
  cargas: number
  descargas: number
  faltantes: number
  sobrantes: number
  devoluciones: number
}

export interface KardexMes {
  mes: number
  anio: number
  movimientos: KardexMovimiento[]
  resumenArticulos: KardexArticuloResumen[]
  evolucionDiaria: KardexDiaAgregado[]
  totales: {
    stockInicial: number
    stockFinal: number
    ingresos: number
    cargas: number
    descargas: number
    faltantes: number
    sobrantes: number
    devoluciones: number
  }
  articulosCount: number
  movimientosCount: number
  fechaDesde: string
  fechaHasta: string
  uploadedAt: string
}

// ─── Storage ────────────────────────────────────────────────

const KARDEX_DIR = join(process.cwd(), "data", "kardex")

function ensureDir(): void {
  if (!existsSync(KARDEX_DIR)) mkdirSync(KARDEX_DIR, { recursive: true })
}

function kardexPath(mes: number, anio: number): string {
  return join(KARDEX_DIR, `${anio}-${String(mes).padStart(2, "0")}.json`)
}

export function loadKardexMes(mes: number, anio: number): KardexMes | null {
  const p = kardexPath(mes, anio)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, "utf-8"))
  } catch {
    return null
  }
}

export function saveKardexMes(data: KardexMes): void {
  ensureDir()
  writeFileSync(kardexPath(data.mes, data.anio), JSON.stringify(data, null, 2), "utf-8")
}

export function listKardexMeses(): string[] {
  ensureDir()
  return readdirSync(KARDEX_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(".json", ""))
    .sort()
    .reverse()
}
