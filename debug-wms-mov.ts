import "dotenv/config"
import { query } from "./src/lib/db"
import { bultosToHl, esMercaderia, clasificacion } from "./src/lib/sku"

async function main() {
  // PLTCBC (cabecera pallet) + PLTDTL (detalle: ArtCod, PltPUBQty=bultos)
  // PltFchIngreso = fecha de ingreso al depósito
  // PltBaja = 1753 significa activo (no dado de baja)

  console.log("=== Ingresos marzo 2026 (PLTCBC + PLTDTL) ===\n")

  const ingresos = await query<{ fecha: string; art: string; bultos: number }>(`
    SELECT CONVERT(varchar, c.PltFchIngreso, 23) as fecha,
      RTRIM(d.ArtCod) as art,
      SUM(d.PltPUBQty) as bultos
    FROM PLTCBC c
    INNER JOIN PLTDTL d ON RTRIM(c.PltCod) = RTRIM(d.PltCod)
    WHERE c.PltFchIngreso >= '2026-03-01' AND c.PltFchIngreso < '2026-04-01'
    GROUP BY CONVERT(varchar, c.PltFchIngreso, 23), d.ArtCod
    ORDER BY fecha, bultos DESC
  `)

  console.log("Filas (art x dia):", ingresos.length)

  const porDia = new Map<string, { bultos: number; hlCerv: number; hlNabs: number }>()
  let totalBultos = 0, totalHlCerv = 0, totalHlNabs = 0

  for (const r of ingresos) {
    const art = r.art?.trim()
    if (!art || !esMercaderia(art)) continue
    const hl = bultosToHl(art, r.bultos)
    const clasif = clasificacion(art)

    const existing = porDia.get(r.fecha) || { bultos: 0, hlCerv: 0, hlNabs: 0 }
    existing.bultos += r.bultos
    if (clasif === "cervezas") existing.hlCerv += hl
    if (clasif === "nabs") existing.hlNabs += hl
    porDia.set(r.fecha, existing)

    totalBultos += r.bultos
    if (clasif === "cervezas") totalHlCerv += hl
    if (clasif === "nabs") totalHlNabs += hl
  }

  console.log("\n" + "Fecha".padEnd(12), "Bultos".padStart(8), "Cerv HL".padStart(10), "NABS HL".padStart(10), "Acum Cerv".padStart(10), "Acum NABS".padStart(10))
  console.log("-".repeat(64))
  let acumCerv = 0, acumNabs = 0
  for (const [dia, data] of [...porDia.entries()].sort()) {
    acumCerv += data.hlCerv
    acumNabs += data.hlNabs
    console.log(
      dia.padEnd(12),
      String(data.bultos).padStart(8),
      (Math.round(data.hlCerv * 10) / 10).toString().padStart(10),
      (Math.round(data.hlNabs * 10) / 10).toString().padStart(10),
      (Math.round(acumCerv * 10) / 10).toString().padStart(10),
      (Math.round(acumNabs * 10) / 10).toString().padStart(10),
    )
  }
  console.log("-".repeat(64))
  console.log(
    "TOTAL".padEnd(12),
    String(totalBultos).padStart(8),
    (Math.round(totalHlCerv * 10) / 10).toString().padStart(10),
    (Math.round(totalHlNabs * 10) / 10).toString().padStart(10),
  )
}

main().catch(console.error)
