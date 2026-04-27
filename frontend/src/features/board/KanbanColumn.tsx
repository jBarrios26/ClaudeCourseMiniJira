import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { Ticket, TicketStatus } from '@/shared/types'
import { TaskCard } from './TaskCard'

export interface KanbanColumnProps {
  status: TicketStatus
  tickets: Ticket[]
}

export const COLUMN_CONFIG: Record<TicketStatus, { label: string; dotClass: string; countClass: string }> = {
  to_do:       { label: 'To Do',       dotClass: 'bg-outline_variant',    countClass: 'text-inverse_surface/40' },
  in_progress: { label: 'In Progress', dotClass: 'bg-primary',            countClass: 'text-primary'            },
  in_review:   { label: 'Review',      dotClass: 'bg-primary_container',  countClass: 'text-on_primary_fixed'   },
  done:        { label: 'Done',        dotClass: 'bg-tertiary_container', countClass: 'text-on_tertiary_fixed'  },
}

export function KanbanColumn({ status, tickets }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const { label, dotClass, countClass } = COLUMN_CONFIG[status]

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className={cn('w-2 h-2 rounded-full', dotClass)} />
        <span className="text-label-sm text-inverse_surface/70 font-semibold">{label}</span>
        <span className={cn('ml-auto text-label-sm font-medium', countClass)}>
          {tickets.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-3 flex flex-col gap-3 min-h-32 transition-colors duration-150',
          isOver ? 'bg-surface_container_high' : 'bg-surface_container_low',
        )}
      >
        {tickets.map((ticket) => (
          <TaskCard key={ticket.id} ticket={ticket} />
        ))}

        {tickets.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center text-label-sm text-inverse_surface/30">
            Drop items here
          </div>
        )}
      </div>
    </div>
  )
}
