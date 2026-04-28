import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ticketSchema, type TicketFormValues } from './ticketSchema'
import MDEditor from '@uiw/react-md-editor'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { User } from '@/shared/types'

interface TicketFormProps {
  defaultValues?: Partial<TicketFormValues>
  members: User[]
  onSubmit: (data: TicketFormValues) => void
  isSubmitting?: boolean
}

export function TicketForm({ defaultValues, members, onSubmit, isSubmitting }: TicketFormProps) {
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: defaultValues?.title || '',
      description: defaultValues?.description || '',
      status: defaultValues?.status || 'to_do',
      priority: defaultValues?.priority || 'medium',
      assigneeId: defaultValues?.assigneeId || null,
      labelIds: defaultValues?.labelIds || [],
    },
  })

  // We can track exact counts for UI purposes
  const titleValue = form.watch('title') || ''

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="Ticket title..."
          disabled={isSubmitting}
          {...form.register('title')}
        />
        <div className="flex justify-between mt-1">
          {form.formState.errors.title ? (
            <p className="text-xs text-error">{form.formState.errors.title.message}</p>
          ) : <span />}
          <p className={`text-xs ${titleValue.length > 120 ? 'text-error' : 'text-inverse_surface/50'}`}>
            {titleValue.length}/120
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger>
                   <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to_do">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger>
                   <SelectValue placeholder="Select Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Assignee</Label>
        <Controller
          control={form.control}
          name="assigneeId"
          render={({ field }) => (
            <Select 
              value={(field.value as string) || 'unassigned'} 
              onValueChange={(v) => field.onChange(v === 'unassigned' ? null : v)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                 <span className="truncate">
                    {field.value 
                      ? members.find(m => m.id === field.value)?.name || 'Unassigned'
                      : 'Unassigned'}
                 </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <div data-color-mode="light">
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <MDEditor
                value={field.value}
                onChange={(val) => field.onChange(val || '')}
                preview="edit"
                height={200}
                textareaProps={{ disabled: isSubmitting }}
              />
            )}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
          {isSubmitting ? 'Saving...' : 'Save Ticket'}
        </Button>
      </div>
    </form>
  )
}
