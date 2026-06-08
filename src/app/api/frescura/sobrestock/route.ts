import { NextResponse } from "next/server"
import { getAnalisisData } from "@/actions/analisis"
import { loadPrecios, getPrecio } from "@/lib/precios"

export const dynamic = "force-dynamic"

/**
 * Endpoint para dpo-app (Reunión Ventas-Logística · sección Sobrestock).
 * Devuelve los artículos con sobrestock = días de cobertura por encima del
 * umbral (default 30), usando VPD de los últimos N días (default 15).
 * Cobertura (diasPiso) = bultosStock / VPD diaria en bultos.
 *
 *   GET /api/frescura/sobrestock?dias_cobertura=30&dias_vpd=15
 *   → { dias_cobertura, dias_vpd, items: [{ nro_articulo, descripcion, bultos,
 *        dias_cobertura, vpd, valorizado, division, marca }] }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const minCobertura = Number(searchParams.get("dias_cobertura") ?? "30") || 30
  const diasVpd = Number(searchParams.get("dias_vpd") ?? "15") || 15

  try {
    const [data, precios] = [await getAnalisisData(diasVpd), loadPrecios()]

    const items = data.items
      .filter((i) => i.diasPiso != null && i.diasPiso > minCobertura)
      .map((i) => {
        const p = getPrecio(precios, i.articulo)
        return {
          nro_articulo: i.articulo,
          descripcion: i.descripcion,
          bultos: i.bultosStock,
          dias_cobertura: i.diasPiso,
          vpd: i.vpdBultos,
          valorizado: p != null ? Math.round(i.bultosStock * p) : 0,
          division: i.division,
          marca: i.marca,
        }
      })
      .sort((a, b) => (b.dias_cobertura ?? 0) - (a.dias_cobertura ?? 0))

    return NextResponse.json({ dias_cobertura: minCobertura, dias_vpd: diasVpd, items })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
