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
  BookOpen,
  FileBarChart,
  BarChart3,
} from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/frescura", label: "Frescura", icon: Timer },
  { href: "/venta-diaria", label: "Venta Diaria", icon: TrendingUp },
  { href: "/fefo", label: "FEFO Vulnerado", icon: AlertTriangle },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/gerencial", label: "Gerencial", icon: FileBarChart },
  { href: "/analisis", label: "Análisis", icon: BarChart3 },
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
      className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-200 shadow-sm ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-slate-200">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-slate-800 leading-none">WMS Dashboard</h1>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Mercosur Pampeana</p>
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
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
