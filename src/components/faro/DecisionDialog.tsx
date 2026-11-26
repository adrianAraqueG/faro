import { useState, type ReactNode } from 'react'
import { Bot, ChevronRight, FolderGit2, Gavel, Lightbulb, MapPin, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPageContent, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useDialogs } from '@/lib/dialogs'
import {
  DECISION_STATES, OUTCOMES, decisionTask, decisionFront, decisionProjects, removeDecision, reopenDecision, resolveDecision,
  setAssumption, setContext, setDecisionScope, setImpact, setQuestion, taskPath, useFaro, type Decision, type Impact, type Outcome,
} from '@/lib/faro'
import { Chip, Field, Pick } from './bits'
import { ScopeFields, type ScopeValue } from './ScopeFields'

export const stateTone = { abierta: 'warn', en_supuesto: 'beam', resuelta: 'ok' } as const

/** El supuesto, destacado: en vigor mientras se avanza con él; apagado cuando el PO ya resolvió. */
export function AssumptionBlock({ decision: d }: { decision: Decision }) {
  if (!d.assumption) return null
  return (
    <div
      className={cn(
        'rounded-r-[3px] border-l-[3px] px-3.5 py-2.5',
        d.state === 'resuelta' ? 'border-border bg-secondary/60 text-muted-foreground' : 'border-beam bg-beam-soft text-beam-ink',
      )}
    >
      <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold">
        <Lightbulb className="size-3.5" />
        {d.state !== 'resuelta'
          ? 'Supuesto · avanzamos con esto'
          : d.outcome === 'cambia'
            ? 'Supuesto descartado por el PO'
            : d.outcome === 'confirma'
              ? 'Supuesto confirmado por el PO'
              : 'Supuesto'}
      </p>
      <p className={cn('whitespace-pre-wrap text-[15px] font-medium leading-snug', d.outcome === 'cambia' && 'line-through decoration-1')}>{d.assumption}</p>
    </div>
  )
}

/** Etiqueta de un bloque de la ficha: frase normal, sin mayúsculas. */
const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h3 className={cn('text-[13px] font-semibold text-muted-foreground', className)}>{children}</h3>
)

/** Un dato de texto que se lee y se edita en el mismo sitio (Editar → caja → Guardar). */
function EditableText({
  label, value, placeholder, required = false, locked = false, onSave, render, textClass, asTitle = false,
}: {
  label: string
  value: string
  placeholder: string
  required?: boolean
  locked?: boolean
  onSave: (v: string) => void
  render?: ReactNode
  textClass?: string
  /** El texto es el título accesible del diálogo (la pregunta). */
  asTitle?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const start = () => (setDraft(value), setEditing(true))
  const save = () => {
    if (required && !draft.trim()) return
    onSave(draft)
    setEditing(false)
  }
  const editBtn = !locked && !editing && (
    <Button type="button" size="xs" variant="ghost" onClick={start} aria-label={`Editar ${label.toLowerCase()}`} className="shrink-0">
      <Pencil /> Editar
    </Button>
  )
  return (
    <section className="grid gap-1.5">
      {!asTitle && (
        <div className="flex items-center justify-between gap-2">
          <Label>{label}</Label>
          {editBtn}
        </div>
      )}
      {editing ? (
        <div className="grid gap-2">
          {asTitle && <DialogTitle className="sr-only">{value}</DialogTitle>}
          <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={label} className="min-h-24" />
          <div className="flex gap-2">
            <Button type="button" size="xs" variant="beam" disabled={required && !draft.trim()} onClick={save}>Guardar</Button>
            <Button type="button" size="xs" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : asTitle ? (
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="text-[26px] font-semibold leading-[1.15]">{value}</DialogTitle>
          {editBtn}
        </div>
      ) : value ? (
        (render ?? <p className={cn('max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed', textClass)}>{value}</p>)
      ) : (
        <p className="max-w-[65ch] text-sm italic text-muted-foreground">{placeholder}</p>
      )}
    </section>
  )
}

/**
 * Ficha completa de una decisión: aquí se lee todo y se edita todo; la tarjeta de la lista solo resume.
 * La ficha crece con su contenido y es la página la que se desplaza, no el interior del diálogo.
 */
export function DecisionDialog({ decision: d, open, onOpenChange }: { decision: Decision; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db } = useFaro()
  const { confirm } = useDialogs()
  const [resolving, setResolving] = useState(false)
  const [scoping, setScoping] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const linked = db.tasks.filter((t) => t.decisionId === d.id)
  const front = decisionFront(d),
    task = decisionTask(d),
    projects = decisionProjects(d)

  async function remove() {
    if (!(await confirm('¿Eliminar esta pregunta?', d.question, true))) return
    onOpenChange(false)
    removeDecision(d.id)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPageContent className="max-w-4xl">
          <DialogDescription className="sr-only">Ver y editar todos los datos de la decisión.</DialogDescription>
          <div className="grid gap-x-9 gap-y-8 p-6 sm:p-9 md:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="grid min-w-0 content-start gap-7">
              <header className="grid gap-2.5 pr-8">
                <p className="font-mono text-[12px] text-muted-foreground">{d.code} · registrada el {d.created}</p>
                <EditableText label="Pregunta" value={d.question} placeholder="La duda para el PO" required asTitle onSave={(v) => setQuestion(d.id, v)} />
              </header>

              <EditableText
                label="Contexto"
                value={d.context ?? ''}
                placeholder="Sin contexto. Cuenta qué caso originó la duda, qué opciones ves y qué pasa si no se resuelve."
                onSave={(v) => setContext(d.id, v)}
              />
              {(d.assumption || d.state !== 'resuelta') && (
                <EditableText
                  label="Supuesto"
                  value={d.assumption}
                  placeholder="Sin supuesto: la decisión bloquea el trabajo ligado hasta que el PO responda."
                  locked={d.state === 'resuelta'}
                  onSave={(v) => setAssumption(d.id, v)}
                  render={<AssumptionBlock decision={d} />}
                />
              )}
              {d.resolution && (
                <section className="rounded-r-[3px] border-l-[3px] border-ok bg-ok-soft/50 px-3.5 py-3">
                  <h3 className="mb-1 text-[13px] font-semibold text-ok">Decisión del PO</h3>
                  <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed">{d.resolution}</p>
                </section>
              )}
            </div>

            <aside className="grid content-start gap-6 self-start rounded-[3px] bg-secondary/50 p-4">
              <div className="grid gap-2">
                <Label>Estado</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone={stateTone[d.state]}>{DECISION_STATES[d.state]}</Chip>
                  {d.outcome && <Chip tone={d.outcome === 'cambia' ? 'danger' : 'ok'}>{d.outcome === 'cambia' ? 'cambió el supuesto' : 'confirmó el supuesto'}</Chip>}
                  {d.origin && (
                    <Chip>
                      <Bot className="size-3" /> {d.origin}
                    </Chip>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Impacto de equivocarse</Label>
                <Pick
                  label="Impacto"
                  value={d.impact}
                  onChange={(v) => setImpact(d.id, v as Impact)}
                  options={[{ value: 'alto', label: 'Alto' }, { value: 'medio', label: 'Medio' }, { value: 'bajo', label: 'Bajo' }]}
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Dominio</Label>
                  <Button type="button" size="xs" variant="ghost" onClick={() => setScoping(true)}>
                    <MapPin /> Cambiar
                  </Button>
                </div>
                <p className="font-mono text-[12.5px] leading-snug">{front ? [front.name, ...(task ? taskPath(task) : [])].join(' › ') : 'Sin frente'}</p>
                {projects.length > 0 && (
                  <p className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-muted-foreground">
                    <FolderGit2 className="size-3.5 shrink-0" />
                    {projects.map((p, i) => (i === 0 ? p.name : `+ ${p.name}`)).join(' ')}
                  </p>
                )}
              </div>

              {linked.length > 0 && (
                <div className="grid gap-1.5">
                  <Label>Afecta a</Label>
                  <ul className="grid gap-1 text-sm leading-snug">
                    {linked.map((t) => (
                      <li key={t.id}>{t.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Collapsible open={logOpen} onOpenChange={setLogOpen}>
                <CollapsibleTrigger className="group -ml-1 flex items-center gap-1 rounded-[3px] px-1 py-0.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                  <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
                  Historial
                  <span className="tnum ml-1 font-mono font-normal">{d.log.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ol className="mt-2.5 grid gap-2 border-l border-border pl-3">
                    {[...d.log].reverse().map((e, i) => (
                      <li key={i} className="grid gap-0.5 text-[13px] leading-snug">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <Chip tone={stateTone[e.state]}>{DECISION_STATES[e.state]}</Chip>
                          <time className="tnum font-mono text-[11.5px] text-muted-foreground">{new Date(e.at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</time>
                        </span>
                        {e.note && <span className="text-muted-foreground">{e.note}</span>}
                      </li>
                    ))}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            </aside>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 md:col-span-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} className="text-danger hover:bg-danger-soft hover:text-danger">
                <Trash2 /> Eliminar
              </Button>
              {d.state === 'resuelta' ? (
                <Button type="button" size="sm" variant="outline" onClick={() => reopenDecision(d.id)}>
                  <RotateCcw /> Reabrir
                </Button>
              ) : (
                <Button type="button" size="sm" variant="beam" onClick={() => setResolving(true)}>
                  <Gavel /> Registrar decisión del PO
                </Button>
              )}
            </footer>
          </div>
        </DialogPageContent>
      </Dialog>
      <ResolveDialog decision={d} open={resolving} onOpenChange={setResolving} />
      <ScopeDialog decision={d} open={scoping} onOpenChange={setScoping} />
    </>
  )
}

export function ResolveDialog({ decision: d, open, onOpenChange }: { decision: Decision; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<Outcome | ''>('')
  const assumed = d.state === 'en_supuesto'
  const final = text.trim() || (outcome === 'confirma' ? d.assumption : '')
  const can = !!final && (!assumed || !!outcome)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!can) return
    const { unblocked, flagged } = resolveDecision(d.id, final, assumed ? (outcome as Outcome) : null)
    if (flagged) toast.warning(`${flagged} verificable(s) marcados para revisión`, { description: 'El PO cambió el supuesto sobre el que se construyeron.' })
    else if (unblocked) toast(`${unblocked} verificable(s) vinculado(s) pueden desbloquearse`)
    onOpenChange(false)
    setText('')
    setOutcome('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <p className="eyebrow">{d.code}</p>
            <DialogTitle>Registrar decisión del PO</DialogTitle>
            <DialogDescription>{d.question}</DialogDescription>
          </DialogHeader>
          {assumed && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Tu supuesto era: «{d.assumption}»</legend>
              <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as Outcome)} className="gap-2.5">
                {(Object.keys(OUTCOMES) as Outcome[]).map((k) => (
                  <label key={k} className={cn('flex cursor-pointer items-start gap-3 rounded-[3px] border px-3.5 py-3 transition-colors', outcome === k ? 'border-ring bg-beam-soft/60' : 'bg-card hover:bg-accent/50')}>
                    <RadioGroupItem value={k} className="mt-0.5" />
                    <span className="text-sm leading-snug">
                      <b className="font-semibold">{OUTCOMES[k]}</b>
                      <span className="mt-0.5 block text-muted-foreground">
                        {k === 'confirma' ? 'Era correcto: la decisión solo se cierra.' : 'El PO decidió otra cosa: los verificables ya construidos sobre el supuesto quedarán marcados «requiere revisión».'}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          )}
          <Field label="¿Qué decidió el PO? Escribe la regla acordada" htmlFor="res-text">
            <Textarea
              id="res-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={outcome === 'confirma' ? `Si lo dejas vacío se usa el supuesto: ${d.assumption}` : 'La regla que quedó acordada'}
            />
          </Field>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="beam" disabled={!can}>Guardar decisión</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ScopeDialog({ decision: d, open, onOpenChange }: { decision: Decision; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [value, setValue] = useState<ScopeValue>({ frontId: d.frontId, taskId: d.taskId ?? '', projectIds: d.projectIds })
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setValue({ frontId: d.frontId, taskId: d.taskId ?? '', projectIds: d.projectIds })
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setDecisionScope(d.id, value.frontId, value.taskId || null, value.projectIds)
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <p className="eyebrow">{d.code}</p>
            <DialogTitle>Dominio de la decisión</DialogTitle>
            <DialogDescription>A qué frente (y tarea) pertenece y en qué repositorios impacta.</DialogDescription>
          </DialogHeader>
          <ScopeFields value={value} onChange={setValue} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="beam">Guardar dominio</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
