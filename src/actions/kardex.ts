"use server"

import {
  loadKardexMes,
  listKardexMeses,
  type KardexMes,
  type KardexMovimiento,
  type KardexArticuloResumen,
  type KardexDiaAgregado,
} from "@/lib/kardex"

// Re-export types for client
export type { KardexMes, KardexMovimiento, KardexArticuloResumen, KardexDiaAgregado }

// ─── Page data ──────────────────────────────────────────────

export interface KardexPageData {
  kardex: KardexMes | null
  disponible: boolean
  mesesDisponibles: string[]
  error?: string
}

export async function getKardexPageData(
  mes?: number,
  anio?: number,
): Promise<KardexPageData> {
  const hoy = new Date()
  const m = mes ?? hoy.getMonth() + 1
  const a = anio ?? hoy.getFullYear()
  const kardex = loadKardexMes(m, a)
  const mesesDisponibles = listKardexMeses()

  return {
    kardex,
    disponible: kardex !== null,
    mesesDisponibles,
    error: kardex ? undefined : `No hay kardex para ${m}/${a}. Subí el Excel.`,
  }
}

// ─── Article detail ─────────────────────────────────────────

export interface KardexArticuloDetalle {
  codigo: string
  descripcion: string
  resumen: KardexArticuloResumen
  movimientos: KardexMovimiento[]
  evolucionDiaria: KardexDiaAgregado[]
}

export async function getKardexArticuloDetalle(
  mes: number,
  anio: number,
  codigo: string,
): Promise<KardexArticuloDetalle | null> {
  const kardex = loadKardexMes(mes, anio)
  if (!kardex) return null

  const resumen = kardex.resumenArticulos.find(r => r.codigo === codigo)
  if (!resumen) return null

  const movs = kardex.movimientos
    .filter(m => m.codigo === codigo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Build daily evolution for this article
  const fechas = [...new Set(movs.map(m => m.fecha))].sort()
  const evolucionDiaria: KardexDiaAgregado[] = []

  for (const fecha of fechas) {
    const dayMovs = movs.filter(m => m.fecha === fecha && m.concepto !== "RECUENTO")
    if (dayMovs.length === 0) continue

    const lastMov = dayMovs[dayMovs.length - 1]
    let ingresos = 0, cargas = 0, descargas = 0
    let faltantes = 0, sobrantes = 0, devoluciones = 0

    for (const m of dayMovs) {
      const abs = Math.abs(m.movBultos)
      switch (m.concepto) {
        case "REC.DEPOS.": ingresos += m.movBultos; break
        case "CARGA": cargas += abs; break
        case "DESCARGA": descargas += m.movBultos; break
        case "FALTANTE": faltantes += abs; break
        case "SOBRANTE": sobrantes += m.movBultos; break
        case "DEVOLUCION": devoluciones += m.movBultos; break
      }
    }

    evolucionDiaria.push({
      fecha,
      stockFinal: lastMov.saldoBultos,
      ingresos, cargas, descargas,
      faltantes, sobrantes, devoluciones,
    })
  }

  return { codigo, descripcion: resumen.descripcion, resumen, movimientos: movs, evolucionDiaria }
}
