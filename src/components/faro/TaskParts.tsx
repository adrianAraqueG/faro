import { CircleCheck, FolderGit2, Hourglass, Lightbulb, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  STATUSES, VERIFICATIONS, cycleStatus, decisionOf, effectiveProjectId, isCancelled, markReviewed, projectOf, type Task,
} from '@/lib/faro'
import { Chip, StatusIcon } from './bits'

/** Un clic cambia el estado: pendiente → en curso → hecha → pendiente. */
export function StatusButton({ task: t, className }: { task: Task; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => cycleStatus(t.id)}
      aria-label={`${STATUSES[t.status]}. Clic para cambiar el estado`}
      title={`${STATUSES[t.status]} · clic para cambiar`}
      className={cn('grid size-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-accent', className)}
    >
      <StatusIcon status={isCancelled(t) && t.status !== 'cancelada' ? 'cancelada' : t.status} />
    </button>
  )
}

/** Qué dice la decisión ligada a la tarea (si la hay). */
export function DecisionNote({ task: t }: { task: Task }) {
  const dec = decisionOf(t)
  if (!dec) return null
  if (dec.state === 'abierta')
    return (
      <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-warn">
        <Hourglass className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <b className="font-semibold">Espera al PO ({dec.code}):</b> {dec.question}
        </span>
      </p>
    )
  if (dec.state === 'en_supuesto')
    return (
      <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-beam-ink">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <b className="font-semibold">Avanza con supuesto ({dec.code}):</b> {dec.assumption}
        </span>
      </p>
    )
  if (t.needsReview) return null // el aviso de revisión ya cuenta lo que decidió el PO
  return (
    <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-ok">
      <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Decisión del PO ({dec.code}): {dec.resolution || 'resuelta'}
        {t.status === 'bloqueada' && <b className="font-semibold"> · ya puedes desbloquearla</b>}
      </span>
    </p>
  )
}

/** El PO cambió el supuesto sobre el que se construyó la tarea. */
export function ReviewBanner({ task: t }: { task: Task }) {
  const dec = decisionOf(t)
  if (!t.needsReview) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-danger-soft px-3 py-2 text-sm leading-snug text-danger">
      <ScanSearch className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {dec ? (
          <>
            <b className="font-semibold">{dec.code}</b> cambió el supuesto: {dec.resolution || 'revisa la decisión'}. Revisa lo construido.
          </>
        ) : (
          'Cambió un supuesto del que depende. Revisa lo construido.'
        )}
      </span>
      <Button size="xs" variant="danger" onClick={() => markReviewed(t.id)}>
        Marcar revisado
      </Button>
    </div>
  )
}

/** Etiquetas de una tarea: verificable, verificación, repositorio (propio o heredado) y revisión pendiente. */
export function TaskChips({ task: t }: { task: Task }) {
  const eff = effectiveProjectId(t)
  const repo = projectOf(eff)
  const dec = decisionOf(t)
  const any = t.verify || repo || t.needsReview || dec
  if (!any) return null
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {t.verify && <Chip tone={t.verify.verification === 'ninguna' ? 'neutral' : t.verify.verification === 'aceptado' ? 'ok' : 'tide'}>{t.verify.verification === 'ninguna' ? 'verificable' : VERIFICATIONS[t.verify.verification]}</Chip>}
      {t.needsReview && <Chip tone="danger">requiere revisión</Chip>}
      {dec && <Chip tone={dec.state === 'resuelta' ? 'ok' : dec.state === 'abierta' ? 'warn' : 'beam'}>{dec.code}</Chip>}
      {repo && (
        <span className={cn('inline-flex items-center gap-1 font-mono text-micro text-muted-foreground', !t.projectId && 'italic')} title={t.projectId ? 'Repositorio de esta tarea' : 'Repositorio heredado de una tarea superior'}>
          <FolderGit2 className="size-3" />
          {repo.name}
        </span>
      )}
    </span>
  )
}
