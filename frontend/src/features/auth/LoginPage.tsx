import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { User } from '@/shared/types'

const MOCK_USERS: User[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Laura Gómez',    email: 'laura@company.internal',   role: 'admin', removedAt: null },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Marcos Reyes',   email: 'marcos@company.internal',  role: 'admin', removedAt: null },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Sofia Vargas',   email: 'sofia@company.internal',   role: 'user',  removedAt: null },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Roberto Núñez',  email: 'roberto@company.internal', role: 'user',  removedAt: null },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Ana Torres',     email: 'ana@company.internal',     role: 'user',  removedAt: null },
  { id: '00000000-0000-0000-0000-000000000006', name: 'Diego Castillo', email: 'diego@company.internal',   role: 'user',  removedAt: null },
  { id: '00000000-0000-0000-0000-000000000007', name: 'Valeria Ruiz',   email: 'valeria@company.internal', role: 'user',  removedAt: null },
]

export function LoginPage() {
  const { user, setAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/board', { replace: true })
  }, [user, navigate])

  function loginAs(mockUser: User) {
    setAuth(mockUser, 'dev-token')
    navigate('/board', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm space-y-6">

        {/* Card principal */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mini Jira</h1>
            <p className="text-sm text-muted-foreground mt-1">Inicia sesión para continuar</p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@empresa.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="••••••••" autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled>
              Entrar
            </Button>
          </form>
        </div>

        {/* Dev bypass — solo en desarrollo */}
        {import.meta.env.DEV && (
          <div className="bg-card border border-dashed border-amber-400 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-amber-600">DEV</span>
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">sin backend</span>
            </div>
            <p className="text-xs text-muted-foreground">Entra directamente como uno de los usuarios del mock:</p>
            <div className="flex flex-col gap-1.5">
              {MOCK_USERS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => loginAs(u)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                >
                  <span className="flex-1 font-medium">{u.name}</span>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                    {u.role}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
