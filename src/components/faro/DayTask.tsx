import { useState } from 'react'
import { CornerDownRight, GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { STATUSES, ancestorsOf, frontOfTask, isCancelled, type Task } from '@/lib/faro'
import { StatusButton } from './TaskParts'
import { Chip } from './bits'

/**
 * Siempre dice si la tarea es principal o subtarea. Qué tarea la contiene no se muestra a simple vista
 * (puede ser larguísimo): aparece al pasar el cursor o enfocar la etiqueta.
 */
export function TaskKind({ task: t }: { task: Task }) {
  if (!t.parentId) return <Chip tone="tide">Principal</Chip>
  const chain = ancestorsOf(t).reverse()
  const label = `Subtarea de: ${chain.map((a) => a.title || '(sin título)').join(' › ')}`
  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button type="button" aria-label={label} title={label} className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <Chip>
            <CornerDownRight className="size-3" />
            Subtarea{chain.length > 1 ? ` · nivel ${chain.length + 1}` : ''}
          </Chip>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 p-3">
        <p className="eyebrow mb-2">Pertenece a</p>
        <ol className="grid gap-1.5 text-sm leading-snug">
          {chain.map((a, i) => (
            <li key={a.id} style={{ paddingLeft: i * 12 }} className={cn(i === 0 ? 'font-semibold' : 'text-muted-foreground')}>
              {i > 0 && <CornerDownRight className="mr-1 inline size-3" />}
              {a.title || '(sin título)'}
            </li>
          ))}
        </ol>
      </HoverCardContent>
    </HoverCard>
  )
}

/** Una tarea de Frentes dentro de «Hoy»: estado en un clic, si es principal o subtarea, y su frente. */
export function DayTask({ task: t, onRemove, sort }: { task: Task; onRemove?: () => void; sort?: SortRow }) {
  const dim = isCancelled(t) || t.status === 'hecha'
  return (
    <li
      {...sort?.li}
      className={cn(
        'animate-rise flex items-center gap-2.5 rounded-md border border-l-[3px] bg-card px-3 py-2.5',
        t.parentId ? 'border-l-tide/50' : 'border-l-ink',
        sort?.dragging && 'opacity-40',
        sort?.over && 'border-t-2 border-t-beam',
      )}
    >
      {sort && <GripVertical aria-hidden className="-ml-1 size-4 shrink-0 cursor-grab text-muted-foreground/60" />}
      <StatusButton task={t} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TaskKind task={t} />
          <span className="font-mono text-micro text-muted-foreground">{frontOfTask(t)?.name ?? '—'}</span>
          {t.status !== 'pendiente' && t.status !== 'hecha' && (
            <Chip tone={t.status === 'curso' ? 'beam' : t.status === 'bloqueada' ? 'danger' : 'neutral'}>{STATUSES[t.status]}</Chip>
          )}
        </div>
        <p className={cn('mt-0.5 text-body font-semibold leading-snug', dim && 'text-muted-foreground line-through decoration-1')}>{t.title || '(sin título)'}</p>
      </div>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon" aria-label={`Quitar «${t.title}»`} onClick={onRemove} className="size-8 shrink-0 text-muted-foreground">
          <X className="size-4" />
        </Button>
      )}
    </li>
  )
}

/** Lo que una fila necesita para poder reordenarse: arrastrar. */
export type SortRow = {
  li: React.HTMLAttributes<HTMLLIElement>
  dragging: boolean
  over: boolean
}

/** Lista de tareas del día que se reordena (solo el orden en que se ven; no cambia el orden en Frentes). */
export function DayList({ tasks, onRemove, onMove }: { tasks: Task[]; onRemove: (id: string) => void; onMove: (id: string, to: number) => void }) {
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const end = () => (setDrag(null), setOver(null))
  return (
    <ul className="grid gap-2.5">
      {tasks.map((t, i) => (
        <DayTask
          key={t.id}
          task={t}
          onRemove={() => onRemove(t.id)}
          sort={{
            dragging: drag === t.id,
            over: !!drag && over === t.id && drag !== t.id,
            li: {
              draggable: true,
              onDragStart: (e) => (e.dataTransfer.effectAllowed = 'move', setDrag(t.id)),
              onDragOver: (e) => drag && (e.preventDefault(), setOver(t.id)),
              onDrop: (e) => {
                e.preventDefault()
                if (drag && drag !== t.id) onMove(drag, i)
                end()
              },
              onDragEnd: end,
            },
          }}
        />
      ))}
    </ul>
  )
}
