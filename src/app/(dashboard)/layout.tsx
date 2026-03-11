import { NavSidebar } from "@/components/nav-sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <NavSidebar />
      <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
    </div>
  )
}
