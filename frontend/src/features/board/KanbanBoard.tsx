import { useOptimistic, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { useBoardStore } from '@/shared/stores/boardStore'
import type { Ticket, TicketStatus } from '@/shared/types'
import { KanbanColumn, COLUMN_CONFIG } from './KanbanColumn'
import { TaskCard } from './TaskCard'

const COLUMN_STATUSES = Object.keys(COLUMN_CONFIG) as TicketStatus[]

function simulateMoveTicket(): Promise<void> {
  return new Promise((resolve, reject) =>
    setTimeout(
      () => (Math.random() < 0.15 ? reject(new Error('Server error')) : resolve()),
      1000 + Math.random() * 600,
    ),
  )
}

interface KanbanBoardProps {
  tickets: Ticket[]
}

export function KanbanBoard({ tickets }: KanbanBoardProps) {
  const queryClient = useQueryClient()
  const setActiveTicket = useBoardStore((s) => s.setActiveTicket)
  const setPendingMove  = useBoardStore((s) => s.setPendingMove)
  const activeTicketId  = useBoardStore((s) => s.activeTicketId)

  const [optimisticTickets, addOptimisticMove] = useOptimistic(
    tickets,
    (state: Ticket[], { ticketId, newStatus }: { ticketId: string; newStatus: TicketStatus }) =>
      state.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)),
  )

  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveTicket(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null)
    const { active, over } = event
    if (!over) return

    const ticketId = active.id as string
    const newStatus = over.id as TicketStatus
    const ticket = optimisticTickets.find((t) => t.id === ticketId)
    if (!ticket || ticket.status === newStatus) return

    startTransition(async () => {
      addOptimisticMove({ ticketId, newStatus })
      setPendingMove(ticketId)
      try {
        await simulateMoveTicket()
        queryClient.setQueryData<Ticket[]>(['tickets'], (old = []) =>
          old.map((t) =>
            t.id === ticketId ? { ...t, status: newStatus, version: t.version + 1 } : t,
          ),
        )
      } catch {
        // useOptimistic reverts to canonical state automatically when transition ends
      } finally {
        setPendingMove(null)
      }
    })
  }

  const byStatus = (status: TicketStatus) =>
    optimisticTickets.filter((t) => t.status === status)

  const activeTicket = optimisticTickets.find((t) => t.id === activeTicketId) ?? null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 items-start">
        {COLUMN_STATUSES.map((status) => (
          <KanbanColumn key={status} status={status} tickets={byStatus(status)} />
        ))}
      </div>

      <DragOverlay>
        {activeTicket && <TaskCard ticket={activeTicket} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
