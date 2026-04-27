import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/authStore'

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
