import "dotenv/config"
import { query } from "./src/lib/db"

async function main() {
  // 1. RECEPCIONCAB feb+marzo
  console.log("=== RECEPCIONCAB feb+marzo 2026 ===")
  const recCab = await query<{ tipo: string; cnt: number; anuladas: number }>(`
    SELECT RTRIM(RecCabTipoOperacion) as tipo, COUNT(*) as cnt,
      SUM(CASE WHEN RecCabAnulada = 1 THEN 1 ELSE 0 END) as anuladas
    FROM RECEPCIONCAB
    WHERE RecCabFechaRemito >= '2026-02-01' AND RecCabFechaRemito < '2026-04-01'
    GROUP BY RecCabTipoOperacion
  `)
  for (const r of recCab) console.log(`  ${r.tipo}: ${r.cnt} (anuladas: ${r.anuladas})`)

  // Últimas 10 recepciones
  console.log("\nÚltimas 10 recepciones:")
  const ultRec = await query<{ nro: number; tipo: string; fecha: string; prov: string; anulada: number }>(`
    SELECT TOP 10 RecCabNroAplicaWMS as nro, RTRIM(RecCabTipoOperacion) as tipo,
      CONVERT(varchar, RecCabFechaRemito, 23) as fecha, RTRIM(RecCabProvCod) as prov, RecCabAnulada as anulada
    FROM RECEPCIONCAB ORDER BY RecCabFechaGrabacion DESC
  `)
  for (const r of ultRec) console.log(`  #${r.nro} | ${r.tipo} | ${r.fecha} | ${r.prov} | anulada=${r.anulada}`)

  // 2. CONT_MOVIMIENTOS feb+marzo
  console.log("\n=== CONT_MOVIMIENTOS feb+marzo 2026 ===")
  const contMov = await query<{ op: string; cnt: number }>(`
    SELECT RTRIM(CM_Cod_Operacion) as op, COUNT(*) as cnt
    FROM CONT_MOVIMIENTOS
    WHERE CM_Fecha_Movimiento >= '2026-02-01' AND CM_Fecha_Movimiento < '2026-04-01'
    GROUP BY CM_Cod_Operacion ORDER BY cnt DESC
  `)
  if (contMov.length === 0) console.log("  Sin datos")
  for (const r of contMov) console.log(`  ${r.op}: ${r.cnt}`)

  // Últimos 5
  console.log("\nÚltimos 5 CONT_MOVIMIENTOS:")
  const ultCont = await query<{ id: number; op: string; fecha: string }>(`
    SELECT TOP 5 CM_Id_Movimiento as id, RTRIM(CM_Cod_Operacion) as op,
      CONVERT(varchar, CM_Fecha_Hora_Movimiento, 120) as fecha
    FROM CONT_MOVIMIENTOS ORDER BY CM_Fecha_Hora_Movimiento DESC
  `)
  for (const r of ultCont) console.log(`  #${r.id} | ${r.op} | ${r.fecha}`)

  // 3. Vista_ProduccionTotal feb+marzo (tiene TipoOperacion)
  console.log("\n=== Vista_ProduccionTotal feb+marzo 2026 ===")
  try {
    const prod = await query<{ tipo: string; nat: string; cnt: number }>(`
      SELECT RTRIM(TipoOperacion) as tipo, RTRIM(Naturaleza) as nat, COUNT(*) as cnt
      FROM Vista_ProduccionTotal
      WHERE Fecha >= '2026-02-01' AND Fecha < '2026-04-01'
      GROUP BY TipoOperacion, Naturaleza ORDER BY cnt DESC
    `)
    for (const r of prod) console.log(`  ${r.tipo} | ${r.nat} | ${r.cnt} filas`)
  } catch (e: any) { console.log("Error:", e.message) }

  // 4. Buscar tablas con fechas recientes
  console.log("\n=== Tablas con datos feb+ ===")
  const candidates = ["INGREMITOS", "MOVSALIDAERP", "MOVEXTERNOS", "IFAZ_RECEPCIONES_CAB", "IFAZ_RECEPCIONESCONFIRMADAS"]
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
          console.log(`  ${t}.${c.COLUMN_NAME}: ${cnt[0].cnt} filas`)
        }
      }
    } catch { /* skip */ }
  }
}

main().catch(console.error)
