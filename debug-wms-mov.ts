import "dotenv/config"
import { query } from "./src/lib/db"

async function main() {
  // Buscar TODAS las tablas que tengan alguna columna datetime con datos de marzo 2026
  console.log("=== Buscando TODAS las tablas con datos de marzo 2026 ===\n")

  const allCols = await query<{ tabla: string; col: string }>(`
    SELECT TABLE_NAME as tabla, COLUMN_NAME as col
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE DATA_TYPE IN ('datetime', 'date', 'datetime2', 'smalldatetime')
    AND TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME, COLUMN_NAME
  `)

  console.log("Total columnas fecha a revisar:", allCols.length)
  console.log()

  for (const c of allCols) {
    try {
      const r = await query<{ cnt: number }>(`
        SELECT COUNT(*) as cnt FROM [${c.tabla}]
        WHERE [${c.col}] >= '2026-03-01' AND [${c.col}] < '2026-04-01'
      `)
      if (r[0]?.cnt > 0) {
        console.log(`${c.tabla}.${c.col}: ${r[0].cnt} filas en marzo`)
      }
    } catch { /* skip errors */ }
  }

  console.log("\nListo.")
}

main().catch(console.error)
