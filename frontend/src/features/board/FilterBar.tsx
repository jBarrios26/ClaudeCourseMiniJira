import { Search, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { TicketFilters, User } from '@/shared/types'
import { useState } from 'react'

interface FilterBarProps {
  filters: TicketFilters
  onChange: (filters: TicketFilters) => void
  members: User[]
}

export function FilterBar({ filters, onChange, members }: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search || '')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onChange({ ...filters, search: localSearch })
  }

  const clearFilters = () => {
    setLocalSearch('')
    onChange({
      search: undefined,
      status: undefined,
      priority: undefined,
      assigneeId: 'all',
    } as any)
  }

  const hasFilters = filters.search || filters.status || filters.priority || (filters.assigneeId && filters.assigneeId !== 'all') || filters.from || filters.to

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-surface_container_low border border-outline_variant/20 rounded-lg mb-4">
      {/* Search text */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-inverse_surface/50" />
        <Input
          type="text"
          placeholder="Search by title or description..."
          className="pl-9 h-9"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onBlur={() => onChange({ ...filters, search: localSearch })}
        />
      </form>

      {/* Select Assignee */}
      <div className="w-[150px]">
        <Select
          value={(filters.assigneeId || 'all') as string}
          onValueChange={(val) => onChange({ ...filters, assigneeId: val === 'all' ? undefined : (val as string) })}
        >
          <SelectTrigger className="h-9">
            <span data-slot="select-value" className="truncate">
              {filters.assigneeId
                ? members.find((m) => m.id === filters.assigneeId)?.name || 'All Assignees'
                : 'All Assignees'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Select Status */}
      <div className="w-[140px]">
        <Select
          value={filters.status || 'all'}
          onValueChange={(val) => onChange({ ...filters, status: val === 'all' ? undefined : val as any })}
        >
          <SelectTrigger className="h-9">
            <span data-slot="select-value" className="truncate">
              {filters.status === 'to_do' ? 'To Do'
                : filters.status === 'in_progress' ? 'In Progress'
                  : filters.status === 'in_review' ? 'In Review'
                    : filters.status === 'done' ? 'Done'
                      : 'All Statuses'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="to_do">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Select Priority */}
      <div className="w-[140px]">
        <Select
          value={filters.priority || 'all'}
          onValueChange={(val) => onChange({ ...filters, priority: val === 'all' ? undefined : val as any })}
        >
          <SelectTrigger className="h-9">
            <span data-slot="select-value" className="truncate capitalize">
              {filters.priority
                ? filters.priority
                : 'All Priorities'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Popover */}
      <Popover>
        <PopoverTrigger className="inline-flex h-9 items-center justify-center rounded-md border border-outline_variant/20 px-3 text-sm font-medium hover:bg-surface_container_high transition-colors">
          {(filters.from || filters.to) ? 'Dates Active' : 'Date Range'}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4 flex flex-col gap-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium">From</label>
            <Input
              type="date"
              value={filters.from || ''}
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">To</label>
            <Input
              type="date"
              value={filters.to || ''}
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
            />
          </div>
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button
          variant="ghost"
          size="icon"
          onClick={clearFilters}
          className="h-9 w-9 text-inverse_surface/50 hover:text-inverse_surface"
          title="Clear all filters"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
