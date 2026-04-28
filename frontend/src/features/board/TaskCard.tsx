import { useDraggable } from '@dnd-kit/core'
import { MessageSquare, Archive, ArchiveRestore } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/shared/stores/boardStore'
import { useAuthStore } from '@/shared/stores/authStore'
import { useUpdateTicket } from '@/features/tickets/useUpdateTicket'
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

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const isOwner = ticket.createdBy?.id === user?.id
  const canArchive = isAdmin || isOwner
  const canRestore = isAdmin
  
  const { mutate: updateTicket, isPending } = useUpdateTicket()

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click if there's any
    const payload = {
      id: ticket.id,
      archivedAt: ticket.archivedAt ? null : new Date().toISOString(),
      version: ticket.version
    }
    updateTicket(payload)
  }

  const { attributes, listeners, setNodeRef, transform } = useDraggable({ 
    id: ticket.id,
    disabled: ticket.archivedAt !== null // Do not allow dragging if archived
  })

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
        'bg-surface_container_lowest shadow-ambient rounded-lg pt-4 pl-4 pr-3 pb-3 flex flex-col gap-2.5 cursor-grab select-none relative group',
        isBlocked && 'border-l-2 border-error_container',
        isDragging && 'opacity-50 rotate-1',
        isPendingMove && 'ring-2 ring-primary/40',
        ticket.archivedAt && 'opacity-60 grayscale-[0.3]'
      )}
    >
      {/* Archive / Restore Button overlay (shows on hover) */}
       <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {!ticket.archivedAt && canArchive && (
          <button
            type="button"
            className="p-1.5 rounded-md bg-surface_container_high text-inverse_surface/70 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            title="Archive Ticket"
            onClick={handleArchiveToggle}
            disabled={isPending}
            onPointerDown={(e) => e.stopPropagation()} // Let button handle click without drag interferences
          >
            <Archive size={14} />
          </button>
        )}
        {ticket.archivedAt && canRestore && (
          <button
            type="button"
            className="p-1.5 rounded-md bg-surface_container_high text-inverse_surface/70 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            title="Restore Ticket"
            onClick={handleArchiveToggle}
            disabled={isPending}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ArchiveRestore size={14} />
          </button>
        )}
      </div>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mr-8">
        <div className="flex gap-2 items-center flex-wrap">
          <span className={cn('text-label-sm px-2 py-0.5 rounded-md font-medium', priorityClass)}>
            {priorityLabel}
          </span>
          {ticket.archivedAt && (
            <span className="text-label-sm px-2 py-0.5 rounded-md font-medium bg-outline/20 text-inverse_surface/60">
              Archivado
            </span>
          )}
        </div>
        <span className="text-label-sm text-inverse_surface/40 shrink-0 hidden sm:inline">
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
