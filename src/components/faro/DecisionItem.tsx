import { useState } from 'react'
import { Bot, FolderGit2, Gavel, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DECISION_STATES, decisionTask, decisionFront, decisionProjects, taskPath, type Decision } from '@/lib/faro'
import { Chip } from './bits'
import { AssumptionBlock, DecisionDialog, ResolveDialog, stateTone } from './DecisionDialog'

const impactBar = { alto: 'border-l-danger', medio: 'border-l-beam', bajo: 'border-l-border' }

/**
 * Resumen de una decisión para la lista: pregunta, supuesto, estado y dónde vive.
 * Todo lo demás (contexto, edición, historial, eliminar) está en la ficha que abre al hacer clic.
 */
export function DecisionItem({ decision: d, compact = false }: { decision: Decision; compact?: boolean }) {
  const [detail, setDetail] = useState(false)
  const [resolving, setResolving] = useState(false)
  const front = decisionFront(d),
    task = decisionTask(d),
    projects = decisionProjects(d)

  return (
    <>
      <article
        // El título es el control accesible (teclado); el clic en cualquier otra parte de la tarjeta hace lo mismo.
        onClick={(e) => !(e.target as HTMLElement).closest('button, a') && setDetail(true)}
        className={cn(
          'animate-rise cursor-pointer rounded-md border border-l-[3px] bg-card px-5 py-4 transition-colors hover:bg-accent/30',
          d.state === 'resuelta' ? 'border-l-ok' : impactBar[d.impact],
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 font-mono text-micro font-medium tracking-[0.06em] text-muted-foreground">{d.code}</p>
            <h4 className="font-sans text-base font-semibold leading-snug tracking-normal">
              <button type="button" onClick={() => setDetail(true)} className="text-left hover:underline focus-visible:underline focus-visible:outline-none">
                {d.question}
              </button>
            </h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone={stateTone[d.state]}>{DECISION_STATES[d.state]}</Chip>
            <Chip tone={d.impact === 'alto' ? 'danger' : d.impact === 'medio' ? 'warn' : 'neutral'}>impacto {d.impact}</Chip>
            {d.outcome && <Chip tone={d.outcome === 'cambia' ? 'danger' : 'ok'}>{d.outcome === 'cambia' ? 'cambió el supuesto' : 'confirmó el supuesto'}</Chip>}
          </div>
        </div>

        {d.assumption && (
          <div className="mt-3">
            <AssumptionBlock decision={d} />
          </div>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-micro leading-snug text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {front ? [front.name, ...(task ? taskPath(task) : [])].join(' › ') : 'Sin frente'}
          </span>
          {projects.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <FolderGit2 className="size-3" />
              {projects.map((p, i) => (i === 0 ? p.name : `+ ${p.name}`)).join(' ')}
            </span>
          )}
          {d.origin && (
            <span className="inline-flex items-center gap-1" title="Registrada por un agente">
              <Bot className="size-3" />
              {d.origin}
            </span>
          )}
        </p>

        {d.resolution && (
          <p className="mt-2 flex gap-2 text-sm leading-snug">
            <span className="eyebrow w-[72px] shrink-0 pt-px text-ok">Decisión</span>
            <span>{d.resolution}</span>
          </p>
        )}

        {!compact && d.state !== 'resuelta' && (
          <div className="mt-4">
            <Button size="xs" variant="beam" onClick={() => setResolving(true)}>
              <Gavel /> Registrar decisión del PO
            </Button>
          </div>
        )}
      </article>

      {/* Fuera de la tarjeta: los clics dentro de un diálogo no deben contar como clics en ella. */}
      <DecisionDialog decision={d} open={detail} onOpenChange={setDetail} />
      <ResolveDialog decision={d} open={resolving} onOpenChange={setResolving} />
    </>
  )
}
