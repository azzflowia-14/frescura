import { NextResponse } from "next/server"
import { getFrescuraData } from "@/actions/frescura"
import { getVentaDiariaData } from "@/actions/venta-diaria"
import { loadPrecios, getPrecio } from "@/lib/precios"
import { chessGet } from "@/lib/chess"

export const dynamic = "force-dynamic"

// Cache en memoria del maestro de UPB (unidades por bulto) — 1 hora.
let upbCache: { map: Map<string, number>; ts: number } | null = null

interface ArticulosResponse {
  Articulos?: { eArticulos?: Array<{ idArticulo?: number | string; unidadesBulto?: number }> }
  [key: string]: unknown
}

async function getUpbMap(): Promise<Map<string, number>> {
  if (upbCache && Date.now() - upbCache.ts < 3_600_000) return upbCache.map
  const map = new Map<string, number>()
  for (let lote = 1; lote <= 60; lote++) {
    let res: ArticulosResponse
    try {
      res = await chessGet<ArticulosResponse>("/articulos/", { nroLote: lote })
    } catch {
      break
    }
    const arr = res?.Articulos?.eArticulos
    if (!Array.isArray(arr) || arr.length === 0) break
    for (const a of arr) {
      const id = String(a.idArticulo ?? "").trim()
      const upb = Number(a.unidadesBulto) || 0
      if (id && upb > 0) map.set(id, upb)
    }
  }
  if (map.size > 0) upbCache = { map, ts: Date.now() }
  return map
}

/**
 * Sobrestock (Reunión Ventas-Logística). TODO EN BULTOS:
 *   - Stock: WMS en unidades → bultos = unidades / unidadesBulto (maestro Chess).
 *   - VPD: venta-diaria, ya en bultos (últimos N días, default 14).
 *   - Cobertura = stock bultos / VPD bultos/día.
 * Devuelve los TOP `top` (default 20) por valorizado entre los que superan el
 * umbral de cobertura (default 30 días).
 *
 *   GET /api/frescura/sobrestock?dias_cobertura=30&dias_vpd=14&top=20
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const minCobertura = Number(searchParams.get("dias_cobertura") ?? "30") || 30
  const diasVpd = Number(searchParams.get("dias_vpd") ?? "14") || 14
  const topN = Number(searchParams.get("top") ?? "20") || 20

  try {
    const [fres, vd, precios, upbMap] = await Promise.all([
      getFrescuraData("TODOS"),
      getVentaDiariaData(diasVpd),
      Promise.resolve(loadPrecios()),
      getUpbMap(),
    ])

    const vpdMap = new Map<string, number>()
    for (const s of vd.skus) vpdMap.set(String(s.idArticulo).trim(), s.promedioDiario)

    let sinUpb = 0
    const all = fres.resumen.map((r) => {
      const art = String(r.articulo).trim()
      const upb = upbMap.get(art) ?? 0
      if (upb <= 0) sinUpb++
      // Stock en bultos: unidades / unidadesBulto. Fallback al bultosTotal del WMS.
      const bultos =
        upb > 0 ? Math.round((r.unidadesTotal / upb) * 10) / 10 : r.bultosTotal
      const vpd = vpdMap.get(art) ?? 0
      const diasCobertura = vpd > 0 ? Math.round((bultos / vpd) * 10) / 10 : null
      const p = getPrecio(precios, art)
      return {
        nro_articulo: art,
        descripcion: r.descripcion,
        bultos,
        dias_cobertura: diasCobertura,
        vpd: Math.round(vpd * 100) / 100,
        valorizado: p != null ? Math.round(bultos * p) : 0,
        division: r.division,
        marca: r.marca,
      }
    })

    const items = all
      .filter((x) => x.dias_cobertura != null && x.dias_cobertura > minCobertura)
      .sort((a, b) => b.valorizado - a.valorizado)
      .slice(0, topN)

    return NextResponse.json({
      dias_cobertura: minCobertura,
      dias_vpd: diasVpd,
      top: topN,
      items,
      _debug: {
        resumen_articulos: fres.resumen.length,
        vd_skus: vd.skus.length,
        upb_map: upbMap.size,
        articulos_sin_upb: sinUpb,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
