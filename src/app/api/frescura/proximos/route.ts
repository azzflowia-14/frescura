import { NextResponse } from "next/server"
import { getFrescuraData } from "@/actions/frescura"
import { loadPrecios, getPrecio } from "@/lib/precios"

export const dynamic = "force-dynamic"

/**
 * Endpoint para dpo-app (Reunión Ventas-Logística · sección Frescura).
 * Devuelve las líneas próximas a vencer con vencimiento entre `desde` y `hasta`
 * (inclusive), una por artículo (su vencimiento más próximo), con bultos y
 * valorizado (= bultos próx. venc. × precio por bulto).
 *
 *   GET /api/frescura/proximos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *   → { desde, hasta, items: [{ nro_articulo, descripcion, vence, bultos, valorizado }] }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const desde = (searchParams.get("desde") ?? "").trim()
  const hasta = (searchParams.get("hasta") ?? "").trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json(
      { error: "Parámetros desde/hasta inválidos (formato YYYY-MM-DD)" },
      { status: 400 },
    )
  }

  try {
    const [data, precios] = [await getFrescuraData("TODOS"), loadPrecios()]

    const items = data.resumen
      .filter(
        (r) =>
          r.vencimientoProximo >= desde &&
          r.vencimientoProximo <= hasta &&
          r.bultosProxVenc > 0,
      )
      .map((r) => {
        const p = getPrecio(precios, r.articulo)
        return {
          nro_articulo: r.articulo,
          descripcion: r.descripcion,
          vence: r.vencimientoProximo,
          bultos: r.bultosProxVenc,
          valorizado: p != null ? Math.round(r.bultosProxVenc * p) : 0,
        }
      })
      .sort((a, b) => a.vence.localeCompare(b.vence))

    return NextResponse.json({ desde, hasta, items })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
