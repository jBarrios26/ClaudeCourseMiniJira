export type UserRole = 'user' | 'admin'
export type TicketStatus = 'to_do' | 'in_progress' | 'in_review' | 'done'
export type TicketPriority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  removedAt: string | null
}

export interface Label {
  id: number
  name: string
}

export interface Ticket {
  id: string
  title: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  assignee: User | null
  createdBy: User | null
  labels: Label[]
  version: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  ticketId: string
  authorId: string | null
  author: User | null
  body: string
  createdAt: string
}

export interface TicketDraft {
  ticketId: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  labelIds: number[]
  version: number
  savedAt: string
}

export interface UpdateTicketPayload {
  title?: string
  description?: string
  status?: TicketStatus
  priority?: TicketPriority
  assigneeId?: string | null
  labelIds?: number[]
  version: number
}

export interface ConflictResponse {
  updatedByName: string
  updatedById: string
}

export interface DashboardMetrics {
  monthlyClosedTickets: { month: string; count: number }[]
  statusBreakdown: { status: TicketStatus; count: number }[]
  topAssignees: { user: User; closedCount: number }[]
}

export interface TicketFilters {
  status?: TicketStatus
  priority?: TicketPriority
  assigneeId?: string
  labels?: string[]
  from?: string
  to?: string
  archived?: boolean
}
