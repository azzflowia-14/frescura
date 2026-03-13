import "dotenv/config"
import { query } from "./src/lib/db"

async function main() {
  // Columnas de las tablas clave
  const tablas = ["INGREMITOS", "RECEPCIONCAB", "REMITOPROVEDET", "CONT_MOVIMIENTOS", "ReporteDeRecepciones"]

  for (const t of tablas) {
    const cols = await query<{ COLUMN_NAME: string; DATA_TYPE: string }>(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${t}' ORDER BY ORDINAL_POSITION
    `)
    console.log(`\n=== ${t} (${cols.length} columnas) ===`)
    for (const c of cols) console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`)
  }

  // Muestra de datos recientes de INGREMITOS
  console.log("\n=== INGREMITOS - últimos 5 registros ===")
  try {
    const rows = await query<Record<string, unknown>>(`SELECT TOP 5 * FROM INGREMITOS ORDER BY 1 DESC`)
    for (const r of rows) console.log(JSON.stringify(r).slice(0, 500))
  } catch (e: any) { console.log("Error:", e.message) }

  // Muestra de RECEPCIONCAB
  console.log("\n=== RECEPCIONCAB - últimos 5 registros ===")
  try {
    const rows = await query<Record<string, unknown>>(`SELECT TOP 5 * FROM RECEPCIONCAB ORDER BY 1 DESC`)
    for (const r of rows) console.log(JSON.stringify(r).slice(0, 500))
  } catch (e: any) { console.log("Error:", e.message) }

  // Muestra de ReporteDeRecepciones (vista)
  console.log("\n=== ReporteDeRecepciones - últimos 5 ===")
  try {
    const rows = await query<Record<string, unknown>>(`SELECT TOP 5 * FROM ReporteDeRecepciones ORDER BY 1 DESC`)
    for (const r of rows) console.log(JSON.stringify(r).slice(0, 500))
  } catch (e: any) { console.log("Error:", e.message) }
}

main().catch(console.error)
