"use server"

import { query } from "@/lib/db"

export interface TableInfo {
  schema: string
  name: string
  type: "TABLE" | "VIEW"
  rows: number | null
}

export interface ColumnInfo {
  name: string
  type: string
  maxLength: number | null
  isNullable: boolean
}

export interface TablePreview {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  totalRows: number
}

export async function getTablesAndViews(): Promise<TableInfo[]> {
  try {
    const result = await query<{
      TABLE_SCHEMA: string
      TABLE_NAME: string
      TABLE_TYPE: string
    }>(`
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_TYPE, TABLE_SCHEMA, TABLE_NAME
    `)

    return result.map((r) => ({
      schema: r.TABLE_SCHEMA,
      name: r.TABLE_NAME,
      type: r.TABLE_TYPE === "VIEW" ? "VIEW" : "TABLE",
      rows: null,
    }))
  } catch (error: unknown) {
    console.error("Error fetching tables:", error)
    throw new Error(
      `No se pudo conectar a la base de datos: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function getTablePreview(
  schema: string,
  tableName: string,
  limit: number = 100
): Promise<TablePreview> {
  try {
    // Get column info
    const cols = await query<{
      COLUMN_NAME: string
      DATA_TYPE: string
      CHARACTER_MAXIMUM_LENGTH: number | null
      IS_NULLABLE: string
    }>(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION
    `, { schema, table: tableName })

    const columns: ColumnInfo[] = cols.map((c) => ({
      name: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      maxLength: c.CHARACTER_MAXIMUM_LENGTH,
      isNullable: c.IS_NULLABLE === "YES",
    }))

    // Get row count
    const countResult = await query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM [${schema}].[${tableName}]`
    )
    const totalRows = countResult[0]?.cnt || 0

    // Get preview rows
    const rows = await query(
      `SELECT TOP (${Number(limit)}) * FROM [${schema}].[${tableName}]`
    )

    // Serialize dates and buffers for client
    const serializedRows = rows.map((row) => {
      const newRow: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        if (value instanceof Date) {
          newRow[key] = value.toISOString()
        } else if (Buffer.isBuffer(value)) {
          newRow[key] = `[binary ${value.length} bytes]`
        } else {
          newRow[key] = value
        }
      }
      return newRow
    })

    return { columns, rows: serializedRows, totalRows }
  } catch (error: unknown) {
    console.error("Error fetching table preview:", error)
    throw new Error(
      `Error al consultar ${schema}.${tableName}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function runCustomQuery(
  queryStr: string,
  limit: number = 200
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }> {
  // Basic safety: block destructive operations
  const upper = queryStr.trim().toUpperCase()
  if (
    upper.startsWith("DROP") ||
    upper.startsWith("DELETE") ||
    upper.startsWith("TRUNCATE") ||
    upper.startsWith("ALTER") ||
    upper.startsWith("INSERT") ||
    upper.startsWith("UPDATE") ||
    upper.startsWith("EXEC") ||
    upper.startsWith("CREATE")
  ) {
    throw new Error("Solo se permiten consultas SELECT (lectura)")
  }

  try {
    // Wrap in TOP if no TOP/OFFSET present
    let finalQuery = queryStr.trim()
    if (!upper.includes("TOP") && !upper.includes("OFFSET")) {
      finalQuery = finalQuery.replace(/^SELECT/i, `SELECT TOP (${limit})`)
    }

    const rows = await query(finalQuery)
    const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : []

    const serializedRows = rows.map((row) => {
      const newRow: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        if (value instanceof Date) {
          newRow[key] = value.toISOString()
        } else if (Buffer.isBuffer(value)) {
          newRow[key] = `[binary ${value.length} bytes]`
        } else {
          newRow[key] = value
        }
      }
      return newRow
    })

    return { columns, rows: serializedRows, rowCount: serializedRows.length }
  } catch (error: unknown) {
    console.error("Error running query:", error)
    throw new Error(
      `Error en query: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function testConnection(): Promise<{ success: boolean; message: string; serverVersion?: string }> {
  try {
    const result = await query<{ version: string }>("SELECT @@VERSION as version")
    return {
      success: true,
      message: "Conexión exitosa",
      serverVersion: result[0]?.version?.split("\n")[0] || "Unknown",
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
