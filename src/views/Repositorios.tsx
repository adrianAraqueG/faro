import { useState } from 'react'
import { BookOpen, Bot, ClipboardCopy, FolderGit2, Link2, Pencil, Plus, Trash2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getAgentInstructions } from '@/lib/api'
import { useDialogs } from '@/lib/dialogs'
import {
  addLink, addProject, decisionFront, effectiveProjectId, isCancelled, isLeaf, isOpenDecision, removeLink, removeProject, updateProject, useFaro,
  type Project,
} from '@/lib/faro'
import { Callout, Chip, Empty, Field, PageHeader, Pick, Section } from '@/components/faro/bits'
import { DecisionItem } from '@/components/faro/DecisionItem'
import { TaskLine } from '@/components/faro/TaskLine'

/** Trae del servidor las instrucciones para pegar en AGENTS.md (con el repositorio ya rellenado si se indica). */
function useCopyInstructions() {
  const { copyText } = useDialogs()
  return async (project?: string) => {
    try {
      copyText(await getAgentInstructions(project))
    } catch {
      toast.error('No se pudieron obtener las instrucciones')
    }
  }
}

export function Repositorios({ go }: { go: (tab: string) => void }) {
  const { db } = useFaro()
  const copyInstructions = useCopyInstructions()
  const [editing, setEditing] = useState<Project | 'nuevo' | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Dónde vive el código"
        title="Repositorios"
        desc="Un repositorio es donde vive el código; un frente es un área de trabajo. Se cruzan en las tareas y las decisiones, no se declaran de antemano."
        actions={
          <Button variant="beam" onClick={() => setEditing('nuevo')}>
            <Plus /> Nuevo repositorio
          </Button>
        }
      />

      <div className="grid gap-x-16 gap-y-16 min-[1400px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-14">
          {db.projects.map((p) => (
            <RepositorioSeccion key={p.id} project={p} onEdit={() => setEditing(p)} />
          ))}
          {!db.projects.length && <Empty>Todavía no hay repositorios. Crea el primero para vincularlo a un frente.</Empty>}
        </div>

        <aside className="grid content-start gap-16">
          <Section title="Configurar un repositorio nuevo">
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              La guía te lleva paso a paso (frente, repositorio, <code className="font-mono text-caption">AGENTS.md</code>, <code className="font-mono text-caption">docs/</code>), muestra tu estado de configuración y tiene un ejemplo de repositorio ya conectado.
            </p>
            <Button variant="beam" onClick={() => go('guia')}>
              <BookOpen /> Abrir la guía de inicio
            </Button>
          </Section>
          <Section title="Agentes de IA">
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Cualquier agente (Claude, Codex u otro) registra y consulta decisiones por el endpoint local de FARO. Pega estas instrucciones en el <code className="font-mono text-caption">AGENTS.md</code> del repo; si el agente lee otro archivo, pégalas allí.
            </p>
            <Button variant="outline" onClick={() => void copyInstructions()}>
              <ClipboardCopy /> Copiar instrucciones
            </Button>
            <p className="mt-3 text-small leading-relaxed text-muted-foreground">
              Cada repositorio tiene su botón con el nombre y los frentes ya rellenados. Los agentes <b className="font-semibold text-foreground">proponen</b>; tú resuelves en «Dudas y decisiones».
            </p>
          </Section>
          <Section title="Cómo se vinculan">
            <ul className="grid gap-3 text-sm leading-relaxed text-muted-foreground">
              <li>
                Al registrar una tarea con repositorio o una decisión, FARO crea solo el <b className="font-semibold text-foreground">vínculo repositorio × frente</b>.
              </li>
              <li>
                Cada vínculo corresponde a la carpeta <code className="rounded-sm bg-secondary px-1 font-mono text-caption">docs/&lt;slug-del-frente&gt;/</code> dentro del repositorio.
              </li>
              <li>Un repositorio puede tener varios frentes y un frente puede estar en varios repositorios.</li>
            </ul>
            <Callout className="mt-4 text-small">
              Las decisiones se guardan en FARO, no en los archivos del repo. Los docs de <code className="font-mono">docs/&lt;slug&gt;/</code> solo mencionan su código, como <code className="font-mono">DEC-0007</code>.
            </Callout>
          </Section>
        </aside>
      </div>

      <RepositorioDialog editing={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function RepositorioSeccion({ project: p, onEdit }: { project: Project; onEdit: () => void }) {
  const { db } = useFaro()
  const { confirm } = useDialogs()
  const copyInstructions = useCopyInstructions()
  const [pick, setPick] = useState('')
  const fronts = db.links.filter((l) => l.projectId === p.id)
  const unlinked = db.fronts.filter((f) => !fronts.some((l) => l.frontId === f.id))
  // tareas de este repositorio (propias o heredadas), sin las canceladas
  const mine = db.tasks.filter((t) => t.kind !== 'texto' && effectiveProjectId(t) === p.id && !isCancelled(t))
  const openTasks = mine.filter((t) => isLeaf(t) && t.status !== 'hecha').length
  const openDecisions = db.decisions.filter((d) => d.projectIds.includes(p.id) && isOpenDecision(d)).length
  const review = mine.filter((t) => t.needsReview).length

  async function remove() {
    const guard = db.tasks.some((t) => t.projectId === p.id) || db.decisions.some((d) => d.projectIds.includes(p.id))
    if (guard) return void toast.error('Tiene tareas o decisiones: reasígnalas primero')
    if (await confirm('¿Eliminar este repositorio?', p.name, true)) removeProject(p.id)
  }

  return (
    <Section
      title={p.name}
      aside={
        <span className="flex items-center gap-1">
          <Button size="xs" variant="outline" className="mr-1" onClick={() => void copyInstructions(p.name)}>
            <Bot /> Instrucciones para agentes
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label={`Editar repositorio ${p.name}`} onClick={onEdit}>
            <Pencil className="!size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8 text-danger hover:text-danger" aria-label={`Eliminar repositorio ${p.name}`} onClick={() => void remove()}>
            <Trash2 className="!size-3.5" />
          </Button>
        </span>
      }
    >
      <p className="-mt-3 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 break-all">
          <FolderGit2 className="size-3.5 shrink-0" />
          {p.path || 'Sin ruta'}
        </span>
        <span className="tnum">
          {openTasks} tarea(s) pendientes · {openDecisions} decisión(es) abiertas
        </span>
        {review > 0 && <Chip tone="danger">{review} requieren revisión</Chip>}
      </p>

      <div className="grid gap-8">
        {fronts.map((l) => {
          const fr = db.fronts.find((f) => f.id === l.frontId)
          if (!fr) return null
          const decisions = db.decisions.filter((d) => d.projectIds.includes(p.id) && decisionFront(d)?.id === fr.id && isOpenDecision(d))
          const pending = mine.filter((t) => t.frontId === fr.id && (t.needsReview || (isLeaf(t) && t.status !== 'hecha')))
          const items = pending.slice(0, 8)
          return (
            <div key={l.id} className="border-l-2 border-border pl-5">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-display text-lg font-semibold">{fr.name}</h3>
                <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-micro text-muted-foreground">docs/{fr.slug}/</code>
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto text-muted-foreground"
                  onClick={() => {
                    const err = removeLink(l.id)
                    if (err) toast.error(err)
                  }}
                >
                  <Unlink /> Desvincular
                </Button>
              </div>
              <div className="grid gap-3">
                {decisions.map((d) => (
                  <DecisionItem key={d.id} decision={d} compact />
                ))}
                {items.map((t) => (
                  <TaskLine key={t.id} task={t} />
                ))}
                {pending.length > items.length && <p className="text-sm text-muted-foreground">y {pending.length - items.length} tarea(s) más en «Frentes».</p>}
                {!decisions.length && !items.length && <p className="text-sm text-muted-foreground">Nada pendiente en este frente.</p>}
              </div>
            </div>
          )
        })}
        {!fronts.length && <p className="text-sm text-muted-foreground">Sin frentes vinculados todavía.</p>}

        {unlinked.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Pick
              label={`Vincular un frente a ${p.name}`}
              value={pick}
              onChange={setPick}
              className="w-64"
              triggerClassName="h-9 text-sm"
              placeholder="Vincular un frente…"
              options={unlinked.map((f) => ({ value: f.id, label: f.name }))}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!pick}
              onClick={() => {
                addLink(p.id, pick)
                setPick('')
              }}
            >
              <Link2 /> Vincular
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}

function RepositorioDialog({ editing, onClose }: { editing: Project | 'nuevo' | null; onClose: () => void }) {
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {/* Se monta solo mientras hay algo que editar, así el formulario arranca limpio cada vez. */}
        {editing && <RepositorioForm editing={editing} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function RepositorioForm({ editing, onClose }: { editing: Project | 'nuevo'; onClose: () => void }) {
  const isNew = editing === 'nuevo'
  const [name, setName] = useState(isNew ? '' : editing.name)
  const [path, setPath] = useState(isNew ? '' : editing.path)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const err = isNew ? addProject(n, path.trim()) : updateProject(editing.id, n, path.trim())
    if (err) return void toast.error(err)
    onClose()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <p className="eyebrow">{isNew ? 'Nuevo' : 'Editar'}</p>
        <DialogTitle>{isNew ? 'Nuevo repositorio' : 'Editar repositorio'}</DialogTitle>
        <DialogDescription>El nombre es el que usarán los agentes al registrar decisiones.</DialogDescription>
      </DialogHeader>
      <Field label="Nombre" htmlFor="pj-name">
        <Input id="pj-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="erp-api" />
      </Field>
      <Field label="Ruta del repositorio en tu PC" htmlFor="pj-path">
        <Input id="pj-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder={'C:\\Dev\\erp-api'} className="font-mono text-small" />
      </Field>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="beam">{isNew ? 'Crear repositorio' : 'Guardar'}</Button>
      </DialogFooter>
    </form>
  )
}
