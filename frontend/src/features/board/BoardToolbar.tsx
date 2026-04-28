import { useState } from 'react'
import { ChevronRight, Plus, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User, TicketFilters } from '@/shared/types'
import { FilterBar } from './FilterBar'

interface BoardToolbarProps {
  members: User[]
  showArchived: boolean
  onToggleArchived: (val: boolean) => void
  isAdmin: boolean
  filters: TicketFilters
  onFilterChange: (f: TicketFilters) => void
  onNewTicketClick?: () => void
}

function AvatarStack({ members }: { members: User[] }) {
  const visible = members.slice(0, 3)
  const overflow = members.length - visible.length

  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <span
          key={m.id}
          title={m.name}
          className={cn(
            'w-8 h-8 rounded-full bg-primary_container text-on_primary_fixed text-xs font-semibold flex items-center justify-center border-2 border-surface select-none',
            i > 0 && '-ml-2',
          )}
        >
          {m.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
      ))}
      {overflow > 0 && (
        <span className="-ml-2 w-8 h-8 rounded-full bg-surface_container_high text-inverse_surface/60 text-xs font-semibold flex items-center justify-center border-2 border-surface">
          +{overflow}
        </span>
      )}
    </div>
  )
}

export function BoardToolbar({ members, showArchived, onToggleArchived, isAdmin, filters, onFilterChange, onNewTicketClick }: BoardToolbarProps) {
  const [showFilters, setShowFilters] = useState(Object.keys(filters).length > 0)
  return (
    <div className="mb-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-label-sm text-inverse_surface/40">Projects</span>
        <ChevronRight size={12} className="text-inverse_surface/30" />
        <span className="text-label-sm text-inverse_surface/40">Board</span>
      </div>

      {/* Title row */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md font-semibold text-inverse_surface">Sprint Board</h1>
          {isAdmin && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={showArchived}
                onClick={() => onToggleArchived(!showArchived)}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
                  showArchived ? 'bg-primary' : 'bg-surface_container_high',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
                    showArchived ? 'translate-x-4' : 'translate-x-0.5',
                  )}
                />
              </button>
              <span className="text-body-md text-inverse_surface/60">Show archived</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-3 pb-1">
          <AvatarStack members={members} />

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-md transition-colors border", showFilters ? "bg-primary_container text-on_primary_container border-primary/20" : "text-inverse_surface border-outline_variant/20 hover:bg-surface_container_high")}
          >
            <SlidersHorizontal size={14} />
            Filter
          </button>

          <button
            type="button"
            onClick={onNewTicketClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-md text-on_primary font-medium transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(145deg, #005bbf, #0050a8)' }}
          >
            <Plus size={14} />
            New Ticket
          </button>
        </div>
      </div>

      {showFilters && (
        <FilterBar filters={filters} onChange={onFilterChange} members={members} />
      )}
    </div>
  )
}
