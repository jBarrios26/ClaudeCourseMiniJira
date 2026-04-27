import { useDraggable } from '@dnd-kit/core'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/shared/stores/boardStore'
import type { Ticket, TicketPriority } from '@/shared/types'

export interface TaskCardProps {
  ticket: Ticket
  isDragging?: boolean
}

export const PRIORITY_VARIANTS: Record<TicketPriority, { className: string; label: string }> = {
  high:   { className: 'bg-error_container text-on_error_container',        label: 'High Priority' },
  medium: { className: 'bg-primary_container text-on_primary_fixed',        label: 'Medium'        },
  low:    { className: 'bg-surface_container_high text-inverse_surface/60', label: 'Low Priority'  },
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <span className="w-6 h-6 rounded-full bg-primary_container text-on_primary_fixed text-[0.625rem] font-semibold flex items-center justify-center select-none">
      {initials}
    </span>
  )
}

export function TaskCard({ ticket, isDragging }: TaskCardProps) {
  const isBlocked = ticket.labels.some((l) => l.name === 'blocked')
  const isPendingMove = useBoardStore((s) => s.pendingMoveId === ticket.id)
  const { className: priorityClass, label: priorityLabel } = PRIORITY_VARIANTS[ticket.priority]

  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: ticket.id })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'bg-surface_container_lowest shadow-ambient rounded-lg pt-4 pl-4 pr-3 pb-3 flex flex-col gap-2.5 cursor-grab select-none',
        isBlocked && 'border-l-2 border-error_container',
        isDragging && 'opacity-50 rotate-1',
        isPendingMove && 'ring-2 ring-primary/40',
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-label-sm px-2 py-0.5 rounded-md font-medium', priorityClass)}>
          {priorityLabel}
        </span>
        <span className="text-label-sm text-inverse_surface/40 shrink-0">
          {ticket.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      {/* Title */}
      <p className="text-body-md font-medium text-inverse_surface line-clamp-2 leading-snug">
        {ticket.title}
      </p>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex items-center gap-1 text-inverse_surface/40">
          <MessageSquare size={13} />
          <span className="text-label-sm">{0}</span>
        </div>
        {ticket.assignee && <Avatar name={ticket.assignee.name} />}
      </div>
    </div>
  )
}
