import Link from "next/link"
import { ExplorerClient } from "./explorer-client"

export default function Home() {
  return (
    <>
      {/* Quick nav bar */}
      <div className="bg-zinc-900 border-b border-border px-4 py-2 flex items-center gap-4">
        <Link
          href="/frescura"
          className="text-sm font-medium px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 text-white transition-colors"
        >
          Frescura / Vencimientos
        </Link>
        <span className="text-xs text-muted-foreground">|</span>
        <span className="text-xs text-muted-foreground">Explorador de base de datos WMS</span>
      </div>
      <ExplorerClient />
    </>
  )
}
