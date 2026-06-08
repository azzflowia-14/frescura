import { NextResponse } from "next/server"
import { getFrescuraData } from "@/actions/frescura"
import { getVentaDiariaData } from "@/actions/venta-diaria"
import { loadPrecios, getPrecio } from "@/lib/precios"

export const dynamic = "force-dynamic"

/**
 * Endpoint para dpo-app (Reunión Ventas-Logística · sección Sobrestock).
 * Sobrestock = días de cobertura por encima del umbral (default 30).
 *   - Stock al día: del WMS (getFrescuraData → bultosTotal por artículo).
 *   - VPD: venta promedio diaria de los últimos N días (default 14) desde
 *     venta-diaria (getVentaDiariaData).
 *   - Cobertura = stock (bultos) / VPD (bultos/día).
 *
 *   GET /api/frescura/sobrestock?dias_cobertura=30&dias_vpd=14
 *   → { dias_cobertura, dias_vpd, items: [{ nro_articulo, descripcion, bultos,
 *        dias_cobertura, vpd, valorizado, division, marca }] }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const minCobertura = Number(searchParams.get("dias_cobertura") ?? "30") || 30
  const diasVpd = Number(searchParams.get("dias_vpd") ?? "14") || 14

  try {
    const [fres, vd, precios] = await Promise.all([
      getFrescuraData("TODOS"), // stock al día (WMS)
      getVentaDiariaData(diasVpd), // VPD últimos N días (venta-diaria)
      Promise.resolve(loadPrecios()),
    ])

    // Mapa articulo -> VPD (bultos/día)
    const vpdMap = new Map<string, number>()
    for (const s of vd.skus) {
      vpdMap.set(String(s.idArticulo).trim(), s.promedioDiario)
    }

    const items = fres.resumen
      .map((r) => {
        const art = String(r.articulo).trim()
        const vpd = vpdMap.get(art) ?? 0
        const bultos = r.bultosTotal
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
      .filter((x) => x.dias_cobertura != null && x.dias_cobertura > minCobertura)
      .sort((a, b) => (b.dias_cobertura ?? 0) - (a.dias_cobertura ?? 0))

    return NextResponse.json({ dias_cobertura: minCobertura, dias_vpd: diasVpd, items })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
