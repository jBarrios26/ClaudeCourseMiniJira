import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateProject } from './useProjects'
import { useProjectStore } from '@/shared/stores/projectStore'
import axios from 'axios'

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const { mutate: create, isPending } = useCreateProject()
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(null)
    create(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: (project) => {
          setActiveProject(project.id)
          onOpenChange(false)
          setName('')
          setDescription('')
        },
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
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My project"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-desc">Description <span className="text-inverse_surface/40">(optional)</span></Label>
            <Textarea
              id="project-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              disabled={isPending}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
