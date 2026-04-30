import { useState } from 'react'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/shared/stores/authStore'
import { useProjectStore } from '@/shared/stores/projectStore'
import { useProjects } from './useProjects'
import { CreateProjectDialog } from './CreateProjectDialog'
import type { Project } from '@/shared/types'

function ProjectCard({ project }: { project: Project }) {
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  return (
    <button
      onClick={() => setActiveProject(project.id)}
      className="bg-surface_container_lowest shadow-ambient rounded-xl p-6 text-left hover:bg-surface_container_high transition-colors w-full"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary_container rounded-lg shrink-0">
          <FolderKanban size={18} className="text-on_primary_fixed" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-inverse_surface truncate">{project.name}</p>
          {project.description && (
            <p className="text-body-md text-inverse_surface/50 mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-surface_container_lowest shadow-ambient rounded-xl p-6 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-surface_container_high rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface_container_high rounded w-2/3" />
          <div className="h-3 bg-surface_container_high rounded w-full" />
        </div>
      </div>
    </div>
  )
}

export function ProjectSelectorPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const { data: projects, isLoading } = useProjects()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display-md font-bold tracking-tight text-inverse_surface">Proyectos</h1>
          <p className="text-body-md text-inverse_surface/50 mt-1">Selecciona un proyecto para ver su tablero</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="gap-2"
            style={{ background: 'linear-gradient(145deg, #005bbf, #0050a8)' }}
          >
            <Plus size={16} />
            Nuevo proyecto
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : projects?.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-inverse_surface/40">
            {isAdmin ? 'Crea tu primer proyecto para empezar.' : 'No hay proyectos disponibles.'}
          </div>
        ) : (
          projects?.map((p) => <ProjectCard key={p.id} project={p} />)
        )}
      </div>

      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  )
}
