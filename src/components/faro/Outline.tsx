import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { CalendarPlus, ChevronRight, ListPlus, ListTodo, Type, MessageCircleQuestion, MoreHorizontal, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useDialogs } from '@/lib/dialogs'
import {
  CHECKS, PLAN_GROUPS, PLAN_LABELS, PRIORITIES, SCOPES, STATUSES, VERIFICATIONS, addDecision, addTask, addToPlan, removeFromPlan, iso, checkCount, childrenOf, descendantsOf, effectiveProjectId, hasChildren,
  indentTask, isCancelled, isTreeDone, linkTaskDecision, moveTask, outdentTask, progress, projectOf, removeTask, setCheck, setSubtreeStatus,
  setTaskKind, setTaskNote, setTaskProject, setTaskStatus, setTaskTitle, setVerifiable, setVerification, taskById, textLoss, toggleCollapsed, updateVerify, useFaro,
  type Front, type Impact, type Priority, type Scope, type Task, type TaskStatus, type Verification,
} from '@/lib/faro'
import { Field, Pick } from './bits'
import { DecisionNote, ReviewBanner, StatusButton, TaskChips } from './TaskParts'

type Ctx = {
  /** Tarea que debe recibir el foco tras el próximo repintado (por ejemplo, la que acaba de crearse). */
  focus: MutableRefObject<string | null>
  visible: () => string[]
  detail: Set<string>
  toggleDetail: (id: string) => void
  hideDone: boolean
  convert: (t: Task) => void
  /** Día que se ve en «Hoy»: a ese día se añaden las tareas desde el menú. */
  day: string
}

const focusNote = (id: string) => {
  // El detalle se monta tras el repintado: se espera al siguiente frame.
  requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(`[data-task-note="${id}"]`)?.focus())
}

const focusTask = (id: string | undefined) => {
  if (!id) return
  const el = document.querySelector<HTMLTextAreaElement>(`[data-task-input="${id}"]`)
  el?.focus()
  if (el) el.setSelectionRange(el.value.length, el.value.length)
}

/** Ids de las tareas visibles en pantalla, en orden (respeta lo plegado y «ocultar lo terminado»). */
function visibleIds(frontId: string, hideDone: boolean): string[] {
  const out: string[] = []
  const walk = (parentId: string | null) => {
    for (const t of childrenOf(parentId, frontId)) {
      if (hideDone && isTreeDone(t)) continue
      out.push(t.id)
      if (!t.collapsed) walk(t.id)
    }
  }
  walk(null)
  return out
}

/**
 * Editor tipo esquema de las tareas de un frente. Se escribe como en un bloc de notas:
 * Enter crea otra tarea, Tab la convierte en subtarea, Mayús+Tab la sube de nivel, Alt+↑/↓ la mueve.
 */
export function Outline({ front, hideDone, day }: { front: Front; hideDone: boolean; day: string }) {
  useFaro() // se repinta cuando cambian los datos
  const focus = useRef<string | null>(null)
  const [detail, setDetail] = useState<Set<string>>(new Set())
  const [converting, setConverting] = useState<Task | null>(null)

  useEffect(() => {
    if (focus.current) {
      focusTask(focus.current)
      focus.current = null
    }
  })

  const ctx: Ctx = {
    focus,
    visible: () => visibleIds(front.id, hideDone),
    detail,
    toggleDetail: (id) =>
      setDetail((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    hideDone,
    convert: setConverting,
    day,
  }

  const roots = childrenOf(null, front.id).filter((t) => !(hideDone && isTreeDone(t)))
  return (
    <div>
      <ul className="grid gap-px">
        {roots.map((t) => (
          <TaskRow key={t.id} task={t} ctx={ctx} />
        ))}
      </ul>
      {!roots.length && <p className="px-2 pb-2 pt-1 text-sm text-muted-foreground">{childrenOf(null, front.id).length ? 'Todo lo de este frente está terminado.' : 'Aún no hay tareas. Escribe la primera aquí abajo.'}</p>}
      <NewTaskInput front={front} ctx={ctx} />
      <p className="mt-3 px-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Enter: nueva tarea · Tab: subtarea · Mayús+Tab: subir de nivel · Alt+↑/↓: mover · Ctrl+Enter: hecha · Alt+N: notas · Alt+T: tarea/texto · Esc: salir
      </p>
      <ConvertDialog task={converting} onClose={() => setConverting(null)} />
    </div>
  )
}

/* ---------- Añadir al final ---------- */
function NewTaskInput({ front, ctx }: { front: Front; ctx: Ctx }) {
  const [text, setText] = useState('')
  return (
    <div className="mt-1 flex items-center gap-1.5 px-1.5">
      <span className="grid size-7 shrink-0 place-items-center text-muted-foreground" aria-hidden>
        <ListPlus className="size-[18px]" />
      </span>
      <Input
        value={text}
        aria-label={`Añadir tarea al frente ${front.name}`}
        placeholder="Añadir tarea… (Enter)"
        className="h-9 border-transparent bg-transparent text-[15px] shadow-none hover:border-border"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (text.trim()) {
              addTask(front.id, null, text.trim())
              setText('')
            }
          } else if (e.key === 'ArrowUp' && !text) {
            const ids = ctx.visible()
            if (ids.length) {
              e.preventDefault()
              focusTask(ids[ids.length - 1])
            }
          }
        }}
      />
    </div>
  )
}

/* ---------- Fila de una tarea ---------- */
function TaskRow({ task: t, ctx }: { task: Task; ctx: Ctx }) {
  const { confirm } = useDialogs()
  const ref = useRef<HTMLTextAreaElement>(null)
  const kids = childrenOf(t.id, t.frontId)
  const shown = ctx.hideDone ? kids.filter((k) => !isTreeDone(k)) : kids
  const cancelled = isCancelled(t)
  const isText = t.kind === 'texto'
  const struck = !isText && (cancelled || t.status === 'hecha')
  const detailOpen = ctx.detail.has(t.id)
  const prog = kids.length ? progress(t) : null

  // El título crece con su contenido (los títulos largos se ven enteros).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [t.title])

  const keepFocus = () => (ctx.focus.current = t.id)

  async function toggleKind() {
    keepFocus()
    if (!isText && textLoss(t) && !(await confirm(`¿Convertir «${t.title || 'esta tarea'}» en texto?`, 'Perderá su estado, verificación y duda ligada. Sus subtareas se mantienen.', true))) return
    setTaskKind(t.id, isText ? 'tarea' : 'texto')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return
    const mod = e.ctrlKey || e.metaKey
    const el = e.currentTarget
    if (e.altKey && e.code === 'KeyN') {
      e.preventDefault()
      if (!detailOpen) focusNote(t.id)
      ctx.toggleDetail(t.id)
    } else if (e.altKey && e.code === 'KeyT') {
      e.preventDefault()
      void toggleKind()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (mod) return isText ? undefined : void setTaskStatus(t.id, t.status === 'hecha' ? 'pendiente' : 'hecha')
      if (!t.title.trim()) {
        if (t.parentId) {
          keepFocus()
          outdentTask(t.id)
        }
        return
      }
      ctx.focus.current = addTask(t.frontId, t.parentId, '', t.id)
    } else if (e.key === 'Tab' || (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'))) {
      e.preventDefault()
      keepFocus()
      if (e.shiftKey || e.key === 'ArrowLeft') outdentTask(t.id)
      else indentTask(t.id)
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      keepFocus()
      moveTask(t.id, e.key === 'ArrowUp' ? -1 : 1)
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !mod) {
      // Entre filas solo cuando el cursor está en el borde del texto; dentro de un título largo se mueve por sus líneas.
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0
      const atEnd = el.selectionStart === el.value.length
      const ids = ctx.visible()
      const i = ids.indexOf(t.id)
      if (e.key === 'ArrowUp' && atStart && i > 0) {
        e.preventDefault()
        focusTask(ids[i - 1])
      } else if (e.key === 'ArrowDown' && atEnd && i >= 0 && i < ids.length - 1) {
        e.preventDefault()
        focusTask(ids[i + 1])
      }
    } else if (e.key === 'Backspace' && !t.title && !hasChildren(t)) {
      e.preventDefault()
      const ids = ctx.visible()
      const prev = ids[ids.indexOf(t.id) - 1]
      removeTask(t.id)
      if (prev) ctx.focus.current = prev
    } else if (e.key === 'Escape') el.blur()
  }

  // Una fila vacía que se abandona se descarta; el retardo evita borrarla mientras se mueve (Tab) y recupera el foco.
  function onBlur() {
    if (t.title.trim() || hasChildren(t) || t.note || t.verify) return
    const id = t.id
    window.setTimeout(() => {
      const cur = taskById(id)
      const active = document.activeElement as HTMLElement | null
      if (cur && !cur.title.trim() && !hasChildren(cur) && !cur.note && !cur.verify && active?.getAttribute('data-task-input') !== id) removeTask(id)
    }, 150)
  }

  async function remove() {
    const n = descendantsOf(t.id).length
    if (n && !(await confirm(`¿Eliminar «${t.title || 'esta tarea'}»?`, `Se eliminarán también sus ${n} subtarea(s).`, true))) return
    removeTask(t.id)
  }

  return (
    <li>
      <div className={cn('group flex items-start gap-0.5 rounded-[3px] px-1 py-0.5 transition-colors hover:bg-accent/40 focus-within:bg-accent/50', cancelled && 'opacity-60')}>
        {kids.length ? (
          <button
            type="button"
            onClick={() => toggleCollapsed(t.id)}
            aria-label={t.collapsed ? 'Desplegar subtareas' : 'Plegar subtareas'}
            aria-expanded={!t.collapsed}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <ChevronRight className={cn('size-4 transition-transform', !t.collapsed && 'rotate-90')} />
          </button>
        ) : (
          <span className="size-7 shrink-0" aria-hidden />
        )}
        {isText ? <span className="size-7 shrink-0" aria-hidden /> : <StatusButton task={t} />}
        <div className="min-w-0 flex-1">
          <textarea
            ref={ref}
            rows={1}
            value={t.title}
            data-task-input={t.id}
            aria-label="Título de la tarea"
            placeholder="Tarea…"
            onChange={(e) => setTaskTitle(t.id, e.target.value.replace(/\n/g, ' '))}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            spellCheck
            className={cn(
              'block w-full resize-none overflow-hidden rounded-[3px] border border-transparent bg-transparent px-1.5 py-[3px] font-sans text-[15px] leading-snug focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/30',
              struck && 'text-muted-foreground line-through decoration-1',
            )}
          />
          {(t.verify || t.needsReview || t.decisionId || effectiveProjectId(t) || t.note) && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-1.5 pb-0.5">
              <TaskChips task={t} />
              {t.note && (
                <button type="button" onClick={() => ctx.toggleDetail(t.id)} className="inline-flex min-w-0 max-w-full items-center gap-1 text-left text-[12.5px] leading-snug text-muted-foreground hover:text-foreground">
                  <StickyNote className="size-3 shrink-0" />
                  <span className="min-w-0 truncate">{t.note.split('\n')[0]}</span>
                </button>
              )}
            </div>
          )}
        </div>
        {prog && (
          <span className="mt-1.5 flex shrink-0 items-center gap-2" title={`${prog.done} de ${prog.total} hechas`}>
            <Progress value={prog.total ? Math.round((prog.done / prog.total) * 100) : 0} className="hidden w-14 sm:block" aria-label={`${prog.done} de ${prog.total} hechas`} />
            <span className="tnum font-mono text-[11.5px] text-muted-foreground">
              {prog.done}/{prog.total}
            </span>
          </span>
        )}
        <RowMenu task={t} ctx={ctx} onRemove={() => void remove()} onKind={() => void toggleKind()} />
      </div>

      {detailOpen && <TaskDetail task={t} ctx={ctx} />}
      {shown.length > 0 && !t.collapsed && (
        <ul className="ml-[18px] grid gap-px border-l border-border/80 pl-2">
          {shown.map((k) => (
            <TaskRow key={k.id} task={k} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  )
}

/* ---------- Menú de la fila ---------- */
function RowMenu({ task: t, ctx, onRemove, onKind }: { task: Task; ctx: Ctx; onRemove: () => void; onKind: () => void }) {
  const isText = t.kind === 'texto'
  const act = (fn: () => unknown) => () => {
    ctx.focus.current = t.id
    fn()
  }
  const plan = useFaro().db.days[ctx.day]?.plan
  const inGroup = PLAN_GROUPS.find((g) => plan?.[g]?.includes(t.id))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7 shrink-0 text-muted-foreground opacity-60 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100" aria-label={`Opciones de «${t.title || 'tarea'}»`}>
          <MoreHorizontal className="!size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={() => ctx.toggleDetail(t.id)}>
          <Pencil className="mr-2 size-4" /> Detalle y notas
          <span className="ml-auto pl-3 font-mono text-[11px] text-muted-foreground">Alt+N</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (ctx.focus.current = addTask(t.frontId, t.id, ''))}>
          <ListPlus className="mr-2 size-4" /> Añadir subtarea
        </DropdownMenuItem>
        {!isText && (
          <>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CalendarPlus className="mr-2 size-4" /> {ctx.day === iso() ? 'Añadir a las tareas de hoy' : `Añadir a las tareas del ${ctx.day}`}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {PLAN_GROUPS.map((g) => (
              <DropdownMenuItem key={g} onSelect={() => addToPlan(ctx.day, g, t.id)} className={cn(inGroup === g && 'font-semibold')}>
                {PLAN_LABELS[g]}
                {inGroup === g && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
            {inGroup && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => removeFromPlan(ctx.day, t.id)}>Quitar de las tareas del día</DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="eyebrow">Estado</DropdownMenuLabel>
        {(Object.keys(STATUSES) as TaskStatus[]).map((s) => (
          <DropdownMenuItem key={s} onSelect={() => setTaskStatus(t.id, s)} className={cn(t.status === s && 'font-semibold')}>
            {STATUSES[s]}
          </DropdownMenuItem>
        ))}
        {hasChildren(t) && <DropdownMenuItem onSelect={() => setSubtreeStatus(t.id, 'hecha')}>Marcar todo como hecho</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setVerifiable(t.id, !t.verify)}>{t.verify ? 'Quitar «verificable»' : 'Hacer verificable'}</DropdownMenuItem>
        {!t.decisionId && (
          <DropdownMenuItem onSelect={() => ctx.convert(t)}>
            <MessageCircleQuestion className="mr-2 size-4" /> Convertir en duda para el PO
          </DropdownMenuItem>
        )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onKind}>
          {isText ? <ListTodo className="mr-2 size-4" /> : <Type className="mr-2 size-4" />} {isText ? 'Convertir en tarea' : 'Convertir en texto'}
          <span className="ml-auto pl-3 font-mono text-[11px] text-muted-foreground">Alt+T</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={act(() => indentTask(t.id))}>Sangrar (subtarea)</DropdownMenuItem>
        <DropdownMenuItem onSelect={act(() => outdentTask(t.id))}>Subir de nivel</DropdownMenuItem>
        <DropdownMenuItem onSelect={act(() => moveTask(t.id, -1))}>Mover arriba</DropdownMenuItem>
        <DropdownMenuItem onSelect={act(() => moveTask(t.id, 1))}>Mover abajo</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={onRemove}>
          <Trash2 className="mr-2 size-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------- Detalle de una tarea ---------- */
const Labeled = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-1.5">
    <span className="eyebrow">{label}</span>
    {children}
  </div>
)

function TaskDetail({ task: t, ctx }: { task: Task; ctx: Ctx }) {
  const { db } = useFaro()
  const { confirm, askText } = useDialogs()
  const inherited = !t.projectId ? projectOf(effectiveProjectId(t)) : undefined

  async function changeVerification(v: Verification) {
    if (v !== 'ninguna' && t.verify?.verification === 'ninguna') {
      const miss = CHECKS.length - checkCount(t)
      if (miss && !(await confirm(`Faltan ${miss} criterios de verificación`, 'Puedes marcarla igual, pero conviene completar la lista.'))) return
    }
    setVerification(t.id, v)
  }
  async function evidence() {
    const text = await askText('Evidencia o siguiente acción', t.verify?.evidence ?? '')
    if (text !== null) updateVerify(t.id, 'evidence', text)
  }

  return (
    <div className="mb-2 ml-[34px] mt-1 grid gap-5 rounded-[3px] border bg-card p-4">
      <Field label="Nota">
        <Textarea
          value={t.note}
          data-task-note={t.id}
          onChange={(e) => setTaskNote(t.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.altKey && e.code === 'KeyN') {
              e.preventDefault()
              ctx.toggleDetail(t.id)
              focusTask(t.id)
            }
          }}
          placeholder="Contexto, dudas, comentarios… (lo que en el bloc de notas escribías entre paréntesis)"
          className="min-h-[72px] text-sm"
        />
      </Field>

      {t.kind !== 'texto' && (
      <>
      <div className="flex flex-wrap items-end gap-4">
        <Labeled label="Estado">
          <Pick
            label="Estado"
            value={t.status}
            onChange={(s) => setTaskStatus(t.id, s as TaskStatus)}
            options={(Object.keys(STATUSES) as TaskStatus[]).map((s) => ({ value: s, label: STATUSES[s] }))}
            className="w-44"
            triggerClassName="h-9 text-sm"
          />
        </Labeled>
        <Labeled label="Repositorio">
          <Pick
            label="Repositorio"
            value={t.projectId ?? ''}
            onChange={(p) => setTaskProject(t.id, p || null)}
            options={[{ value: '', label: inherited ? `Heredado: ${inherited.name}` : 'Sin repositorio' }, ...db.projects.map((p) => ({ value: p.id, label: p.name }))]}
            className="w-56"
            triggerClassName="h-9 text-sm"
          />
        </Labeled>
        <label className="flex h-9 cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={!!t.verify} onCheckedChange={(on) => setVerifiable(t.id, on === true)} />
          Es verificable
        </label>
      </div>

      <ReviewBanner task={t} />
      <div>
        <DecisionNote task={t} />
        {t.decisionId && (
          <Button size="xs" variant="ghost" className="-ml-2 mt-1 text-muted-foreground" onClick={() => linkTaskDecision(t.id, null)}>
            Desvincular decisión
          </Button>
        )}
      </div>

      {t.verify && (
        <fieldset className="grid gap-4 border-t pt-4">
          <legend className="eyebrow float-left mb-3">Verificación</legend>
          <div className="clear-both flex flex-wrap items-end gap-4">
            <Labeled label="Nivel">
              <Pick
                label="Verificación"
                value={t.verify.verification}
                onChange={(v) => void changeVerification(v as Verification)}
                options={(Object.keys(VERIFICATIONS) as Verification[]).map((v) => ({ value: v, label: VERIFICATIONS[v] }))}
                className="w-60"
                triggerClassName="h-9 text-sm"
              />
            </Labeled>
            <Labeled label="Lanzamiento">
              <Pick
                label="Relación con el lanzamiento"
                value={t.verify.scope}
                onChange={(v) => updateVerify(t.id, 'scope', v as Scope)}
                options={Object.entries(SCOPES).map(([value, label]) => ({ value, label }))}
                className="w-48"
                triggerClassName="h-9 text-sm"
              />
            </Labeled>
            <Labeled label="Prioridad">
              <Pick
                label="Prioridad"
                value={t.verify.priority}
                onChange={(v) => updateVerify(t.id, 'priority', v as Priority)}
                options={Object.entries(PRIORITIES).map(([value, label]) => ({ value, label }))}
                className="w-32"
                triggerClassName="h-9 text-sm"
              />
            </Labeled>
            <Button size="sm" variant="outline" onClick={() => void evidence()}>
              <Pencil /> Evidencia
            </Button>
          </div>
          {t.verify.evidence && <p className="text-sm leading-snug">↳ {t.verify.evidence}</p>}
          <ul className="grid gap-2.5 border-l border-border pl-3">
            {CHECKS.map(([k, l]) => (
              <li key={k}>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={!!t.verify!.checks[k]} onCheckedChange={(on) => setCheck(t.id, k, on === true)} />
                  {l}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      </>
      )}
    </div>
  )
}

/* ---------- Convertir una tarea en duda para el PO ---------- */
function ConvertDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">{task && <ConvertForm task={task} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}
function ConvertForm({ task: t, onClose }: { task: Task; onClose: () => void }) {
  const [question, setQuestion] = useState(t.title)
  const [assumption, setAssumption] = useState('')
  const [impact, setImpact] = useState<Impact>('medio')
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!question.trim()) return
        addDecision({ question, assumption, impact, taskId: t.id, frontId: t.frontId, projectIds: [] }, true)
        toast.success('Duda registrada para el PO', { description: assumption.trim() ? 'Con supuesto: puedes seguir trabajando.' : 'Sin supuesto: la tarea queda esperando al PO.' })
        onClose()
      }}
    >
      <DialogHeader>
        <p className="eyebrow">Convertir en duda</p>
        <DialogTitle>Duda para el PO</DialogTitle>
        <DialogDescription>La tarea queda ligada a la decisión. Si avanzas con un supuesto, escríbelo.</DialogDescription>
      </DialogHeader>
      <Field label="Pregunta concreta" htmlFor="cv-q">
        <Textarea id="cv-q" required autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} />
      </Field>
      <Field label="Supuesto provisional (opcional)" htmlFor="cv-a">
        <Textarea id="cv-a" value={assumption} onChange={(e) => setAssumption(e.target.value)} placeholder="Con qué regla avanzas mientras el PO responde" />
      </Field>
      <Field label="Impacto de equivocarse">
        <Pick
          label="Impacto"
          value={impact}
          onChange={(v) => setImpact(v as Impact)}
          options={[
            { value: 'alto', label: 'Alto' },
            { value: 'medio', label: 'Medio' },
            { value: 'bajo', label: 'Bajo' },
          ]}
        />
      </Field>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="beam">Registrar duda</Button>
      </DialogFooter>
    </form>
  )
}
