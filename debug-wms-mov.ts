import "dotenv/config"
import { query } from "./src/lib/db"

async function main() {
  const tables = await query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    AND (TABLE_NAME LIKE '%mov%' OR TABLE_NAME LIKE '%remito%' OR TABLE_NAME LIKE '%ingreso%'
         OR TABLE_NAME LIKE '%recep%' OR TABLE_NAME LIKE '%RCG%' OR TABLE_NAME LIKE '%REM%'
         OR TABLE_NAME LIKE '%comprobante%' OR TABLE_NAME LIKE '%transac%')
    ORDER BY TABLE_NAME
  `)
  console.log("=== Tablas de movimientos/ingresos ===")
  for (const t of tables) console.log(t.TABLE_NAME)

  const views = await query<{ TABLE_NAME: string }>(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_NAME LIKE '%mov%' OR TABLE_NAME LIKE '%remito%' OR TABLE_NAME LIKE '%ingreso%'
      OR TABLE_NAME LIKE '%recep%' OR TABLE_NAME LIKE '%stock%'
    ORDER BY TABLE_NAME
  `)
  console.log("\n=== Vistas relacionadas ===")
  for (const v of views) console.log(v.TABLE_NAME)
}

main().catch(console.error)
