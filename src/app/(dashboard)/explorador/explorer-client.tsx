"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getTablesAndViews,
  getTablePreview,
  runCustomQuery,
  testConnection,
  type TableInfo,
  type ColumnInfo,
} from "@/actions/db-explorer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Types ──────────────────────────────────────────────────────────

interface PreviewData {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  totalRows: number
}

interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

// ── Main Component ─────────────────────────────────────────────────

export function ExplorerClient() {
  // Connection
  const [connected, setConnected] = useState<boolean | null>(null)
  const [connMessage, setConnMessage] = useState("")
  const [serverVersion, setServerVersion] = useState("")

  // Tables
  const [tables, setTables] = useState<TableInfo[]>([])
  const [tableFilter, setTableFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "TABLE" | "VIEW">("ALL")
  const [loadingTables, setLoadingTables] = useState(false)

  // Preview
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Custom query
  const [customSql, setCustomSql] = useState("")
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [loadingQuery, setLoadingQuery] = useState(false)
  const [queryError, setQueryError] = useState("")

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // ── Connection test ──────────────────────────────────────────────

  async function handleTestConnection() {
    setConnected(null)
    setConnMessage("Conectando...")
    const result = await testConnection()
    setConnected(result.success)
    setConnMessage(result.message)
    if (result.serverVersion) setServerVersion(result.serverVersion)
    if (result.success) loadTables()
  }

  async function loadTables() {
    setLoadingTables(true)
    try {
      const data = await getTablesAndViews()
      setTables(data)
    } catch (e: unknown) {
      setConnMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingTables(false)
    }
  }

  // ── Table preview ────────────────────────────────────────────────

  const loadPreview = useCallback(async (table: TableInfo) => {
    setSelectedTable(table)
    setLoadingPreview(true)
    try {
      const data = await getTablePreview(table.schema, table.name, 100)
      setPreview(data)
      setLastRefresh(new Date())
    } catch {
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  // ── Auto-refresh ─────────────────────────────────────────────────

  useEffect(() => {
    if (!autoRefresh || !selectedTable) return
    const interval = setInterval(() => {
      loadPreview(selectedTable)
    }, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, selectedTable, loadPreview])

  // ── Custom query ─────────────────────────────────────────────────

  async function handleRunQuery() {
    if (!customSql.trim()) return
    setLoadingQuery(true)
    setQueryError("")
    setQueryResult(null)
    try {
      const result = await runCustomQuery(customSql)
      setQueryResult(result)
    } catch (e: unknown) {
      setQueryError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingQuery(false)
    }
  }

  // ── Filtered tables ──────────────────────────────────────────────

  const filteredTables = tables.filter((t) => {
    const matchType = typeFilter === "ALL" || t.type === typeFilter
    const matchName =
      !tableFilter ||
      t.name.toLowerCase().includes(tableFilter.toLowerCase()) ||
      t.schema.toLowerCase().includes(tableFilter.toLowerCase())
    return matchType && matchName
  })

  const viewCount = tables.filter((t) => t.type === "VIEW").length
  const tableCount = tables.filter((t) => t.type === "TABLE").length

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Frescura</h1>
            <Badge variant="outline" className="text-xs">
              WMS Dashboard
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {connected === true && (
              <Badge variant="default" className="bg-emerald-600">
                Conectado
              </Badge>
            )}
            {connected === false && (
              <Badge variant="destructive">Desconectado</Badge>
            )}
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Actualizado: {lastRefresh.toLocaleTimeString("es-AR")}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">
        {/* Connection Card */}
        {connected !== true && (
          <Card>
            <CardHeader>
              <CardTitle>Conexión a SQL Server</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Servidor</p>
                  <p className="font-mono">192.168.20.9:1433</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Base de datos</p>
                  <p className="font-mono">SGLWMS_MD_PROD</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-mono">MercosurFausto</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <p className={connected === false ? "text-red-400" : "text-muted-foreground"}>
                    {connMessage || "Sin conectar"}
                  </p>
                </div>
              </div>
              <Button onClick={handleTestConnection} disabled={connected === null && connMessage === "Conectando..."}>
                {connMessage === "Conectando..." ? "Conectando..." : "Probar Conexión"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Connected: show server info */}
        {connected === true && serverVersion && (
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Servidor:</span>
                  <span className="font-mono text-xs">{serverVersion}</span>
                  <span className="text-muted-foreground ml-4">Base:</span>
                  <span className="font-mono">SGLWMS_MD_PROD</span>
                  <span className="text-muted-foreground ml-4">Objetos:</span>
                  <span>{tableCount} tablas, {viewCount} vistas</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleTestConnection}>
                  Reconectar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content */}
        {connected === true && (
          <Tabs defaultValue="explorer" className="space-y-4">
            <TabsList>
              <TabsTrigger value="explorer">Explorador</TabsTrigger>
              <TabsTrigger value="query">Consulta SQL</TabsTrigger>
            </TabsList>

            {/* ── Tab: Explorer ────────────────────────────────────── */}
            <TabsContent value="explorer" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4">
                {/* Sidebar: Table list */}
                <Card className="h-fit lg:max-h-[calc(100vh-220px)] flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tablas y Vistas</CardTitle>
                    <div className="space-y-2 pt-2">
                      <Input
                        placeholder="Buscar tabla o vista..."
                        value={tableFilter}
                        onChange={(e) => setTableFilter(e.target.value)}
                        className="text-sm"
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={typeFilter === "ALL" ? "default" : "outline"}
                          onClick={() => setTypeFilter("ALL")}
                          className="text-xs h-7"
                        >
                          Todos ({tables.length})
                        </Button>
                        <Button
                          size="sm"
                          variant={typeFilter === "TABLE" ? "default" : "outline"}
                          onClick={() => setTypeFilter("TABLE")}
                          className="text-xs h-7"
                        >
                          Tablas ({tableCount})
                        </Button>
                        <Button
                          size="sm"
                          variant={typeFilter === "VIEW" ? "default" : "outline"}
                          onClick={() => setTypeFilter("VIEW")}
                          className="text-xs h-7"
                        >
                          Vistas ({viewCount})
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 overflow-hidden">
                    {loadingTables ? (
                      <div className="space-y-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : (
                      <ScrollArea className="h-[calc(100vh-400px)]">
                        <div className="space-y-0.5 pr-3">
                          {filteredTables.map((t) => (
                            <button
                              key={`${t.schema}.${t.name}`}
                              onClick={() => loadPreview(t)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent flex items-center justify-between gap-2 ${
                                selectedTable?.name === t.name && selectedTable?.schema === t.schema
                                  ? "bg-accent text-accent-foreground"
                                  : ""
                              }`}
                            >
                              <span className="truncate font-mono text-xs">
                                {t.schema !== "dbo" && (
                                  <span className="text-muted-foreground">{t.schema}.</span>
                                )}
                                {t.name}
                              </span>
                              <Badge
                                variant={t.type === "VIEW" ? "secondary" : "outline"}
                                className="text-[10px] shrink-0 px-1.5"
                              >
                                {t.type === "VIEW" ? "V" : "T"}
                              </Badge>
                            </button>
                          ))}
                          {filteredTables.length === 0 && (
                            <p className="text-center text-sm text-muted-foreground py-8">
                              No se encontraron resultados
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {/* Main: Table preview */}
                <Card>
                  {!selectedTable && !loadingPreview && (
                    <CardContent className="py-20">
                      <p className="text-center text-muted-foreground">
                        Seleccioná una tabla o vista del panel izquierdo para ver sus datos
                      </p>
                    </CardContent>
                  )}

                  {selectedTable && (
                    <>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-base font-mono">
                              {selectedTable.schema !== "dbo" && `${selectedTable.schema}.`}
                              {selectedTable.name}
                            </CardTitle>
                            <Badge variant={selectedTable.type === "VIEW" ? "secondary" : "outline"}>
                              {selectedTable.type}
                            </Badge>
                            {preview && (
                              <span className="text-sm text-muted-foreground">
                                {preview.totalRows.toLocaleString("es-AR")} filas
                                {preview.columns.length > 0 && ` · ${preview.columns.length} columnas`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => selectedTable && loadPreview(selectedTable)}
                              disabled={loadingPreview}
                            >
                              {loadingPreview ? "Cargando..." : "Refrescar"}
                            </Button>
                            <div className="flex items-center gap-2 border rounded-md px-2 py-1">
                              <label className="text-xs text-muted-foreground whitespace-nowrap">
                                Auto:
                              </label>
                              <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="accent-primary"
                              />
                              {autoRefresh && (
                                <Select
                                  value={String(refreshInterval)}
                                  onValueChange={(v) => setRefreshInterval(Number(v))}
                                >
                                  <SelectTrigger className="h-6 w-16 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="5">5s</SelectItem>
                                    <SelectItem value="10">10s</SelectItem>
                                    <SelectItem value="30">30s</SelectItem>
                                    <SelectItem value="60">60s</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Column info */}
                        {preview && preview.columns.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2">
                            {preview.columns.map((col) => (
                              <Badge
                                key={col.name}
                                variant="outline"
                                className="text-[10px] font-mono gap-1"
                              >
                                {col.name}
                                <span className="text-muted-foreground">{col.type}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="pt-0">
                        {loadingPreview ? (
                          <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 w-full" />
                            ))}
                          </div>
                        ) : preview && preview.rows.length > 0 ? (
                          <ScrollArea className="max-h-[calc(100vh-380px)]">
                            <div className="min-w-max">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs w-12 text-center">#</TableHead>
                                    {preview.columns.map((col) => (
                                      <TableHead key={col.name} className="text-xs font-mono whitespace-nowrap">
                                        {col.name}
                                      </TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {preview.rows.map((row, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs text-muted-foreground text-center">
                                        {i + 1}
                                      </TableCell>
                                      {preview.columns.map((col) => (
                                        <TableCell key={col.name} className="text-xs font-mono max-w-[300px] truncate">
                                          {formatCell(row[col.name])}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">
                            Sin datos
                          </p>
                        )}
                      </CardContent>
                    </>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* ── Tab: Custom Query ────────────────────────────────── */}
            <TabsContent value="query" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Consulta SQL personalizada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <textarea
                      className="w-full h-32 bg-zinc-900 border border-border rounded-md p-3 font-mono text-sm text-zinc-100 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="SELECT TOP 100 * FROM dbo.NombreTabla WHERE ..."
                      value={customSql}
                      onChange={(e) => setCustomSql(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          handleRunQuery()
                        }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Solo SELECT. Ctrl+Enter para ejecutar. Limite: 200 filas.
                      </p>
                      <Button onClick={handleRunQuery} disabled={loadingQuery || !customSql.trim()}>
                        {loadingQuery ? "Ejecutando..." : "Ejecutar"}
                      </Button>
                    </div>
                  </div>

                  {queryError && (
                    <div className="bg-red-950/50 border border-red-800 rounded-md p-3 text-sm text-red-300">
                      {queryError}
                    </div>
                  )}

                  {queryResult && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {queryResult.rowCount} filas · {queryResult.columns.length} columnas
                      </p>
                      <ScrollArea className="max-h-[calc(100vh-500px)]">
                        <div className="min-w-max">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs w-12 text-center">#</TableHead>
                                {queryResult.columns.map((col) => (
                                  <TableHead key={col} className="text-xs font-mono whitespace-nowrap">
                                    {col}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queryResult.rows.map((row, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs text-muted-foreground text-center">
                                    {i + 1}
                                  </TableCell>
                                  {queryResult.columns.map((col) => (
                                    <TableCell key={col} className="text-xs font-mono max-w-[300px] truncate">
                                      {formatCell(row[col])}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return value.toLocaleString("es-AR")
  if (typeof value === "string") {
    // ISO date
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        const d = new Date(value)
        return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      } catch {
        return value
      }
    }
    return value.length > 100 ? value.slice(0, 100) + "..." : value
  }
  return String(value)
}
