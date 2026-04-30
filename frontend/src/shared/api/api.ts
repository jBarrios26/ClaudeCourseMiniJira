import api from './axiosInstance'
import { API } from './endpoints'
import type { Ticket, User, Label, Comment, Project, TicketFilters, UpdateTicketPayload, CreateProjectPayload, UpdateProjectPayload } from '@/shared/types'
import type { TicketFormValues } from '@/features/tickets/ticketSchema'

// ─── Backend shapes (snake_case, Unix timestamps) ─────────────────────────────

interface RawUser {
  id: number
  name: string
  email?: string
  role?: 'user' | 'admin'
}

interface RawTicket {
  id: number
  title: string
  description: string | null
  status: Ticket['status']
  priority: Ticket['priority']
  assignee: RawUser | null
  created_by: RawUser | null
  project_id: number | null
  labels: Label[]
  version: number
  is_archived: boolean
  archived_at: number | null
  created_at: number
  updated_at: number
}

interface RawProject {
  id: number
  name: string
  description: string | null
  created_at: number
  updated_at: number
}

interface RawComment {
  id: number
  body: string
  author: { id: number; name: string } | null
  created_at: number
}

interface LoginResponse {
  token: string
  user: RawUser & { email: string; role: 'user' | 'admin' }
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

function toProject(raw: RawProject): Project {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    createdAt: new Date(raw.created_at * 1000).toISOString(),
    updatedAt: new Date(raw.updated_at * 1000).toISOString(),
  }
}

function toComment(raw: RawComment, ticketId: string): Comment {
  return {
    id: String(raw.id),
    ticketId,
    authorId: raw.author ? String(raw.author.id) : null,
    author: raw.author
      ? { id: String(raw.author.id), name: raw.author.name, email: '', role: 'user', removedAt: null }
      : null,
    body: raw.body,
    createdAt: new Date(raw.created_at * 1000).toISOString(),
  }
}

function toUser(raw: RawUser): User {
  return {
    id: String(raw.id),
    name: raw.name,
    email: raw.email ?? '',
    role: raw.role ?? 'user',
    removedAt: null,
  }
}

function toTicket(raw: RawTicket): Ticket {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description,
    status: raw.status,
    priority: raw.priority,
    assigneeId: raw.assignee ? String(raw.assignee.id) : null,
    assignee: raw.assignee ? toUser(raw.assignee) : null,
    createdBy: raw.created_by ? toUser(raw.created_by) : null,
    projectId: raw.project_id,
    labels: raw.labels,
    version: raw.version,
    archivedAt: raw.archived_at ? new Date(raw.archived_at * 1000).toISOString() : null,
    createdAt: new Date(raw.created_at * 1000).toISOString(),
    updatedAt: new Date(raw.updated_at * 1000).toISOString(),
  }
}

// ─── P0 API functions ─────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>(API.auth.login, { email, password })
  return { token: data.token, user: toUser(data.user) }
}

export async function fetchTickets(filters?: TicketFilters): Promise<Ticket[]> {
  const params: Record<string, string> = {}
  if (filters?.status) params.status = filters.status
  if (filters?.priority) params.priority = filters.priority
  if (filters?.assigneeId) params.assignee_id = filters.assigneeId
  if (filters?.from) params.from = filters.from
  if (filters?.to) params.to = filters.to
  if (filters?.projectId !== undefined) params.project_id = String(filters.projectId)
  if (filters?.archived !== undefined) params.is_archived = String(filters.archived)
  const { data } = await api.get<RawTicket[]>(API.tickets.list, { params })
  return data.map(toTicket)
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const { data } = await api.get<RawTicket>(API.tickets.detail(id))
  return toTicket(data)
}

export async function createTicket(payload: TicketFormValues & { projectId?: number | null }): Promise<Ticket> {
  const { data } = await api.post<RawTicket>(API.tickets.list, {
    title: payload.title,
    description: payload.description ?? null,
    status: payload.status,
    priority: payload.priority,
    assignee_id: payload.assigneeId ?? null,
    project_id: payload.projectId ?? null,
    label_ids: payload.labelIds ?? [],
  })
  return toTicket(data)
}

export async function updateTicket(id: string, payload: UpdateTicketPayload): Promise<Ticket> {
  const { data } = await api.patch<RawTicket>(API.tickets.detail(id), {
    version: payload.version,
    ...(payload.title !== undefined && { title: payload.title }),
    ...(payload.description !== undefined && { description: payload.description }),
    ...(payload.status !== undefined && { status: payload.status }),
    ...(payload.priority !== undefined && { priority: payload.priority }),
    ...(payload.assigneeId !== undefined && { assignee_id: payload.assigneeId }),
    ...(payload.labelIds !== undefined && { label_ids: payload.labelIds }),
  })
  return toTicket(data)
}

export async function archiveTicket(id: string): Promise<Ticket> {
  const { data } = await api.patch<RawTicket>(API.tickets.archive(id))
  return toTicket(data)
}

export async function restoreTicket(id: string): Promise<Ticket> {
  const { data } = await api.patch<RawTicket>(API.tickets.restore(id))
  return toTicket(data)
}

export async function fetchComments(ticketId: string): Promise<Comment[]> {
  const { data } = await api.get<RawComment[]>(API.tickets.comments(ticketId))
  return data.map((c) => toComment(c, ticketId))
}

export async function createComment(ticketId: string, body: string): Promise<Comment> {
  const { data } = await api.post<RawComment>(API.tickets.comments(ticketId), { body })
  return toComment(data, ticketId)
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const { data } = await api.get<RawProject[]>(API.projects.list)
  return data.map(toProject)
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const { data } = await api.post<RawProject>(API.projects.list, payload)
  return toProject(data)
}

export async function updateProject(id: number, payload: UpdateProjectPayload): Promise<Project> {
  const { data } = await api.patch<RawProject>(API.projects.detail(id), payload)
  return toProject(data)
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(API.projects.detail(id))
}
