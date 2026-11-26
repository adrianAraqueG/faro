import { useMemo, useState } from 'react'
import { ChevronRight, ClipboardPaste, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDialogs } from '@/lib/dialogs'
import { usePersistedSet } from '@/lib/persisted'
import {
  GENERAL_SLUG, addFront, childrenOf, frontRemovalImpact, generalFront, importOutline, normText, progress, removeFront, renameFront,
  slugify, suggestFront, useFaro, type Front,
} from '@/lib/faro'
import { parseOutline, outlineStats, type OutlineGroup } from '@/lib/outline'
import { Chip, Empty, Field, PageHeader, Pick } from '@/components/faro/bits'
import { Outline } from '@/components/faro/Outline'

export function Frentes({ day }: { day: string }) {
  const { db } = useFaro()
  const [frontOpen, setFrontOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [closed, setClosedId] = usePersistedSet('faro.frentes.cerrados') // frentes plegados (todos abiertos por defecto)
  const [hideDone, setHideDone] = useState(false)

  const toggle = (id: string, open: boolean) => setClosedId(id, !open)

  return (
    <>
      <PageHeader
        eyebrow="Frente → tareas y subtareas"
        title="Frentes"
        desc="Escribe como en un bloc de notas: cada frente es un esquema de tareas con la profundidad que necesites. «General» es para tareas sueltas."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <ClipboardPaste /> Importar texto
            </Button>
            <Button variant="beam" onClick={() => setFrontOpen(true)}>
              <Plus /> Añadir frente
            </Button>
          </>
        }
      />

      <div className="mb-8 flex items-center justify-between gap-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
          <Checkbox checked={hideDone} onCheckedChange={(on) => setHideDone(on === true)} />
          Ocultar lo terminado
        </label>
        <p className="tnum font-mono text-caption text-muted-foreground">
          {db.fronts.length} frentes · {db.tasks.filter((t) => t.kind !== 'texto').length} tareas
        </p>
      </div>

      <div className="grid gap-12">
        {db.fronts.map((front) => (
          <FrontSection key={front.id} front={front} open={!closed.has(front.id)} onOpenChange={(o) => toggle(front.id, o)} hideDone={hideDone} day={day} />
        ))}
        {!db.fronts.length && <Empty>Todavía no hay frentes. Pulsa «Añadir frente» para crear el primero.</Empty>}
      </div>

      <FrontDialog open={frontOpen} onOpenChange={setFrontOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}

/* ---------- Frente ---------- */
function FrontSection({ front, open, onOpenChange, hideDone, day }: { front: Front; open: boolean; onOpenChange: (o: boolean) => void; hideDone: boolean; day: string }) {
  const { db } = useFaro()
  const { askText, confirm } = useDialogs()
  const total = db.tasks.filter((t) => t.frontId === front.id && t.kind !== 'texto').length
  const roots = childrenOf(null, front.id)
  const sums = roots.reduce((acc, r) => {
    if (r.status === 'cancelada') return acc
    const p = progress(r)
    return { done: acc.done + p.done, total: acc.total + p.total }
  }, { done: 0, total: 0 })
  const review = db.tasks.filter((t) => t.frontId === front.id && t.needsReview).length
  const isGeneral = front.slug === GENERAL_SLUG

  async function rename() {
    const v = await askText('Renombrar frente', front.name)
    if (v && v.trim()) renameFront(front.id, v.trim())
  }
  async function remove() {
    const { tasks: nt, decisions: nd } = frontRemovalImpact(front.id)
    const lines = [nt && `Se eliminarán sus ${nt} tarea(s) y subtarea(s).`, nd && `Sus ${nd} decisión(es) pasarán a «General».`].filter(Boolean)
    if (await confirm(`¿Eliminar el frente «${front.name}»?`, lines.join(' '), true)) {
      const err = removeFront(front.id)
      if (err) toast.error(err)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="border-t-2 border-ink pt-4">
      <div className="flex items-start gap-2">
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-start gap-3 rounded-md py-1 text-left">
          <ChevronRight className="mt-2 size-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-2xl font-semibold leading-tight">{front.name}</span>
              <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-micro text-muted-foreground" title="Nombre de la carpeta docs/ en los repositorios">
                {front.slug}
              </code>
            </span>
            <span className="tnum mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-caption text-muted-foreground">
              <span>{total} tarea(s)</span>
              {sums.total > 0 && (
                <span>
                  {sums.done}/{sums.total} hechas
                </span>
              )}
              {review > 0 && <Chip tone="danger">{review} requieren revisión</Chip>}
            </span>
          </span>
        </CollapsibleTrigger>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-9 shrink-0" aria-label={`Opciones del frente ${front.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void rename()}>
              <Pencil className="mr-2 size-4" /> Renombrar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isGeneral} className="text-danger focus:text-danger" onSelect={() => void remove()}>
              <Trash2 className="mr-2 size-4" /> {isGeneral ? 'General no se elimina' : 'Eliminar frente'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <div className="pt-4 md:pl-8">
          <Outline front={front} hideDone={hideDone} day={day} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/* ---------- Añadir frente ---------- */
function FrontDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">{open && <FrontForm onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}
function FrontForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        addFront(name.trim())
        toast.success(`Frente «${name.trim()}» creado`, { description: `Carpeta en los repositorios: docs/${slugify(name)}/` })
        onClose()
      }}
    >
      <DialogHeader>
        <p className="eyebrow">Nuevo</p>
        <DialogTitle>Nuevo frente</DialogTitle>
        <DialogDescription>Una gran área de trabajo, como Contabilidad o ERP en Efactura. Las tareas se escriben dentro, directamente.</DialogDescription>
      </DialogHeader>
      <Field label="Nombre del frente" htmlFor="nf-name">
        <Input id="nf-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contabilidad" />
      </Field>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="beam" disabled={!name.trim()}>
          <Plus /> Crear frente
        </Button>
      </DialogFooter>
    </form>
  )
}

/* ---------- Importar un esquema de texto ---------- */
function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">{open && <ImportForm onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const { db } = useFaro()
  const [text, setText] = useState('')
  const [questions, setQuestions] = useState(false)
  const [frontId, setFrontId] = useState(generalFront()?.id ?? '')
  const [choice, setChoice] = useState<Record<number, string>>({})
  const groups = useMemo(() => parseOutline(text), [text])
  const stats = outlineStats(groups)
  const hasLoose = groups.some((g) => !g.front)
  const exists = (name: string) => db.fronts.some((f) => normText(f.name) === normText(name) || f.slug === slugify(name))
  // A qué frente existente se asigna cada frente del texto: lo que elija el usuario, o la sugerencia, o «crear uno nuevo» ('').
  const targetOf = (g: OutlineGroup, i: number) => (g.front && !exists(g.front) ? (choice[i] ?? suggestFront(g.front)?.id ?? '') : '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stats.tasks && !stats.fronts) return
    const sum = importOutline(groups, frontId, questions, groups.map(targetOf))
    toast.success(`Importado: ${sum.created} tarea(s)`, {
      description: [sum.fronts && `${sum.fronts} frente(s) nuevo(s)`, sum.reused && `${sum.reused} ya existía(n)`, sum.decisions && `${sum.decisions} duda(s) para el PO`].filter(Boolean).join(' · ') || undefined,
    })
    onClose()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <p className="eyebrow">Importar</p>
        <DialogTitle>Importar desde texto</DialogTitle>
        <DialogDescription>
          Pega tu bloc de notas. Una línea que termina en «:» abre un frente (<code className="font-mono text-caption">FRENTE ERP:</code>); cada <code className="font-mono text-caption">-&gt;</code> es una tarea y los tabuladores bajan de nivel. «CANCELADO:» al inicio la deja cancelada.
        </DialogDescription>
      </DialogHeader>

      <Field label="Texto" htmlFor="imp-text">
        <Textarea
          id="imp-text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'FRENTE GENERAL:\n-> Publicar documentación\n\t-> Revisar la sección de usuarios'}
          className="min-h-[170px] font-mono text-small leading-snug"
          spellCheck={false}
        />
      </Field>

      {(stats.tasks > 0 || stats.fronts > 0) && (
        <div className="grid gap-3">
          <p className="tnum font-mono text-caption text-muted-foreground">
            {stats.fronts} frente(s) · {stats.tasks} tarea(s)
            {stats.cancelled > 0 && ` · ${stats.cancelled} cancelada(s)`}
            {stats.questions > 0 && ` · ${stats.questions} duda(s) detectada(s)`}
          </p>
          <PreviewTree groups={groups} exists={exists} targetOf={targetOf} onChoose={(i, id) => setChoice((c) => ({ ...c, [i]: id }))} />
          {stats.questions > 0 && (
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
              <Checkbox className="mt-0.5" checked={questions} onCheckedChange={(on) => setQuestions(on === true)} />
              <span>
                Convertir las {stats.questions} líneas con «¿» o «?» en <b className="font-semibold">dudas para el PO</b> (quedan ligadas a su tarea). Puedes hacerlo después tarea por tarea.
              </span>
            </label>
          )}
          {hasLoose && (
            <Field label="Las tareas anteriores al primer frente van a">
              <Pick label="Frente por defecto" value={frontId} onChange={setFrontId} options={db.fronts.map((f) => ({ value: f.id, label: f.name }))} className="max-w-xs" />
            </Field>
          )}
          <p className="text-small leading-snug text-muted-foreground">Si una tarea ya existe en el mismo lugar, se reutiliza: puedes importar de nuevo sin duplicar.</p>
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="beam" disabled={!stats.tasks && !stats.fronts}>
          Importar {stats.tasks ? `${stats.tasks} tarea(s)` : ''}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Vista previa del árbol que se creará (solo lectura). */
function PreviewTree({
  groups, exists, targetOf, onChoose,
}: { groups: OutlineGroup[]; exists: (name: string) => boolean; targetOf: (g: OutlineGroup, i: number) => string; onChoose: (i: number, frontId: string) => void }) {
  const { db } = useFaro()
  return (
    <div className="max-h-64 overflow-auto rounded-md border bg-secondary/40 p-3 text-small leading-snug">
      {groups.map((g, gi) => (
        <div key={gi} className="mb-3 last:mb-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="font-display text-body font-semibold">
              {g.front ?? 'Sin frente indicado'}
              {g.front && exists(g.front) && <span className="ml-2 font-mono text-micro font-normal uppercase tracking-[0.08em] text-muted-foreground">existe</span>}
            </p>
            {g.front && !exists(g.front) && (
              <span className="flex items-center gap-2">
                <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">va a</span>
                <Pick
                  label={`Frente de destino para «${g.front}»`}
                  value={targetOf(g, gi)}
                  onChange={(id) => onChoose(gi, id)}
                  options={[{ value: '', label: `Crear frente «${g.front}»` }, ...db.fronts.map((f) => ({ value: f.id, label: f.name }))]}
                  className="w-60"
                  triggerClassName="h-8 bg-card text-small"
                />
              </span>
            )}
          </div>
          <ul>
            {g.nodes.map((n, i) => (
              <li key={i} style={{ paddingLeft: n.depth * 16 }} className={n.status === 'cancelada' ? 'text-muted-foreground line-through' : ''}>
                <span className="mr-1.5 text-muted-foreground">{n.depth ? '└' : '•'}</span>
                {n.title}
                {n.question && <span className="ml-1.5 font-mono text-micro text-warn">¿duda?</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
