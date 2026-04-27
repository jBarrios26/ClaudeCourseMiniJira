import { useQuery } from '@tanstack/react-query'
import type { Ticket, User } from '@/shared/types'

// ─── Mock users ──────────────────────────────────────────────────────────────
const LAURA:   User = { id: '00000000-0000-0000-0000-000000000001', name: 'Laura Gómez',    email: 'laura@company.internal',   role: 'admin', removedAt: null }
const MARCOS:  User = { id: '00000000-0000-0000-0000-000000000002', name: 'Marcos Reyes',   email: 'marcos@company.internal',  role: 'admin', removedAt: null }
const SOFIA:   User = { id: '00000000-0000-0000-0000-000000000003', name: 'Sofia Vargas',   email: 'sofia@company.internal',   role: 'user',  removedAt: null }
const ROBERTO: User = { id: '00000000-0000-0000-0000-000000000004', name: 'Roberto Núñez',  email: 'roberto@company.internal', role: 'user',  removedAt: null }
const ANA:     User = { id: '00000000-0000-0000-0000-000000000005', name: 'Ana Torres',     email: 'ana@company.internal',     role: 'user',  removedAt: null }
const DIEGO:   User = { id: '00000000-0000-0000-0000-000000000006', name: 'Diego Castillo', email: 'diego@company.internal',   role: 'user',  removedAt: null }
const VALERIA: User = { id: '00000000-0000-0000-0000-000000000007', name: 'Valeria Ruiz',   email: 'valeria@company.internal', role: 'user',  removedAt: null }

export const MOCK_MEMBERS: User[] = [LAURA, MARCOS, SOFIA, ROBERTO, ANA, DIEGO, VALERIA]

// ─── Mock tickets (12 active from mock.sql) ──────────────────────────────────
const MOCK_TICKETS: Ticket[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    title: 'Set up PostgreSQL schema and run initial migration',
    description: 'Create all tables via Prisma migrate and verify the schema matches ADR-001.',
    status: 'done', priority: 'high',
    assigneeId: MARCOS.id, assignee: MARCOS,
    createdBy: MARCOS,
    labels: [{ id: 7, name: 'database' }, { id: 10, name: 'chore' }],
    version: 3, archivedAt: null,
    createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-10T15:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    title: 'Implement JWT auth — access + refresh token flow',
    description: 'Issue access tokens (15 min TTL) and refresh tokens (7 days).',
    status: 'in_review', priority: 'high',
    assigneeId: SOFIA.id, assignee: SOFIA,
    createdBy: MARCOS,
    labels: [{ id: 6, name: 'auth' }, { id: 4, name: 'backend' }],
    version: 2, archivedAt: null,
    createdAt: '2026-04-05T10:00:00Z', updatedAt: '2026-04-18T12:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    title: 'Ticket CRUD API — create, read, update, archive',
    description: 'REST endpoints with optimistic locking: reject update if version mismatch → HTTP 409.',
    status: 'in_progress', priority: 'high',
    assigneeId: SOFIA.id, assignee: SOFIA,
    createdBy: LAURA,
    labels: [{ id: 2, name: 'feature' }, { id: 4, name: 'backend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-08T10:00:00Z', updatedAt: '2026-04-20T09:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    title: 'Board view — Kanban columns by status',
    description: 'Four columns: To Do / In Progress / In Review / Done. Drag-and-drop.',
    status: 'in_progress', priority: 'medium',
    assigneeId: ROBERTO.id, assignee: ROBERTO,
    createdBy: LAURA,
    labels: [{ id: 2, name: 'feature' }, { id: 5, name: 'frontend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-08T11:00:00Z', updatedAt: '2026-04-21T10:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000005',
    title: 'Dashboard — tickets closed per month (bar chart)',
    description: 'Use DATE_TRUNC month aggregation. Render with Recharts BarChart.',
    status: 'to_do', priority: 'medium',
    assigneeId: ANA.id, assignee: ANA,
    createdBy: LAURA,
    labels: [{ id: 8, name: 'dashboard' }, { id: 5, name: 'frontend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-10T09:00:00Z', updatedAt: '2026-04-10T09:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000006',
    title: 'Dashboard — current ticket count by status (donut chart)',
    description: 'Live count grouped by status for active tickets. Recharts PieChart.',
    status: 'to_do', priority: 'medium',
    assigneeId: ANA.id, assignee: ANA,
    createdBy: LAURA,
    labels: [{ id: 8, name: 'dashboard' }, { id: 5, name: 'frontend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-10T09:30:00Z', updatedAt: '2026-04-10T09:30:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000007',
    title: 'Email notification — ticket assigned to you',
    description: 'Trigger via Resend when assignee_id changes. Include ticket title and deep link.',
    status: 'to_do', priority: 'medium',
    assigneeId: DIEGO.id, assignee: DIEGO,
    createdBy: MARCOS,
    labels: [{ id: 9, name: 'notifications' }, { id: 4, name: 'backend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000008',
    title: 'Email notification — @mention in comment',
    description: 'Parse comment body for @username patterns and send notification.',
    status: 'to_do', priority: 'medium',
    assigneeId: DIEGO.id, assignee: DIEGO,
    createdBy: MARCOS,
    labels: [{ id: 9, name: 'notifications' }, { id: 4, name: 'backend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-11T10:30:00Z', updatedAt: '2026-04-11T10:30:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000009',
    title: 'Metrics CSV export endpoint',
    description: 'GET /metrics/export with date range. Returns structured CSV per §2.10.',
    status: 'to_do', priority: 'low',
    assigneeId: null, assignee: null,
    createdBy: LAURA,
    labels: [{ id: 8, name: 'dashboard' }, { id: 4, name: 'backend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-12T09:00:00Z', updatedAt: '2026-04-12T09:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000010',
    title: 'Role-based access control middleware',
    description: 'Express middleware that reads JWT role claim and enforces the capability matrix.',
    status: 'in_progress', priority: 'high',
    assigneeId: VALERIA.id, assignee: VALERIA,
    createdBy: MARCOS,
    labels: [{ id: 6, name: 'auth' }, { id: 4, name: 'backend' }],
    version: 2, archivedAt: null,
    createdAt: '2026-04-13T10:00:00Z', updatedAt: '2026-04-21T14:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000011',
    title: 'Ticket filter & search — status, priority, assignee, labels, date range',
    description: 'Query params on GET /tickets. All filters are optional and combinable.',
    status: 'to_do', priority: 'medium',
    assigneeId: ROBERTO.id, assignee: ROBERTO,
    createdBy: LAURA,
    labels: [{ id: 2, name: 'feature' }, { id: 5, name: 'frontend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-14T09:00:00Z', updatedAt: '2026-04-14T09:00:00Z',
  },
  {
    id: '10000000-0000-0000-0000-000000000012',
    title: 'Optimistic locking — HTTP 409 conflict UI',
    description: 'When API returns 409, show non-dismissible banner with exact conflict message.',
    status: 'to_do', priority: 'medium',
    assigneeId: SOFIA.id, assignee: SOFIA,
    createdBy: LAURA,
    labels: [{ id: 1, name: 'bug' }, { id: 5, name: 'frontend' }],
    version: 1, archivedAt: null,
    createdAt: '2026-04-14T10:00:00Z', updatedAt: '2026-04-14T10:00:00Z',
  },
]

export function useBoardTickets() {
  return useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: import.meta.env.DEV
      ? () => Promise.resolve(MOCK_TICKETS)
      : () =>
          fetch(`${import.meta.env.VITE_API_BASE_URL}/tickets`)
            .then((r) => r.json()),
    staleTime: 30_000,
  })
}
