"use server"

import { query } from "@/lib/db"
import upbMap from "@/data/upb-map.json"

export interface ContenedorDetail {
  contenedor: string
  lote: string
  vencimiento: string
  diasRestantes: number
  unidades: number
  bultos: number
  fechaIngreso: string
  diasEnDeposito: number
}

export interface FrescuraResumen {
  articulo: string
  descripcion: string
  unidadesPorBulto: number
  vencimientoProximo: string
  diasRestantes: number
  unidadesProxVenc: number
  bultosProxVenc: number
  unidadesTotal: number
  bultosTotal: number
  lotes: number
  apto: string
  fechaIngreso: string
  diasEnDeposito: number
  contenedores: ContenedorDetail[]
}

export interface FrescuraData {
  resumen: FrescuraResumen[]
  totales: {
    productos: number
    tresMeses: number
    vencidos: number
    criticos: number
    urgentes: number
    atencion: number
    ok: number
  }
  timestamp: string
  debug?: string
}

export async function getFrescuraData(): Promise<FrescuraData> {
  // Query stock + join with Articulo for UnidadesBulto conversion
  const rows = await query<{
    Articulo: string
    Descripción: string
    Vencimiento: string
    Ingreso: string
    Cantidad: number
    Lote: string
    Apto: string
    Contenedor: string
  }>(`
    SELECT
      Articulo,
      Descripción,
      Vencimiento,
      Ingreso,
      Cantidad,
      Lote,
      Apto,
      Contenedor
    FROM dbo.ConsultaStock
    WHERE Vencimiento IS NOT NULL AND Vencimiento <> ''
    ORDER BY Articulo, Vencimiento
  `)

  const upb$ = upbMap as Record<string, number>

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Group by articulo
  const artMap = new Map<string, {
    descripcion: string
    unidadesPorBulto: number
    lotes: Set<string>
    unidadesTotal: number
    vencimientoProximo: string
    diasRestantes: number
    unidadesProxVenc: number
    apto: string
    fechaIngreso: string
    diasEnDeposito: number
    contenedores: ContenedorDetail[]
  }>()

  for (const r of rows) {
    const articulo = r.Articulo?.trim() || ""
    const venc = parseDate(r.Vencimiento?.trim())
    if (!venc || !articulo) continue
    const dias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    const unidades = r.Cantidad || 0
    if (unidades <= 0) continue

    const upb = upb$[articulo] || 1
    const bultos = upb > 1 ? Math.round((unidades / upb) * 100) / 100 : unidades
    const vencStr = venc.toISOString().slice(0, 10)

    const ingreso = parseDate(r.Ingreso?.trim())
    const ingresoStr = ingreso ? ingreso.toISOString().slice(0, 10) : ""
    const diasDep = ingreso ? Math.ceil((hoy.getTime() - ingreso.getTime()) / (1000 * 60 * 60 * 24)) : 0

    const contDetail: ContenedorDetail = {
      contenedor: r.Contenedor?.trim() || "-",
      lote: r.Lote?.trim() || "-",
      vencimiento: vencStr,
      diasRestantes: dias,
      unidades,
      bultos,
      fechaIngreso: ingresoStr,
      diasEnDeposito: diasDep,
    }

    const existing = artMap.get(articulo)
    if (existing) {
      existing.unidadesTotal += unidades
      existing.lotes.add(r.Lote?.trim() || "")
      existing.contenedores.push(contDetail)
      if (dias < existing.diasRestantes) {
        existing.vencimientoProximo = vencStr
        existing.diasRestantes = dias
        existing.unidadesProxVenc = unidades
        existing.apto = r.Apto?.trim() || ""
      } else if (dias === existing.diasRestantes) {
        existing.unidadesProxVenc += unidades
      }
      // Keep earliest ingreso date
      if (diasDep > existing.diasEnDeposito) {
        existing.fechaIngreso = ingresoStr
        existing.diasEnDeposito = diasDep
      }
    } else {
      artMap.set(articulo, {
        descripcion: r.Descripción?.trim() || "",
        unidadesPorBulto: upb,
        lotes: new Set([r.Lote?.trim() || ""]),
        unidadesTotal: unidades,
        vencimientoProximo: vencStr,
        diasRestantes: dias,
        unidadesProxVenc: unidades,
        apto: r.Apto?.trim() || "",
        fechaIngreso: ingresoStr,
        diasEnDeposito: diasDep,
        contenedores: [contDetail],
      })
    }
  }

  const resumen: FrescuraResumen[] = Array.from(artMap.entries())
    .map(([articulo, d]) => {
      const upb = d.unidadesPorBulto
      return {
        articulo,
        descripcion: d.descripcion,
        unidadesPorBulto: upb,
        vencimientoProximo: d.vencimientoProximo,
        diasRestantes: d.diasRestantes,
        unidadesProxVenc: d.unidadesProxVenc,
        bultosProxVenc: upb > 1 ? Math.round((d.unidadesProxVenc / upb) * 100) / 100 : d.unidadesProxVenc,
        unidadesTotal: d.unidadesTotal,
        bultosTotal: upb > 1 ? Math.round((d.unidadesTotal / upb) * 100) / 100 : d.unidadesTotal,
        lotes: d.lotes.size,
        apto: d.apto,
        fechaIngreso: d.fechaIngreso,
        diasEnDeposito: d.diasEnDeposito,
        contenedores: d.contenedores.sort((a, b) => a.diasRestantes - b.diasRestantes),
      }
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  const totales = {
    productos: resumen.length,
    tresMeses: resumen.filter((r) => r.diasRestantes <= 90).length,
    vencidos: resumen.filter((r) => r.diasRestantes < 0).length,
    criticos: resumen.filter((r) => r.diasRestantes >= 0 && r.diasRestantes <= 15).length,
    urgentes: resumen.filter((r) => r.diasRestantes > 15 && r.diasRestantes <= 30).length,
    atencion: resumen.filter((r) => r.diasRestantes > 30 && r.diasRestantes <= 60).length,
    ok: resumen.filter((r) => r.diasRestantes > 60).length,
  }

  const conUpb = resumen.filter(r => r.unidadesPorBulto > 1).length
  const debug = `JOIN match: ${conUpb}/${resumen.length} productos con UnidadesBulto > 1. Sample UPB values: ${resumen.slice(0, 5).map(r => `${r.articulo}=${r.unidadesPorBulto}`).join(', ')}`

  return { resumen, totales, timestamp: new Date().toISOString(), debug }
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
