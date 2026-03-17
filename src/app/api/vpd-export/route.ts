import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function POST(request: Request) {
  try {
    const { rows, periodo } = await request.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Sin datos" }, { status: 400 })
    }

    const ws = XLSX.utils.json_to_sheet(rows)

    ws["!cols"] = [
      { wch: 10 },  // Cod SKU
      { wch: 40 },  // Descripcion
      { wch: 15 },  // Division
      { wch: 15 },  // Marca
      { wch: 20 },  // VPD
      { wch: 18 },  // Venta Neta
      { wch: 14 },  // Total Bultos
      { wch: 12 },  // Rechazos
      { wch: 14 },  // Dias c/Venta
      { wch: 14 },  // Frecuencia
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `VPD ${periodo || 30} dias`)

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="VPD_${periodo || 30}dias_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
