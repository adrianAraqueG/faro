import { cn } from '@/lib/utils'
import { STATUSES, ancestorsOf, frontOfTask, isCancelled, type Task } from '@/lib/faro'
import { DecisionNote, ReviewBanner, StatusButton, TaskChips } from './TaskParts'
import { Chip } from './bits'

/**
 * Una tarea en lectura, con su camino («Frente › Padre › Hija») para entenderla fuera de su árbol.
 * Se usa en Hoy y en Repositorios; el clic en el icono cambia su estado.
 */
export function TaskLine({ task: t }: { task: Task }) {
  const path = [frontOfTask(t)?.name ?? '—', ...ancestorsOf(t).reverse().map((a) => a.title)].join(' › ')
  const dim = isCancelled(t) || t.status === 'hecha'
  return (
    <article className="animate-rise rounded-md border bg-card px-4 py-3">
      <div className="flex items-start gap-2.5">
        <StatusButton task={t} className="-ml-1 mt-px" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-micro leading-snug text-muted-foreground">{path}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h4 className={cn('font-sans text-base font-semibold leading-snug tracking-normal', dim && 'text-muted-foreground line-through decoration-1')}>{t.title}</h4>
            {t.status !== 'pendiente' && <Chip tone={t.status === 'curso' ? 'beam' : t.status === 'hecha' ? 'ok' : t.status === 'bloqueada' ? 'danger' : 'neutral'}>{STATUSES[t.status]}</Chip>}
            <TaskChips task={t} />
          </div>
          <ReviewBanner task={t} />
          <DecisionNote task={t} />
        </div>
      </div>
    </article>
  )
}
