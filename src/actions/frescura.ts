"use server"

import { query } from "@/lib/db"

export interface FrescuraItem {
  articulo: string
  descripcion: string
  lote: string
  vencimiento: string
  diasRestantes: number
  cantidad: number
  apto: string
  contenedor: string
}

export interface FrescuraResumen {
  articulo: string
  descripcion: string
  vencimientoProximo: string
  diasRestantes: number
  cantidadProxVenc: number
  cantidadTotal: number
  lotes: number
  apto: string
}

export interface FrescuraData {
  items: FrescuraItem[]
  resumen: FrescuraResumen[]
  totales: {
    productos: number
    vencidos: number
    criticos: number   // 0-15 dias
    urgentes: number   // 16-30 dias
    atencion: number   // 31-60 dias
    ok: number         // >60 dias
  }
  timestamp: string
}

export async function getFrescuraData(): Promise<FrescuraData> {
  const rows = await query<{
    Articulo: string
    Descripción: string
    Vencimiento: string
    Cantidad: number
    Lote: string
    Apto: string
    Contenedor: string
  }>(`
    SELECT
      Articulo,
      Descripción,
      Vencimiento,
      Cantidad,
      Lote,
      Apto,
      Contenedor
    FROM dbo.ConsultaStock
    WHERE Vencimiento IS NOT NULL AND Vencimiento <> ''
    ORDER BY Articulo, Vencimiento
  `)

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Parse items
  const items: FrescuraItem[] = rows.map((r) => {
    const venc = parseDate(r.Vencimiento?.trim())
    const dias = venc ? Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : -9999
    return {
      articulo: r.Articulo?.trim() || "",
      descripcion: r.Descripción?.trim() || "",
      lote: r.Lote?.trim() || "",
      vencimiento: venc ? venc.toISOString().slice(0, 10) : "",
      diasRestantes: dias,
      cantidad: r.Cantidad || 0,
      apto: r.Apto?.trim() || "",
      contenedor: r.Contenedor?.trim() || "",
    }
  }).filter((i) => i.vencimiento && i.cantidad > 0)

  // Group by articulo: find próximo vencimiento
  const artMap = new Map<string, {
    descripcion: string
    lotes: Set<string>
    cantidadTotal: number
    vencimientoProximo: string
    diasRestantes: number
    cantidadProxVenc: number
    apto: string
  }>()

  for (const item of items) {
    const existing = artMap.get(item.articulo)
    if (existing) {
      existing.cantidadTotal += item.cantidad
      existing.lotes.add(item.lote)
      if (item.diasRestantes < existing.diasRestantes) {
        existing.vencimientoProximo = item.vencimiento
        existing.diasRestantes = item.diasRestantes
        existing.cantidadProxVenc = item.cantidad
        existing.apto = item.apto
      } else if (item.diasRestantes === existing.diasRestantes) {
        existing.cantidadProxVenc += item.cantidad
      }
    } else {
      artMap.set(item.articulo, {
        descripcion: item.descripcion,
        lotes: new Set([item.lote]),
        cantidadTotal: item.cantidad,
        vencimientoProximo: item.vencimiento,
        diasRestantes: item.diasRestantes,
        cantidadProxVenc: item.cantidad,
        apto: item.apto,
      })
    }
  }

  const resumen: FrescuraResumen[] = Array.from(artMap.entries())
    .map(([articulo, data]) => ({
      articulo,
      descripcion: data.descripcion,
      vencimientoProximo: data.vencimientoProximo,
      diasRestantes: data.diasRestantes,
      cantidadProxVenc: data.cantidadProxVenc,
      cantidadTotal: data.cantidadTotal,
      lotes: data.lotes.size,
      apto: data.apto,
    }))
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  const totales = {
    productos: resumen.length,
    vencidos: resumen.filter((r) => r.diasRestantes < 0).length,
    criticos: resumen.filter((r) => r.diasRestantes >= 0 && r.diasRestantes <= 15).length,
    urgentes: resumen.filter((r) => r.diasRestantes > 15 && r.diasRestantes <= 30).length,
    atencion: resumen.filter((r) => r.diasRestantes > 30 && r.diasRestantes <= 60).length,
    ok: resumen.filter((r) => r.diasRestantes > 60).length,
  }

  return {
    items,
    resumen,
    totales,
    timestamp: new Date().toISOString(),
  }
}

// Parse date from various formats (dd/mm/yyyy, yyyy-mm-dd, etc)
function parseDate(str: string): Date | null {
  if (!str) return null
  // dd/mm/yyyy
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  // yyyy-mm-dd
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  // Try native parse
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}
