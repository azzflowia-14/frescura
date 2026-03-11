"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Timer,
  TrendingUp,
  AlertTriangle,
  Warehouse,
  Users,
  Truck,
  Database,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/frescura", label: "Frescura", icon: Timer },
  { href: "/venta-diaria", label: "Venta Diaria", icon: TrendingUp },
  { href: "/fefo", label: "FEFO Vulnerado", icon: AlertTriangle },
  { href: "/ocupacion", label: "Ocupación", icon: Warehouse },
  { href: "/productividad", label: "Productividad", icon: Users },
  { href: "/despachos", label: "Despachos", icon: Truck },
  { href: "/explorador", label: "Explorador SQL", icon: Database },
]

export function NavSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`flex flex-col bg-zinc-950 border-r border-zinc-800 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-600 shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white leading-none">WMS Dashboard</h1>
            <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Mercosur Pampeana</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-orange-600/15 text-orange-400 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-orange-400" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
