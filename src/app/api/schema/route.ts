import { query } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const rows = await query<{
      TABLE_SCHEMA: string
      TABLE_NAME: string
      TABLE_TYPE: string
      COLUMN_NAME: string
      DATA_TYPE: string
      CHARACTER_MAXIMUM_LENGTH: number | null
      IS_NULLABLE: string
      ORDINAL_POSITION: number
    }>(`
      SELECT
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        t.TABLE_TYPE,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.IS_NULLABLE,
        c.ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.TABLES t
        ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME
      ORDER BY t.TABLE_TYPE, t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION
    `)

    let currentTable = ""
    let output = "=== SCHEMA COMPLETO DE SGLWMS_MD_PROD ===\n"
    output += `Generado: ${new Date().toISOString()}\n\n`

    let tableCount = 0
    let viewCount = 0

    for (const row of rows) {
      const fullName = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`
      if (fullName !== currentTable) {
        currentTable = fullName
        const type = row.TABLE_TYPE === "VIEW" ? "VISTA" : "TABLA"
        if (row.TABLE_TYPE === "VIEW") viewCount++
        else tableCount++
        output += `\n${"─".repeat(60)}\n`
        output += `[${type}] ${fullName}\n`
        output += `${"─".repeat(60)}\n`
      }
      const nullable = row.IS_NULLABLE === "YES" ? "NULL" : "NOT NULL"
      const maxLen = row.CHARACTER_MAXIMUM_LENGTH ? `(${row.CHARACTER_MAXIMUM_LENGTH})` : ""
      output += `  ${String(row.ORDINAL_POSITION).padStart(3, " ")}. ${row.COLUMN_NAME.padEnd(40)} ${row.DATA_TYPE}${maxLen} ${nullable}\n`
    }

    output += `\n\n=== RESUMEN ===\n`
    output += `Tablas: ${tableCount}\n`
    output += `Vistas: ${viewCount}\n`
    output += `Total columnas: ${rows.length}\n`

    return new NextResponse(output, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=schema_wms.txt",
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
