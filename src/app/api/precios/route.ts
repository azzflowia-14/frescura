import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { loadPrecios, savePrecios } from "@/lib/precios"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

    if (rows.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 })
    }

    // Find columns dynamically
    const cols = Object.keys(rows[0])
    const codCol = cols.find((c) => c.toLowerCase().includes("cod"))
    const priceCol = cols.find((c) => c.toLowerCase().includes("precio"))

    if (!codCol || !priceCol) {
      return NextResponse.json(
        { error: `No se encontraron las columnas. Columnas: ${cols.join(", ")}. Se esperan "Cod Producto" y "Precio a considerar"` },
        { status: 400 },
      )
    }

    const precios = loadPrecios()
    let actualizados = 0

    for (const r of rows) {
      const cod = String(r[codCol] || "").trim()
      let priceStr = String(r[priceCol] || "").trim()
      if (!cod || !priceStr || priceStr === "-") continue
      priceStr = priceStr.replace(/,/g, "")
      const price = parseFloat(priceStr)
      if (isNaN(price) || price <= 0) continue
      precios[cod] = price
      actualizados++
    }

    savePrecios(precios)

    return NextResponse.json({
      ok: true,
      total: Object.keys(precios).length,
      actualizados,
      filas: rows.length,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
