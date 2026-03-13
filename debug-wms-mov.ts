import "dotenv/config"
import { query } from "./src/lib/db"

async function main() {
  // Buscar altas de producto/stock en marzo en TODAS las tablas con fecha
  // Primero buscar en las vistas de stock/pallets que tienen fecha de alta

  console.log("=== VISTA_CONSULTA_Pallets - altas marzo 2026 ===")
  try {
    const altas = await query<{ fecha: string; cnt: number; bultos: number }>(`
      SELECT CONVERT(varchar, [Fecha de Alta], 23) as fecha, COUNT(*) as cnt,
        SUM(Cantidad) as bultos
      FROM VISTA_CONSULTA_Pallets
      WHERE [Fecha de Alta] >= '2026-03-01' AND [Fecha de Alta] < '2026-04-01'
      GROUP BY CONVERT(varchar, [Fecha de Alta], 23)
      ORDER BY fecha
    `)
    if (altas.length === 0) console.log("  Sin datos")
    for (const r of altas) console.log(`  ${r.fecha} | ${r.cnt} pallets | ${r.bultos} unidades`)

    console.log("\nTotal marzo:", altas.reduce((s, r) => s + r.bultos, 0), "unidades")
  } catch (e: any) { console.log("Error:", e.message) }

  // ConsultaStock tiene campo Ingreso
  console.log("\n=== ConsultaStock - ingresos marzo 2026 ===")
  try {
    const ingresos = await query<{ fecha: string; cnt: number; cantidad: number }>(`
      SELECT CONVERT(varchar, Ingreso, 23) as fecha, COUNT(*) as cnt, SUM(Cantidad) as cantidad
      FROM ConsultaStock
      WHERE Ingreso >= '2026-03-01' AND Ingreso < '2026-04-01'
      GROUP BY CONVERT(varchar, Ingreso, 23)
      ORDER BY fecha
    `)
    if (ingresos.length === 0) console.log("  Sin datos")
    for (const r of ingresos) console.log(`  ${r.fecha} | ${r.cnt} lineas | ${r.cantidad} unidades`)

    console.log("\nTotal marzo:", ingresos.reduce((s, r) => s + r.cantidad, 0), "unidades")
  } catch (e: any) { console.log("Error:", e.message) }

  // Top 10 artículos ingresados en marzo por ConsultaStock
  console.log("\n=== Top 10 artículos ingresados marzo (ConsultaStock) ===")
  try {
    const top = await query<{ art: string; desc: string; cantidad: number }>(`
      SELECT TOP 10 RTRIM(Articulo) as art, RTRIM(Descripción) as desc, SUM(Cantidad) as cantidad
      FROM ConsultaStock
      WHERE Ingreso >= '2026-03-01' AND Ingreso < '2026-04-01'
      GROUP BY Articulo, Descripción
      ORDER BY cantidad DESC
    `)
    for (const r of top) console.log(`  ${r.art} | ${r.desc?.slice(0, 35)} | ${r.cantidad}`)
  } catch (e: any) { console.log("Error:", e.message) }

  // ReporteDeRecepciones con rango más amplio
  console.log("\n=== ReporteDeRecepciones - altas marzo ===")
  try {
    const rec = await query<{ cnt: number }>(`
      SELECT COUNT(*) as cnt FROM ReporteDeRecepciones
      WHERE [Fecha de Recepcion] >= '2026-03-01' AND [Fecha de Recepcion] < '2026-04-01'
    `)
    console.log("  Filas:", rec[0]?.cnt)
  } catch (e: any) { console.log("Error:", e.message) }

  // SGL_INFORME_PREPARACION por si tiene ingresos
  console.log("\n=== Últimas fechas en tablas clave ===")
  const checks = [
    { tabla: "ConsultaStock", col: "Ingreso" },
    { tabla: "VISTA_CONSULTA_Pallets", col: "Fecha de Alta" },
    { tabla: "ReporteDeRecepciones", col: "Fecha de Recepcion" },
    { tabla: "InformacionDeVentas", col: "FechaDespacho" },
  ]
  for (const c of checks) {
    try {
      const r = await query<{ ultima: string }>(`
        SELECT CONVERT(varchar, MAX([${c.col}]), 120) as ultima FROM [${c.tabla}]
      `)
      console.log(`  ${c.tabla}.${c.col}: última = ${r[0]?.ultima}`)
    } catch (e: any) { console.log(`  ${c.tabla}: ${e.message}`) }
  }
}

main().catch(console.error)
