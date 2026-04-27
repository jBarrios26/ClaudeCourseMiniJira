import { useState } from 'react'
import { useAuthStore } from '@/shared/stores/authStore'
import { BoardToolbar } from './BoardToolbar'
import { KanbanBoard } from './KanbanBoard'
import { useBoardTickets, MOCK_MEMBERS } from './useBoardTickets'

function BoardSkeleton() {
  return (
    <div className="flex gap-6">
      {Array.from({ length: 4 }).map((_, col) => (
        <div key={col} className="w-72 shrink-0">
          <div className="h-5 w-20 rounded bg-surface_container_high animate-pulse mb-3" />
          <div className="rounded-xl p-3 bg-surface_container_low flex flex-col gap-3 min-h-32">
            {Array.from({ length: col === 0 ? 3 : col === 1 ? 2 : 1 }).map((_, i) => (
              <div key={i} className="rounded-lg h-24 bg-surface_container_high animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function BoardPage() {
  const [showArchived, setShowArchived] = useState(false)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const { data: tickets, isLoading, isError } = useBoardTickets()

  const visibleTickets = (tickets ?? []).filter((t) =>
    showArchived ? true : t.archivedAt === null,
  )

  return (
    <div>
      <BoardToolbar
        members={MOCK_MEMBERS}
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        isAdmin={isAdmin}
      />

      {isLoading && <BoardSkeleton />}

      {isError && (
        <p className="text-body-md text-inverse_surface/50">
          Failed to load tickets. Please refresh the page.
        </p>
      )}

      {!isLoading && !isError && (
        <KanbanBoard tickets={visibleTickets} />
      )}
    </div>
  )
}
