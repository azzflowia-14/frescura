import "dotenv/config"
import { query } from "./src/lib/db"

async function main() {
  // 1. RECEPCIONCAB - buscar marzo
  console.log("=== RECEPCIONCAB marzo 2026 ===")
  const recCab = await query<{ cnt: number; tipos: string }>(`
    SELECT COUNT(*) as cnt,
      (SELECT STRING_AGG(DISTINCT RTRIM(RecCabTipoOperacion), ', ') FROM RECEPCIONCAB WHERE RecCabFechaRemito >= '2026-02-01') as tipos
    FROM RECEPCIONCAB
    WHERE RecCabFechaRemito >= '2026-02-01' AND RecCabFechaRemito < '2026-04-01'
  `)
  console.log("Filas:", recCab[0]?.cnt, "| Tipos:", recCab[0]?.tipos)

  // Últimas 5 de RECEPCIONCAB sin filtro de mes
  const ultRec = await query<{ nro: number; tipo: string; fecha: string; prov: string; anulada: number }>(`
    SELECT TOP 5 RecCabNroAplicaWMS as nro, RTRIM(RecCabTipoOperacion) as tipo,
      CONVERT(varchar, RecCabFechaRemito, 23) as fecha, RTRIM(RecCabProvCod) as prov, RecCabAnulada as anulada
    FROM RECEPCIONCAB ORDER BY RecCabFechaGrabacion DESC
  `)
  console.log("\nÚltimas 5 recepciones (cualquier mes):")
  for (const r of ultRec) console.log(`  #${r.nro} | ${r.tipo} | ${r.fecha} | ${r.prov} | anulada=${r.anulada}`)

  // 2. CONT_MOVIMIENTOS - buscar marzo
  console.log("\n=== CONT_MOVIMIENTOS marzo 2026 ===")
  const contMov = await query<{ cnt: number; ops: string }>(`
    SELECT COUNT(*) as cnt,
      (SELECT STRING_AGG(DISTINCT RTRIM(CM_Cod_Operacion), ', ') FROM CONT_MOVIMIENTOS WHERE CM_Fecha_Movimiento >= '2026-02-01') as ops
    FROM CONT_MOVIMIENTOS
    WHERE CM_Fecha_Movimiento >= '2026-02-01' AND CM_Fecha_Movimiento < '2026-04-01'
  `)
  console.log("Filas:", contMov[0]?.cnt, "| Operaciones:", contMov[0]?.ops)

  const ultCont = await query<Record<string, unknown>>(`
    SELECT TOP 5 * FROM CONT_MOVIMIENTOS ORDER BY CM_Fecha_Hora_Movimiento DESC
  `)
  console.log("\nÚltimos 5:")
  for (const r of ultCont) console.log(JSON.stringify(r).slice(0, 300))

  // 3. Buscar CUALQUIER tabla con datos de marzo
  console.log("\n=== Buscando tablas con fechas de marzo 2026 ===")
  const candidates = [
    "INGREMITOS", "MOVSALIDAERP", "MOVEXTERNOS", "IFAZ_RECEPCIONES_CAB",
    "IFAZ_RECEPCIONESCONFIRMADAS", "CONVMOVINTERFACESERP", "SENASA_Movimientos",
  ]
  for (const t of candidates) {
    try {
      const cols = await query<{ COLUMN_NAME: string }>(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${t}' AND DATA_TYPE IN ('datetime', 'date', 'datetime2')
      `)
      for (const c of cols) {
        const cnt = await query<{ cnt: number }>(`
          SELECT COUNT(*) as cnt FROM [${t}] WHERE [${c.COLUMN_NAME}] >= '2026-02-01'
        `)
        if (cnt[0]?.cnt > 0) {
          console.log(`${t}.${c.COLUMN_NAME}: ${cnt[0].cnt} filas en marzo+`)
        }
      }
    } catch { /* skip */ }
  }

  // 4. Vista_ProduccionTotal tiene movimientos?
  console.log("\n=== Vista_ProduccionTotal marzo (tipos de operación) ===")
  try {
    const prod = await query<{ tipo: string; cnt: number }>(`
      SELECT TipoOperacion as tipo, COUNT(*) as cnt
      FROM Vista_ProduccionTotal
      WHERE Fecha >= '2026-02-01' AND Fecha < '2026-04-01'
      GROUP BY TipoOperacion ORDER BY cnt DESC
    `)
    for (const r of prod) console.log(`  ${r.tipo}: ${r.cnt} filas`)
  } catch (e: any) { console.log("Error:", e.message) }
}

main().catch(console.error)

main().catch(console.error)
