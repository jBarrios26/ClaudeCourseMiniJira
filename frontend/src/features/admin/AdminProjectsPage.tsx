import { useState } from 'react'
import { Pencil, Trash2, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProjects, useUpdateProject, useDeleteProject } from '@/features/projects/useProjects'
import { useProjectStore } from '@/shared/stores/projectStore'
import { CreateProjectDialog } from '@/features/projects/CreateProjectDialog'
import axios from 'axios'
import type { Project } from '@/shared/types'

function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { mutate: update, isPending } = useUpdateProject()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(null)
    update(
      { id: project.id, name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setError('Project name already exists')
          }
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const { mutate: deleteProject, isPending } = useDeleteProject()
  const { activeProjectId, setActiveProject } = useProjectStore()
  const [editOpen, setEditOpen] = useState(false)

  function handleDelete() {
    if (!confirm(`Delete project "${project.name}"? Tickets will become unassigned.`)) return
    deleteProject(project.id, {
      onSuccess: () => {
        if (activeProjectId === project.id) setActiveProject(null)
      },
    })
  }

  return (
    <tr className="border-b border-outline/10 last:border-0 hover:bg-surface_container transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FolderKanban size={14} className="text-primary shrink-0" />
          <span className="font-medium text-inverse_surface">{project.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-inverse_surface/60 max-w-xs truncate">{project.description ?? '—'}</td>
      <td className="px-4 py-3 text-inverse_surface/50 text-sm">
        {new Date(project.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setEditOpen(true)}
            className="p-1.5 text-inverse_surface/50 hover:text-primary hover:bg-primary_container rounded-md transition-colors"
            title="Edit project"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="p-1.5 text-inverse_surface/50 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
            title="Delete project"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />
    </tr>
  )
}

export function AdminProjectsPage() {
  const { data: projects, isLoading } = useProjects()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-inverse_surface">Projects</h1>
          <p className="text-inverse_surface/50">Manage all projects in the workspace.</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          style={{ background: 'linear-gradient(145deg, #005bbf, #0050a8)' }}
        >
          New project
        </Button>
      </div>

      <div className="bg-surface_container_lowest rounded-lg overflow-hidden shadow-ambient">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface_container_low text-inverse_surface/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-inverse_surface/40 animate-pulse">Loading projects…</td></tr>
            ) : projects?.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
            {!isLoading && projects?.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-inverse_surface/40">No projects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  )
}
