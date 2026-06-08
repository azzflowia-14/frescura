import { NextResponse } from "next/server"
import { getFrescuraData } from "@/actions/frescura"
import { getVentaDiariaData } from "@/actions/venta-diaria"
import { loadPrecios, getPrecio } from "@/lib/precios"

export const dynamic = "force-dynamic"

/**
 * Endpoint para dpo-app (Reunión Ventas-Logística · sección Sobrestock).
 * Sobrestock = días de cobertura > umbral (default 30).
 *   - Stock al día: WMS (getFrescuraData → bultosTotal por artículo).
 *   - VPD: venta promedio diaria últimos N días (default 14) desde venta-diaria.
 *   - Cobertura = stock (bultos) / VPD (bultos/día).
 *
 *   GET /api/frescura/sobrestock?dias_cobertura=30&dias_vpd=14
 *        [&vpd_desde=YYYY-MM-DD&vpd_hasta=YYYY-MM-DD]  (override del rango VPD)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const minCobertura = Number(searchParams.get("dias_cobertura") ?? "30") || 30
  const diasVpd = Number(searchParams.get("dias_vpd") ?? "14") || 14
  const vpdDesde = searchParams.get("vpd_desde") ?? undefined
  const vpdHasta = searchParams.get("vpd_hasta") ?? undefined

  try {
    const [fres, vd, precios] = await Promise.all([
      getFrescuraData("TODOS"),
      getVentaDiariaData(diasVpd, vpdDesde, vpdHasta),
      Promise.resolve(loadPrecios()),
    ])

    const vpdMap = new Map<string, number>()
    for (const s of vd.skus) vpdMap.set(String(s.idArticulo).trim(), s.promedioDiario)

    let conVpd = 0
    const items = fres.resumen
      .map((r) => {
        const art = String(r.articulo).trim()
        const vpd = vpdMap.get(art) ?? 0
        if (vpd > 0) conVpd++
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

    return NextResponse.json({
      dias_cobertura: minCobertura,
      dias_vpd: diasVpd,
      items,
      _debug: {
        resumen_articulos: fres.resumen.length,
        vd_skus: vd.skus.length,
        vd_rango: `${vd.fechaDesde}..${vd.fechaHasta}`,
        vd_error: vd.error ?? null,
        articulos_con_vpd: conVpd,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
