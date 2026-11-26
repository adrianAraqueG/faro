import { useState } from 'react'
import { Plus, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { addDecision, decisionFront, generalFront, isOpenDecision, useFaro, type Impact } from '@/lib/faro'
import { Callout, Empty, Field, PageHeader, Pick, Section } from '@/components/faro/bits'
import { DecisionItem } from '@/components/faro/DecisionItem'
import { ScopeFields, type ScopeValue } from '@/components/faro/ScopeFields'

export function Decisiones() {
  const { db } = useFaro()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState('abiertas')
  const [frontId, setFrontId] = useState('todos')
  const [projectId, setProjectId] = useState('todos')

  const stateRank = { abierta: 0, en_supuesto: 1, resuelta: 2 },
    impactRank = { alto: 0, medio: 1, bajo: 2 }
  const shown = db.decisions
    .filter((d) => (state === 'todas' ? true : state === 'abiertas' ? isOpenDecision(d) : d.state === state))
    .filter((d) => frontId === 'todos' || decisionFront(d)?.id === frontId || (frontId === 'sin' && !decisionFront(d)))
    .filter((d) => projectId === 'todos' || d.projectIds.includes(projectId) || (projectId === 'sin' && d.projectIds.length === 0))
    .sort((a, b) => stateRank[a.state] - stateRank[b.state] || impactRank[a.impact] - impactRank[b.impact])
  const openCount = db.decisions.filter(isOpenDecision).length

  return (
    <>
      <PageHeader
        eyebrow="Conversaciones cortas con el PO"
        title="Dudas y decisiones"
        desc="Una duda sin supuesto está abierta; si avanzas con un supuesto provisional queda «en supuesto» hasta que el PO lo confirme o lo cambie."
        actions={
          <Button variant="beam" onClick={() => setOpen(true)}>
            <Plus /> Registrar duda
          </Button>
        }
      />

      <div className="grid gap-x-16 gap-y-16 min-[1400px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section
          title="Cola de decisiones"
          aside={<span className="tnum font-mono text-[12px] text-muted-foreground">{openCount} abierta(s) · {db.decisions.length} en total</span>}
        >
          <div className="mb-6 flex flex-wrap gap-2.5">
            <Pick
              label="Filtrar por estado"
              value={state}
              onChange={setState}
              className="w-44"
              triggerClassName="h-9 text-sm"
              options={[
                { value: 'abiertas', label: 'Abiertas' },
                { value: 'abierta', label: 'Sin supuesto' },
                { value: 'en_supuesto', label: 'En supuesto' },
                { value: 'resuelta', label: 'Resueltas' },
                { value: 'todas', label: 'Todas' },
              ]}
            />
            <Pick
              label="Filtrar por frente"
              value={frontId}
              onChange={setFrontId}
              className="w-52"
              triggerClassName="h-9 text-sm"
              options={[{ value: 'todos', label: 'Todos los frentes' }, ...db.fronts.map((f) => ({ value: f.id, label: f.name })), { value: 'sin', label: 'Sin frente' }]}
            />
            <Pick
              label="Filtrar por repositorio"
              value={projectId}
              onChange={setProjectId}
              className="w-52"
              triggerClassName="h-9 text-sm"
              options={[{ value: 'todos', label: 'Todos los repositorios' }, ...db.projects.map((p) => ({ value: p.id, label: p.name })), { value: 'sin', label: 'Sin repositorio' }]}
            />
          </div>
          <div className="grid gap-3.5">
            {shown.map((d) => (
              <DecisionItem key={d.id} decision={d} />
            ))}
            {!shown.length && <Empty>{db.decisions.length ? 'Ninguna decisión coincide con estos filtros.' : 'Todavía no hay decisiones registradas.'}</Empty>}
          </div>
        </Section>

        <aside className="grid content-start gap-16">
          <Section title="Regla de riesgo">
            <p className="mb-3 text-sm leading-relaxed">
              Si afecta dinero, contabilidad, integridad de datos, permisos o una operación difícil de revertir, no consolides reglas inventadas sin validación.
            </p>
            <Callout tone="warn" className="flex gap-2.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              Usa supuestos solo cuando el comportamiento sea visible, reversible y comprobable.
            </Callout>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Ordena las preguntas de impacto alto para aprovechar los pocos minutos disponibles del PO.
            </p>
          </Section>
          <Section title="Qué pasa al resolver">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Si la decisión estaba «en supuesto», eliges si el PO <b className="font-semibold text-foreground">confirma</b> el supuesto (solo se cierra) o lo <b className="font-semibold text-foreground">cambia</b>: en ese caso los verificables ligados que ya se construyeron sobre él quedan marcados «requiere revisión» en Frentes.
            </p>
          </Section>
        </aside>
      </div>

      <NuevaDecision open={open} onOpenChange={setOpen} />
    </>
  )
}

function NuevaDecision({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const empty = { question: '', context: '', assumption: '', impact: 'alto' as Impact }
  const [form, setForm] = useState(empty)
  const emptyScope = (): ScopeValue => ({ frontId: generalFront().id, taskId: '', projectIds: [] })
  const [scope, setScope] = useState<ScopeValue>(emptyScope)
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setForm((p) => ({ ...p, [k]: v }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    addDecision({ question: form.question, context: form.context, assumption: form.assumption, impact: form.impact, frontId: scope.frontId, taskId: scope.taskId || null, projectIds: scope.projectIds })
    setForm(empty)
    setScope(emptyScope())
    onOpenChange(false)
    toast.success('Pregunta guardada')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <p className="eyebrow">Nueva</p>
            <DialogTitle>Registrar duda de negocio</DialogTitle>
            <DialogDescription>Una pregunta concreta. Si avanzas con un supuesto provisional, escríbelo: la decisión queda «en supuesto».</DialogDescription>
          </DialogHeader>
          <Field label="Pregunta concreta para el PO" htmlFor="nd-q">
            <Textarea id="nd-q" required value={form.question} onChange={(e) => set('question', e.target.value)} placeholder="¿Puede anularse una factura con pago parcial?" />
          </Field>
          <Field label="Contexto (opcional): qué caso originó la duda, qué opciones ves, qué pasa si no se resuelve" htmlFor="nd-c">
            <Textarea id="nd-c" value={form.context} onChange={(e) => set('context', e.target.value)} />
          </Field>
          <Field label="Supuesto provisional (si es seguro avanzar con él)" htmlFor="nd-a">
            <Textarea id="nd-a" value={form.assumption} onChange={(e) => set('assumption', e.target.value)} placeholder="No permitir anulación hasta definir tratamiento del pago" />
          </Field>
          <ScopeFields value={scope} onChange={setScope} />
          <Field label="Impacto de equivocarse">
            <Pick label="Impacto" value={form.impact} onChange={(v) => set('impact', v as Impact)} options={[
              { value: 'alto', label: 'Alto' },
              { value: 'medio', label: 'Medio' },
              { value: 'bajo', label: 'Bajo' },
            ]} />
          </Field>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="beam">Guardar pregunta</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
