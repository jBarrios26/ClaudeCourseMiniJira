import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/authStore'

export function AdminRoute() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/board" replace />
  return <Outlet />
}
