import "dotenv/config"
import { query } from "./src/lib/db"
import { bultosToHl, esMercaderia, clasificacion } from "./src/lib/sku"

async function main() {
  // Columnas de PLTCBC y PLTDTL
  console.log("=== PLTCBC columnas ===")
  const colsCbc = await query<{ col: string; tipo: string }>(`
    SELECT COLUMN_NAME as col, DATA_TYPE as tipo FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'PLTCBC' ORDER BY ORDINAL_POSITION
  `)
  for (const c of colsCbc) console.log(`  ${c.col} (${c.tipo})`)

  console.log("\n=== PLTDTL columnas ===")
  const colsDtl = await query<{ col: string; tipo: string }>(`
    SELECT COLUMN_NAME as col, DATA_TYPE as tipo FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'PLTDTL' ORDER BY ORDINAL_POSITION
  `)
  for (const c of colsDtl) console.log(`  ${c.col} (${c.tipo})`)

  // Sample de PLTCBC marzo
  console.log("\n=== PLTCBC - 5 pallets ingresados marzo ===")
  const sampleCbc = await query<Record<string, unknown>>(`
    SELECT TOP 5 * FROM PLTCBC
    WHERE PltFchIngreso >= '2026-03-01' AND PltFchIngreso < '2026-04-01'
    ORDER BY PltFchIngreso DESC
  `)
  for (const r of sampleCbc) console.log(JSON.stringify(r).slice(0, 400))

  // Sample de PLTDTL
  console.log("\n=== PLTDTL - 5 registros recientes ===")
  const sampleDtl = await query<Record<string, unknown>>(`
    SELECT TOP 5 * FROM PLTDTL
    WHERE PltDtlDateTime >= '2026-03-01'
    ORDER BY PltDtlDateTime DESC
  `)
  for (const r of sampleDtl) console.log(JSON.stringify(r).slice(0, 400))

  // JOIN: ingresos marzo por día con artículo y bultos
  console.log("\n=== Ingresos marzo (PLTCBC + PLTDTL) por día ===")
  try {
    const ingresos = await query<{ fecha: string; art: string; desc: string; bultos: number }>(`
      SELECT CONVERT(varchar, c.PltFchIngreso, 23) as fecha,
        RTRIM(d.PltDtlArticuloCod) as art,
        RTRIM(d.PltDtlArticuloDesc) as [desc],
        SUM(d.PltDtlCantidad) as bultos
      FROM PLTCBC c
      INNER JOIN PLTDTL d ON c.PltCod = d.PltDtlPltCod AND c.Cod_Emp = d.Cod_Emp AND c.SucCod = d.SucCod
      WHERE c.PltFchIngreso >= '2026-03-01' AND c.PltFchIngreso < '2026-04-01'
        AND c.PltBaja IS NULL
      GROUP BY CONVERT(varchar, c.PltFchIngreso, 23), d.PltDtlArticuloCod, d.PltDtlArticuloDesc
      ORDER BY fecha, bultos DESC
    `)

    // Agrupar por día
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

    console.log("Fecha".padEnd(12), "Bultos".padStart(8), "Cerv HL".padStart(10), "NABS HL".padStart(10))
    console.log("-".repeat(42))
    for (const [dia, data] of [...porDia.entries()].sort()) {
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
  } catch (e: any) {
    console.log("Error en JOIN:", e.message)
    console.log("Intentando sin JOIN...")

    // Fallback: solo PLTDTL
    const dtl = await query<{ fecha: string; art: string; bultos: number }>(`
      SELECT TOP 20 CONVERT(varchar, PltDtlDateTime, 23) as fecha,
        RTRIM(PltDtlArticuloCod) as art, SUM(PltDtlCantidad) as bultos
      FROM PLTDTL
      WHERE PltDtlDateTime >= '2026-03-01' AND PltDtlDateTime < '2026-04-01'
      GROUP BY CONVERT(varchar, PltDtlDateTime, 23), PltDtlArticuloCod
      ORDER BY fecha, bultos DESC
    `)
    for (const r of dtl) console.log(`  ${r.fecha} | ${r.art} | ${r.bultos}`)
  }
}

main().catch(console.error)
