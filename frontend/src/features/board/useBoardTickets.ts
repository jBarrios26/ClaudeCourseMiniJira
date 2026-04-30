import { useQuery } from '@tanstack/react-query'
import type { User, TicketFilters } from '@/shared/types'
import { fetchTickets } from '@/shared/api/api'

// ─── Mock users (still used by BoardPage and useMembers) ─────────────────────
const LAURA:   User = { id: '00000000-0000-0000-0000-000000000001', name: 'Laura Gómez',    email: 'laura@company.internal',   role: 'admin', removedAt: null }
const MARCOS:  User = { id: '00000000-0000-0000-0000-000000000002', name: 'Marcos Reyes',   email: 'marcos@company.internal',  role: 'admin', removedAt: null }
const SOFIA:   User = { id: '00000000-0000-0000-0000-000000000003', name: 'Sofia Vargas',   email: 'sofia@company.internal',   role: 'user',  removedAt: null }
const ROBERTO: User = { id: '00000000-0000-0000-0000-000000000004', name: 'Roberto Núñez',  email: 'roberto@company.internal', role: 'user',  removedAt: null }
const ANA:     User = { id: '00000000-0000-0000-0000-000000000005', name: 'Ana Torres',     email: 'ana@company.internal',     role: 'user',  removedAt: null }
const DIEGO:   User = { id: '00000000-0000-0000-0000-000000000006', name: 'Diego Castillo', email: 'diego@company.internal',   role: 'user',  removedAt: null }
const VALERIA: User = { id: '00000000-0000-0000-0000-000000000007', name: 'Valeria Ruiz',   email: 'valeria@company.internal', role: 'user',  removedAt: null }

export const MOCK_MEMBERS: User[] = [LAURA, MARCOS, SOFIA, ROBERTO, ANA, DIEGO, VALERIA]

export function useBoardTickets(filters?: TicketFilters) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => fetchTickets(filters),
    staleTime: 30_000,
  })
}
