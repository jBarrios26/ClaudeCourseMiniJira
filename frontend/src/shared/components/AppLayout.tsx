import { NavLink, Outlet } from 'react-router-dom'
import { BarChart2, FolderKanban, LayoutGrid, Users } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/authStore'
import { DraftBanner } from './DraftBanner'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex h-screen bg-surface">
      <aside className="w-56 shrink-0 bg-surface_container_low flex flex-col">
        <div className="h-14 flex items-center px-5 font-semibold text-base text-inverse_surface">
          Mini Jira
        </div>
        <nav className="flex-1 px-3 pb-3 flex flex-col gap-0.5">
          <SideNavLink to="/board" icon={<LayoutGrid size={16} />}>Board</SideNavLink>
          <SideNavLink to="/dashboard" icon={<BarChart2 size={16} />}>Dashboard</SideNavLink>
          {user?.role === 'admin' && (
            <SideNavLink to="/admin/members" icon={<Users size={16} />}>Members</SideNavLink>
          )}
          {user?.role === 'admin' && (
            <SideNavLink to="/admin/projects" icon={<FolderKanban size={16} />}>Projects</SideNavLink>
          )}
        </nav>
        <div className="px-5 py-4 text-body-md text-inverse_surface/50 truncate">
          {user?.name}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <DraftBanner />
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SideNavLink({
  to,
  icon,
  children,
}: {
  to: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-md text-body-md font-medium transition-colors',
          isActive
            ? 'bg-primary_container text-on_primary_fixed'
            : 'text-inverse_surface/60 hover:bg-surface_container_high hover:text-inverse_surface',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}
