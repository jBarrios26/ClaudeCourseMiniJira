import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/shared/components/ProtectedRoute'
import { AdminRoute } from '@/shared/components/AdminRoute'
import { AppLayout } from '@/shared/components/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { BoardPage } from '@/features/board/BoardPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AdminMembersPage } from '@/features/admin/AdminMembersPage'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/board" replace /> },
          { path: 'board', element: <BoardPage /> },
          { path: 'tickets/:id', element: <BoardPage /> }, // opens board + ticket modal
          { path: 'dashboard', element: <DashboardPage /> },
          {
            element: <AdminRoute />,
            children: [{ path: 'admin/members', element: <AdminMembersPage /> }],
          },
        ],
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
