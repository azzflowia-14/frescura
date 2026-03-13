import "dotenv/config"
import { query } from "./src/lib/db"
import { bultosToHl, esMercaderia, clasificacion } from "./src/lib/sku"

async function main() {
  // Ingresos del mes de marzo 2026
  console.log("=== Ingresos MARZO 2026 (ReporteDeRecepciones) ===\n")

  const rows = await query<{
    Fecha: string
    Articulo: string
    Descripcion: string
    Bultos: number
    DebitoCredito: string
  }>(`
    SELECT
      CONVERT(varchar, [Fecha de Recepcion], 23) as Fecha,
      RTRIM(Articulo) as Articulo,
      RTRIM([Articulo Descripcion]) as Descripcion,
      [Cantidad de Bultos] as Bultos,
      RTRIM([Debito o Credito]) as DebitoCredito
    FROM ReporteDeRecepciones
    WHERE [Fecha de Recepcion] >= '2026-03-01'
      AND [Fecha de Recepcion] < '2026-04-01'
    ORDER BY [Fecha de Recepcion]
  `)

  console.log("Total filas marzo:", rows.length)

  // Valores únicos de DebitoCredito
  const tipos = [...new Set(rows.map(r => r.DebitoCredito))]
  console.log("Tipos Debito/Credito:", tipos)

  // Solo débitos (ingresos)
  const debitos = rows.filter(r => r.DebitoCredito === "D")
  console.log("Filas Debito (ingresos):", debitos.length)

  // Agrupar por día
  const porDia = new Map<string, { bultos: number; hlCerv: number; hlNabs: number }>()
  let totalHlCerv = 0, totalHlNabs = 0, totalBultos = 0

  for (const r of debitos) {
    const art = r.Articulo.trim()
    if (!esMercaderia(art)) continue
    const hl = bultosToHl(art, r.Bultos)
    const clasif = clasificacion(art)
    const dia = r.Fecha

    const existing = porDia.get(dia) || { bultos: 0, hlCerv: 0, hlNabs: 0 }
    existing.bultos += r.Bultos
    if (clasif === "cervezas") existing.hlCerv += hl
    if (clasif === "nabs") existing.hlNabs += hl
    porDia.set(dia, existing)

    totalBultos += r.Bultos
    if (clasif === "cervezas") totalHlCerv += hl
    if (clasif === "nabs") totalHlNabs += hl
  }

  console.log("\n--- Ingresos por día ---")
  console.log("Fecha".padEnd(12), "Bultos".padStart(8), "Cerv HL".padStart(10), "NABS HL".padStart(10))
  console.log("-".repeat(42))
  let acumCerv = 0, acumNabs = 0
  for (const [dia, data] of [...porDia.entries()].sort()) {
    acumCerv += data.hlCerv
    acumNabs += data.hlNabs
    console.log(
      dia.padEnd(12),
      String(data.bultos).padStart(8),
      (Math.round(data.hlCerv * 10) / 10).toString().padStart(10),
      (Math.round(data.hlNabs * 10) / 10).toString().padStart(10),
    )
  }
  console.log("-".repeat(42))
  console.log(
    "TOTAL".padEnd(12),
    String(totalBultos).padStart(8),
    (Math.round(totalHlCerv * 10) / 10).toString().padStart(10),
    (Math.round(totalHlNabs * 10) / 10).toString().padStart(10),
  )
  console.log("\nAcumulado Cervezas HL:", Math.round(acumCerv * 10) / 10)
  console.log("Acumulado NABS HL:", Math.round(acumNabs * 10) / 10)

  // Si no hay datos de marzo, ver últimas recepciones
  if (rows.length === 0) {
    console.log("\n⚠ Sin datos en marzo. Últimas 10 recepciones:")
    const ultimas = await query<{ Fecha: string; Articulo: string; Bultos: number }>(`
      SELECT TOP 10
        CONVERT(varchar, [Fecha de Recepcion], 23) as Fecha,
        RTRIM(Articulo) as Articulo,
        [Cantidad de Bultos] as Bultos
      FROM ReporteDeRecepciones
      ORDER BY [Fecha de Recepcion] DESC
    `)
    for (const r of ultimas) console.log(`  ${r.Fecha} | ${r.Articulo} | ${r.Bultos} blt`)
  }
}

main().catch(console.error)
