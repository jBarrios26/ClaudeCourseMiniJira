import { useState } from 'react'
import { useAuthStore } from '@/shared/stores/authStore'
import { useProjectStore } from '@/shared/stores/projectStore'
import { BoardToolbar } from './BoardToolbar'
import { KanbanBoard } from './KanbanBoard'
import { useBoardTickets, MOCK_MEMBERS } from './useBoardTickets'
import { TicketModal } from '@/features/tickets/TicketModal'
import { ProjectSelectorPage } from '@/features/projects/ProjectSelectorPage'
import { useProjects } from '@/features/projects/useProjects'
import type { TicketFilters } from '@/shared/types'

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
  const [filters, setFilters] = useState<TicketFilters>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const { activeProjectId, setActiveProject } = useProjectStore()
  const { data: projects } = useProjects()
  const activeProject = projects?.find((p) => p.id === activeProjectId)

  const { data: tickets, isLoading, isError } = useBoardTickets(
    activeProjectId !== null ? { ...filters, projectId: activeProjectId } : filters,
  )

  if (activeProjectId === null) return <ProjectSelectorPage />

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
        filters={filters}
        onFilterChange={setFilters}
        onNewTicketClick={() => setIsModalOpen(true)}
        projectName={activeProject?.name ?? '…'}
        onSwitchProject={() => setActiveProject(null)}
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

      {isModalOpen && (
        <TicketModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          members={MOCK_MEMBERS}
        />
      )}
    </div>
  )
}
