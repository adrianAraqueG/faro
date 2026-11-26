import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { OutlineGroup } from './outline'

/*
 * Tipos (esquema v11). Estructura: Frente → árbol de tareas (profundidad libre).
 *   Task     = tarea o subtarea. `parentId` (null = primer nivel del frente) y `order` forman el árbol.
 *   verify   = si la tarea es «verificable»: criterios, verificación técnica y aceptación del PO. Opcional.
 *   Project  = repositorio (la interfaz lo llama «Repositorio»).
 */
export type Front = { id: string; name: string; slug: string }
export type Project = { id: string; name: string; path: string }
export type Link = { id: string; projectId: string; frontId: string }
export type TaskStatus = 'pendiente' | 'curso' | 'bloqueada' | 'hecha' | 'cancelada'
export type Verification = 'ninguna' | 'tecnico' | 'po' | 'aceptado'
export type Scope = 'candidato' | 'confirmado' | 'posterior'
export type Priority = 'alta' | 'media' | 'baja'
export type Impact = 'alto' | 'medio' | 'bajo'
export type Verify = {
  scope: Scope
  priority: Priority
  verification: Verification
  evidence: string
  checks: Record<string, boolean>
  verifiedAt: string | null
  acceptedAt: string | null
}
export type TaskKind = 'tarea' | 'texto'
export type Task = {
  id: string
  /** 'texto' = simple línea de texto (documentación): sin estado, no cuenta en el avance ni se planea. */
  kind: TaskKind
  frontId: string
  parentId: string | null
  /** Posición entre sus hermanas. */
  order: number
  title: string
  status: TaskStatus
  /** Texto libre: contexto, dudas, comentarios. */
  note: string
  collapsed: boolean
  /** Repositorio donde se implementa; las subtareas lo heredan si no tienen el suyo. */
  projectId: string | null
  decisionId: string | null
  /** El PO cambió un supuesto del que depende: hay que revisar el trabajo hecho. */
  needsReview: boolean
  verify: Verify | null
  created: string
  /** Día (AAAA-MM-DD) en que se marcó «hecha»; null si no lo está o no se sabe cuándo. */
  doneAt: string | null
}
export type DecisionState = 'abierta' | 'en_supuesto' | 'resuelta'
export type Outcome = 'confirma' | 'cambia'
export type LogEntry = { at: string; state: DecisionState; note?: string }
export type Decision = {
  id: string
  code: string
  question: string
  /** Texto libre que explica la pregunta: qué caso la originó, qué opciones hay, qué pasa si no se resuelve. */
  context: string
  assumption: string
  impact: Impact
  state: DecisionState
  /** Solo al resolver desde «en supuesto»: si el PO confirmó o cambió el supuesto. */
  outcome: Outcome | null
  resolution: string
  created: string
  /** Frente al que pertenece la decisión («General» si no es de ninguno en particular). */
  frontId: string
  /** Tarea (o subtarea) del frente a la que se refiere (opcional). */
  taskId: string | null
  /** Repositorios afectados; el primero es el principal. */
  projectIds: string[]
  log: LogEntry[]
  /** Quién la registró cuando fue un agente (claude, codex...) y su clave anti-duplicados. */
  origin?: string
  key?: string
}
/** Grupos del plan del día: lo principal y lo secundario. */
export const PLAN_GROUPS = ['primary', 'secondary'] as const
export type PlanGroup = (typeof PLAN_GROUPS)[number]
export const PLAN_LABELS: Record<PlanGroup, string> = { primary: 'Principal', secondary: 'Secundario' }
/** `plan` y `achieved` guardan ids de tareas; `tomorrow` es la nota que verás el siguiente día con trabajo; `extras` anota lo que se hizo sin ser una tarea propia. */
export type Day = { plan?: Partial<Record<PlanGroup, string[]>>; achieved?: string[]; tomorrow?: string; extras?: string }
export const WEEK_FIELDS = ['weekDone', 'weekRisks', 'weekNext'] as const
export type WeekField = (typeof WEEK_FIELDS)[number]
export type Week = Partial<Record<WeekField, string>>
/** Una reunión: notas libres con fecha; el historial se conserva (la más reciente primero). */
export type Meeting = { id: string; title: string; date: string; text: string; created: string; updated: string }
export type Db = {
  v: 10
  fronts: Front[]
  tasks: Task[]
  decisions: Decision[]
  projects: Project[]
  links: Link[]
  counters: { decision: number }
  days: Record<string, Day>
  weeks: Record<string, Week>
  meetings: Meeting[]
}

/* ---------- Constantes de dominio ---------- */
export const STATUSES: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  curso: 'En curso',
  bloqueada: 'Bloqueada',
  hecha: 'Hecha',
  cancelada: 'Cancelada',
}
export const VERIFICATIONS: Record<Verification, string> = {
  ninguna: 'Sin verificar',
  tecnico: 'Verificado técnicamente',
  po: 'Pendiente de aceptación PO',
  aceptado: 'Aceptado',
}
export const SCOPES: Record<Scope, string> = {
  candidato: 'Candidato',
  confirmado: 'Confirmado',
  posterior: 'Otro frente / posterior',
}
export const DECISION_STATES: Record<DecisionState, string> = { abierta: 'Abierta', en_supuesto: 'En supuesto', resuelta: 'Resuelta' }
export const OUTCOMES: Record<Outcome, string> = { confirma: 'Confirma el supuesto', cambia: 'Cambia el supuesto' }
export const PRIORITIES: Record<Priority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
export const CHECKS: [string, string][] = [
  ['def', 'Comportamiento esperado definido (o supuesto explícito)'],
  ['tests', 'Pruebas relevantes ejecutadas'],
  ['ia', 'Código IA revisado y comprensible'],
  ['contract', 'Contrato frontend actualizado (si aplica)'],
  ['proof', 'Evidencia registrable disponible'],
]
/* ---------- Utilidades ---------- */
export function slugify(name: string) {
  return (
    name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frente'
  )
}
export const decisionCode = (n: number) => `DEC-${String(n).padStart(4, '0')}`
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export function iso(d = new Date()) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return x.toISOString().slice(0, 10)
}
export function weekStart(v: string) {
  const d = new Date(v + 'T12:00:00'),
    day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return iso(d)
}

/* ---------- Sincronización con el servidor local (faro.json) ---------- */
export type SaveInfo = { kind: 'saving' | 'ok' | 'error'; at: Date | null }
export type Status = 'loading' | 'ready' | 'offline' | 'outdated'
/** Versión del esquema que entiende esta interfaz. Si el servidor tiene otra, esta pestaña está desactualizada. */
export const SCHEMA_VERSION = 11
class OutdatedError extends Error {}

/** Hasta que carga no hay base; la interfaz no pinta vistas antes de `status === 'ready'`. */
let db = null as unknown as Db
let rev = 0
let file = ''
let dirty = false
let inflight = false
let timer: ReturnType<typeof setTimeout> | undefined
let snap = { v: 0, status: 'loading' as Status, online: true, save: { kind: 'ok', at: null } as SaveInfo, file: '' }
const listeners = new Set<() => void>()
const emit = (patch: Partial<Omit<typeof snap, 'v'>> = {}) => {
  snap = { ...snap, ...patch, v: snap.v + 1 }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = (await r.json().catch(() => ({}))) as T
  return { status: r.status, body }
}
type Remote = { rev: number; db: Db; file: string; error?: string | null }
function apply(r: Remote) {
  // Tras una actualización de FARO el servidor puede migrar los datos mientras esta pestaña sigue con el código viejo.
  if (r.db.v !== SCHEMA_VERSION) throw new OutdatedError()
  db = r.db
  rev = r.rev
  file = r.file
}

/** Carga inicial desde el servidor. */
export async function loadFaro() {
  emit({ status: 'loading' })
  try {
    const { status, body } = await api<Remote>('/api/db')
    if (status !== 200) throw new Error('respuesta inesperada')
    apply(body)
    emit({ status: 'ready', online: true, file, save: { kind: 'ok', at: null } })
  } catch (e) {
    emit({ status: e instanceof OutdatedError ? 'outdated' : 'offline' })
  }
}

/** Reemplaza la copia local por la del servidor (tras un conflicto o un cambio externo). */
async function reload() {
  const { status, body } = await api<Remote>('/api/db')
  if (status !== 200) throw new Error('respuesta inesperada')
  apply(body)
  dirty = false
}

/** Persiste y notifica; el guardado real se agrupa en un pequeño retardo. */
function commit() {
  dirty = true
  emit({ save: { kind: 'saving', at: null } })
  clearTimeout(timer)
  timer = setTimeout(() => void flush(), 400)
}

async function flush(keepalive = false) {
  clearTimeout(timer)
  if (!dirty || inflight) return
  inflight = true
  dirty = false
  try {
    const { status, body } = await api<{ rev: number }>('/api/db', { method: 'PUT', body: JSON.stringify({ rev, db }), keepalive })
    if (status === 200) {
      rev = body.rev
      inflight = false
      if (dirty) return void flush()
      return emit({ online: true, save: { kind: 'ok', at: new Date() } })
    }
    if (status === 409) {
      await reload()
      inflight = false
      toast.warning('Los datos cambiaron en otro lugar', { description: 'Se cargó la última versión; revisa tu último cambio.' })
      return emit({ online: true, save: { kind: 'ok', at: new Date() } })
    }
    throw new Error('respuesta inesperada')
  } catch (e) {
    inflight = false
    if (e instanceof OutdatedError) return emit({ status: 'outdated' })
    dirty = true
    emit({ online: false, save: { kind: 'error', at: null } })
    timer = setTimeout(() => void flush(), 3000) // reintenta hasta que el servidor vuelva
  }
}

/** Activa la sincronización de fondo: detecta cambios externos (otra pestaña, un agente, edición manual) y guarda al salir. */
export function startSync() {
  const poll = async () => {
    if (document.hidden || dirty || inflight || snap.status !== 'ready') return
    try {
      const { body } = await api<{ rev: number }>('/api/rev')
      if (!snap.online) emit({ online: true })
      if (body.rev !== rev) {
        await reload()
        emit({ file })
        toast('Datos actualizados desde el servidor')
      }
    } catch (e) {
      if (e instanceof OutdatedError) return emit({ status: 'outdated' })
      if (snap.online) emit({ online: false })
    }
  }
  const id = setInterval(() => void poll(), 4000)
  const onHide = () => document.hidden && void flush()
  const onLeave = (e: BeforeUnloadEvent) => {
    if (dirty || inflight) {
      void flush(true)
      e.preventDefault()
    }
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('beforeunload', onLeave)
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('beforeunload', onLeave)
  }
}

/** Hook: devuelve la base actual y el estado de sincronización; re-renderiza ante cualquier cambio. */
export function useFaro() {
  const s = useSyncExternalStore(subscribe, () => snap)
  return { db, save: s.save, status: s.status, online: s.online, file: s.file }
}

/* ---------- Consultas ---------- */
export const GENERAL_SLUG = 'general'
export const normText = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
const byOrder = (a: Task, b: Task) => a.order - b.order

export const taskById = (id: string | null | undefined) => (id ? db.tasks.find((t) => t.id === id) : undefined)
export const frontById = (id: string | null | undefined) => db.fronts.find((f) => f.id === id)
export const frontOfTask = (t: Task) => frontById(t.frontId)
export const generalFront = () => db.fronts.find((f) => f.slug === GENERAL_SLUG) ?? db.fronts[0]

/** Hijas directas de una tarea, o tareas de primer nivel de un frente si `parentId` es null. */
export const childrenOf = (parentId: string | null, frontId: string) =>
  db.tasks.filter((t) => t.parentId === parentId && t.frontId === frontId).sort(byOrder)
/** Ancestros, del más cercano al más lejano. */
export function ancestorsOf(t: Task): Task[] {
  const out: Task[] = []
  for (let n = taskById(t.parentId), guard = 0; n && guard < 100; n = taskById(n.parentId), guard++) out.push(n)
  return out
}
/** Camino desde el primer nivel hasta la tarea (incluida). */
export const pathOf = (t: Task) => [...ancestorsOf(t).reverse(), t]
export function descendantsOf(id: string): Task[] {
  const out: Task[] = []
  const walk = (pid: string) => db.tasks.filter((t) => t.parentId === pid).forEach((c) => (out.push(c), walk(c.id)))
  walk(id)
  return out
}
/** Una tarea cancelada se desactiva con todo lo que cuelga de ella. */
export const isCancelled = (t: Task) => t.status === 'cancelada' || ancestorsOf(t).some((a) => a.status === 'cancelada')
/** Tareas activas bajo `t`: las líneas de texto no cuentan, pero sus tareas hijas sí (se atraviesan). */
const activeKids = (t: Task): Task[] =>
  db.tasks.filter((c) => c.parentId === t.id && c.status !== 'cancelada').flatMap((c) => (c.kind === 'texto' ? activeKids(c) : [c]))
export const isText = (t: Task) => t.kind === 'texto'
export const hasChildren = (t: Task) => db.tasks.some((c) => c.parentId === t.id)
/** Hoja = sin subtareas activas (las canceladas no cuentan). */
export const isLeaf = (t: Task) => activeKids(t).length === 0

/** Avance de una tarea con subtareas: hojas hechas / hojas activas (las canceladas no cuentan). */
export function progress(t: Task) {
  let done = 0,
    total = 0
  const walk = (n: Task) => {
    const kids = activeKids(n)
    if (kids.length) return kids.forEach(walk)
    if (isText(n)) return
    total++
    if (n.status === 'hecha') done++
  }
  walk(t)
  return { done, total }
}
/** ¿Está terminada? Hoja hecha, o todas sus hojas activas hechas. Lo cancelado cuenta como terminado. */
export function isTreeDone(t: Task) {
  if (t.status === 'cancelada') return true
  const { done, total } = progress(t)
  return total > 0 && done === total
}
export const isVerifiedTask = (t: Task) => !!t.verify && t.verify.verification !== 'ninguna'
export const checkCount = (t: Task) => CHECKS.filter(([k]) => t.verify?.checks?.[k]).length

/** Repositorio efectivo: el propio, o el del ancestro más cercano que lo tenga. */
export function effectiveProjectId(t: Task): string | null {
  if (t.projectId) return t.projectId
  return ancestorsOf(t).find((a) => a.projectId)?.projectId ?? null
}
export const projectOf = (id: string | null | undefined) => db.projects.find((p) => p.id === id)

export const taskPath = (t: Task) => pathOf(t).map((n) => n.title)
/** «Frente › Padre › Hija» */
export const crumb = (t: Task) => [frontOfTask(t)?.name ?? '—', ...taskPath(t)].join(' › ')

export const decisionOf = (t: Task) => db.decisions.find((d) => d.id === t.decisionId)
/** Una decisión sigue abierta mientras el PO no la resuelva (con o sin supuesto). */
export const isOpenDecision = (d: Decision) => d.state !== 'resuelta'
/** Bloquea el trabajo solo si no hay supuesto con el que avanzar. */
export const pendingDecision = (t: Task) => {
  const d = decisionOf(t)
  return d && d.state === 'abierta' ? d : null
}
export const decisionTask = (d: Decision) => taskById(d.taskId)
export const decisionFront = (d: Decision) => frontById(d.frontId)
export const decisionProjects = (d: Decision) => d.projectIds.map((id) => projectOf(id)).filter((p): p is Project => !!p)
/** Tareas de un frente en orden de árbol, con su ruta («Padre › Hija») y su profundidad: para selectores. */
export function flatTasks(frontId: string): { task: Task; label: string; depth: number }[] {
  const out: { task: Task; label: string; depth: number }[] = []
  const walk = (parentId: string | null, trail: string[]) =>
    childrenOf(parentId, frontId).forEach((t) => {
      if (!isText(t)) out.push({ task: t, label: [...trail, t.title || '(sin título)'].join(' › '), depth: trail.length })
      walk(t.id, [...trail, t.title || '(sin título)'])
    })
  walk(null, [])
  return out
}
/** Frente existente que probablemente es el mismo que `name` («ERP» ↔ «ERP en Efactura»); solo si hay uno claro. */
export function suggestFront(name: string): Front | undefined {
  const key = normText(name)
  const exact = db.fronts.find((f) => normText(f.name) === key || f.slug === slugify(name))
  if (exact) return exact
  const close = db.fronts.filter((f) => normText(f.name).includes(key) || key.includes(normText(f.name)))
  return close.length === 1 ? close[0] : undefined
}
/** Frentes vinculados a un repositorio. */
export const projectFronts = (projectId: string) =>
  db.links.filter((l) => l.projectId === projectId).map((l) => frontById(l.frontId)).filter((f): f is Front => !!f)
/** ¿Hay tareas o decisiones que justifiquen este vínculo repositorio × frente? */
export const linkInUse = (l: Link) =>
  db.tasks.some((t) => t.frontId === l.frontId && effectiveProjectId(t) === l.projectId) ||
  db.decisions.some((d) => d.projectIds.includes(l.projectId) && d.frontId === l.frontId)

export function metrics(weekDate: string) {
  const live = db.tasks.filter((t) => !isCancelled(t))
  const vs = live.filter((t) => !!t.verify)
  const verified = vs.filter(isVerifiedTask).length,
    accepted = vs.filter((t) => t.verify!.verification === 'aceptado').length,
    high = db.decisions.filter((d) => isOpenDecision(d) && d.impact === 'alto').length,
    candidate = vs.filter((t) => t.verify!.scope === 'candidato').length,
    confirmed = vs.filter((t) => t.verify!.scope === 'confirmado').length,
    blocked = live.filter((t) => t.status === 'bloqueada').length,
    review = live.filter((t) => t.needsReview).length
  const week = weekStart(weekDate || iso()),
    end = iso(new Date(new Date(week + 'T12:00:00').getTime() + 6 * 864e5))
  const days = Object.entries(db.days)
    .filter(([k, d]) => k >= week && k <= end && (planIds(d).length || d.achieved?.length || d.tomorrow || d.extras))
    .sort(([a], [b]) => a.localeCompare(b))
  return { verified, accepted, high, candidate, confirmed, blocked, review, days }
}

/* ---------- Día: plan, cierre y nota ---------- */
export const planIds = (d: Day) => PLAN_GROUPS.flatMap((g) => d.plan?.[g] ?? [])
/** Tareas de una lista de ids; descarta las que ya no existen. */
export const tasksOf = (ids: string[] | undefined) => (ids ?? []).map((id) => taskById(id)).filter((t): t is Task => !!t)
/** Tareas que se marcaron hechas ese día y todavía no están en el cierre. */
export const doneOn = (date: string) => {
  const have = new Set(db.days[date]?.achieved ?? [])
  return db.tasks.filter((t) => t.status === 'hecha' && t.doneAt === date && !have.has(t.id))
}
/**
 * Nota «para mañana» que se muestra en `date`: la del día anterior más cercano que la tenga
 * (un lunes sale la del viernes). Devuelve la fecha de origen y el texto.
 */
export function carryNote(date: string): { date: string; text: string } | null {
  const prev = Object.entries(db.days)
    .filter(([k, d]) => k < date && d.tomorrow?.trim())
    .sort(([a], [b]) => b.localeCompare(a))[0]
  return prev ? { date: prev[0], text: prev[1].tomorrow!.trim() } : null
}

function ensureDay(date: string) {
  return (db.days[date] = db.days[date] || {})
}
/** Añade la tarea a un grupo del plan; si estaba en otro grupo del mismo día, se mueve. */
export function addToPlan(date: string, group: PlanGroup, taskId: string) {
  if (taskById(taskId)?.kind === 'texto') return
  const d = ensureDay(date)
  d.plan = d.plan || {}
  for (const g of PLAN_GROUPS) d.plan[g] = (d.plan[g] ?? []).filter((id) => id !== taskId)
  d.plan[group] = [...(d.plan[group] ?? []), taskId]
  commit()
}
export function removeFromPlan(date: string, taskId: string) {
  const d = db.days[date]
  if (!d?.plan) return
  for (const g of PLAN_GROUPS) d.plan[g] = (d.plan[g] ?? []).filter((id) => id !== taskId)
  commit()
}
export function addToAchieved(date: string, taskIds: string[]) {
  const d = ensureDay(date)
  d.achieved = [...new Set([...(d.achieved ?? []), ...taskIds])]
  commit()
}
export function removeFromAchieved(date: string, taskId: string) {
  const d = db.days[date]
  if (d) d.achieved = (d.achieved ?? []).filter((id) => id !== taskId)
  commit()
}
/** Mueve `id` a la posición `to` dentro de la lista (se acota a los extremos). */
const reorder = (list: string[], id: string, to: number) => {
  const rest = list.filter((x) => x !== id)
  if (rest.length === list.length) return list
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, id)
  return rest
}
export function moveInPlan(date: string, group: PlanGroup, taskId: string, to: number) {
  const d = db.days[date]
  if (!d?.plan?.[group]) return
  d.plan[group] = reorder(d.plan[group]!, taskId, to)
  commit()
}
export function moveInAchieved(date: string, taskId: string, to: number) {
  const d = db.days[date]
  if (!d?.achieved) return
  d.achieved = reorder(d.achieved, taskId, to)
  commit()
}
/* ---------- Reuniones ---------- */
export function addMeeting(date: string): string {
  const now = new Date().toISOString()
  const id = uid()
  db.meetings.unshift({ id, title: '', date, text: '', created: now, updated: now })
  commit()
  return id
}
export function updateMeeting(id: string, patch: Partial<Pick<Meeting, 'title' | 'date' | 'text'>>) {
  const m = db.meetings.find((x) => x.id === id)
  if (!m) return
  Object.assign(m, patch, { updated: new Date().toISOString() })
  commit()
}
export function deleteMeeting(id: string) {
  db.meetings = db.meetings.filter((x) => x.id !== id)
  commit()
}
export function setExtras(date: string, text: string) {
  ensureDay(date).extras = text
  commit()
}
export function setTomorrow(date: string, text: string) {
  ensureDay(date).tomorrow = text
  commit()
}
/** Quita de todos los días las referencias a tareas que dejan de existir. */
function forgetTasks(gone: Set<string>) {
  for (const d of Object.values(db.days)) {
    for (const g of PLAN_GROUPS) if (d.plan?.[g]) d.plan[g] = d.plan[g]!.filter((id) => !gone.has(id))
    if (d.achieved) d.achieved = d.achieved.filter((id) => !gone.has(id))
  }
}
export function dayReport(date: string) {
  const d = db.days[date] || {}
  const list = (ts: Task[]) => (ts.length ? ts.map((t) => `\n  - ${crumb(t)}${t.status === 'hecha' ? ' ✓' : ''}`).join('') : ' -')
  const plan = PLAN_GROUPS.map((g) => `${PLAN_LABELS[g]}:${list(tasksOf(d.plan?.[g]))}`).join('\n')
  return `FARO · ${date}\n${plan}\nLogrado:${list(tasksOf(d.achieved))}${d.extras?.trim() ? `\nOtros trabajos: ${d.extras.trim()}` : ''}\nPara mañana: ${d.tomorrow?.trim() || '-'}`
}

/* ---------- Acciones: semana ---------- */
export function setWeekField(date: string, key: WeekField, value: string) {
  const k = weekStart(date)
  db.weeks[k] = { ...(db.weeks[k] || {}), [key]: value }
  commit()
}
export function weekReport(date: string) {
  const k = weekStart(date),
    w = db.weeks[k] || {}
  return `FARO · Semana del ${k}\nConcretado: ${w.weekDone || '-'}\nRiesgos: ${w.weekRisks || '-'}\nSiguiente prioridad: ${w.weekNext || '-'}`
}

/* ---------- Acciones: frentes ---------- */
function newFront(name: string): Front {
  const taken = new Set(db.fronts.map((f) => f.slug)),
    base = slugify(name)
  let slug = base,
    n = 2
  while (taken.has(slug)) slug = `${base}-${n++}`
  const f = { id: uid(), name, slug }
  db.fronts.push(f)
  return f
}
export function addFront(name: string) {
  newFront(name)
  commit()
}
export function renameFront(id: string, name: string) {
  const f = db.fronts.find((x) => x.id === id)
  if (f) f.name = name // el slug no cambia: es el nombre de la carpeta docs/ en los repositorios
  commit()
}
/** Qué se llevaría por delante eliminar un frente (para avisar antes de confirmar). */
export function frontRemovalImpact(id: string) {
  return { tasks: db.tasks.filter((t) => t.frontId === id).length, decisions: db.decisions.filter((d) => d.frontId === id).length }
}
/** Elimina el frente con todas sus tareas; sus decisiones pasan a «General». Devuelve un error si no se puede. */
export function removeFront(id: string): string | null {
  const f = db.fronts.find((x) => x.id === id)
  if (!f) return null
  if (f.slug === GENERAL_SLUG) return 'El frente «General» no se puede eliminar'
  const general = generalFront()
  forgetTasks(new Set(db.tasks.filter((t) => t.frontId === id).map((t) => t.id)))
  db.tasks = db.tasks.filter((t) => t.frontId !== id)
  db.decisions.forEach((d) => {
    if (d.frontId === id) {
      d.frontId = general.id
      d.taskId = null
    }
  })
  db.links = db.links.filter((l) => l.frontId !== id)
  db.fronts = db.fronts.filter((x) => x.id !== id)
  commit()
  return null
}

/* ---------- Acciones: tareas (árbol) ---------- */
const siblings = (t: { parentId: string | null; frontId: string }) => childrenOf(t.parentId, t.frontId)
const renumber = (list: Task[]) => list.forEach((t, i) => (t.order = i))
const blankTask = (frontId: string, parentId: string | null, title: string): Task => ({
  id: uid(), kind: 'tarea', frontId, parentId, order: 0, title, status: 'pendiente', note: '', collapsed: false, projectId: null,
  decisionId: null, needsReview: false, verify: null, created: iso(), doneAt: null,
})
/** Sella el día en que una tarea pasa a «hecha» (y lo borra si deja de estarlo). */
const stampDone = (t: Task, status: TaskStatus) => {
  if (status !== 'hecha') t.doneAt = null
  else if (t.status !== 'hecha') t.doneAt = iso()
}

/** Añade una tarea como hija de `parentId` (o de primer nivel), justo después de `afterId` si se indica. Devuelve su id. */
export function addTask(frontId: string, parentId: string | null, title = '', afterId?: string): string {
  const node = blankTask(frontId, parentId, title)
  const list = childrenOf(parentId, frontId)
  const at = afterId ? list.findIndex((t) => t.id === afterId) : -1
  list.splice(at >= 0 ? at + 1 : list.length, 0, node)
  db.tasks.push(node)
  renumber(list)
  const parent = taskById(parentId)
  if (parent) parent.collapsed = false
  commit()
  return node.id
}
export function setTaskTitle(id: string, title: string) {
  const t = taskById(id)
  if (t) t.title = title
  commit()
}
/** Convierte una tarea en línea de texto (o al revés). Sus subtareas no se tocan. */
export function setTaskKind(id: string, kind: TaskKind) {
  const t = taskById(id)
  if (!t || t.kind === kind) return
  if (kind === 'texto') {
    t.status = 'pendiente'
    t.doneAt = null
    t.verify = null
    t.decisionId = null
    t.needsReview = false
    forgetTasks(new Set([id]))
  }
  t.kind = kind
  commit()
}
/** ¿Perdería algo al pasar a texto? (verificación, duda ligada o estado avanzado) */
export const textLoss = (t: Task) => !!t.verify || !!t.decisionId || t.status !== 'pendiente'
export function setTaskNote(id: string, note: string) {
  const t = taskById(id)
  if (t) t.note = note
  commit()
}
export function toggleCollapsed(id: string) {
  const t = taskById(id)
  if (t) t.collapsed = !t.collapsed
  commit()
}
export function setTaskProject(id: string, projectId: string | null) {
  const t = taskById(id)
  if (!t) return
  t.projectId = projectId
  const eff = effectiveProjectId(t)
  if (eff) ensureLink(eff, t.frontId)
  commit()
}

/** Cambia el estado. Si deja de estar «hecha», pierde la verificación que tuviera. */
export function setTaskStatus(id: string, status: TaskStatus) {
  const t = taskById(id)
  if (!t) return
  stampDone(t, status)
  t.status = status
  if (status !== 'hecha' && t.verify) {
    t.verify.verification = 'ninguna'
    t.verify.verifiedAt = null
    t.verify.acceptedAt = null
  }
  commit()
}
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { pendiente: 'curso', curso: 'hecha', hecha: 'pendiente', bloqueada: 'pendiente', cancelada: 'pendiente' }
/** Un clic: pendiente → en curso → hecha → pendiente. */
export function cycleStatus(id: string) {
  const t = taskById(id)
  if (t) setTaskStatus(id, NEXT_STATUS[t.status])
}
/** Aplica un estado a la tarea y a todas sus subtareas (p. ej. «marcar todo como hecho»). */
export function setSubtreeStatus(id: string, status: TaskStatus) {
  const t = taskById(id)
  if (!t) return
  for (const n of [t, ...descendantsOf(id)]) {
    stampDone(n, status)
    n.status = status
    if (status !== 'hecha' && n.verify) Object.assign(n.verify, { verification: 'ninguna', verifiedAt: null, acceptedAt: null })
  }
  commit()
}

/* Estructura: sangrar, subir de nivel, mover y eliminar */
/** Tab: la tarea pasa a ser la última subtarea de su hermana anterior. */
export function indentTask(id: string): boolean {
  const t = taskById(id)
  if (!t) return false
  const list = siblings(t)
  const i = list.findIndex((x) => x.id === id)
  if (i <= 0) return false
  const newParent = list[i - 1]
  list.splice(i, 1)
  renumber(list)
  t.parentId = newParent.id
  newParent.collapsed = false
  t.order = childrenOf(newParent.id, t.frontId).filter((x) => x.id !== id).length
  commit()
  return true
}
/** Mayús+Tab: la tarea pasa a ser hermana de su padre, justo después de él. */
export function outdentTask(id: string): boolean {
  const t = taskById(id)
  const parent = taskById(t?.parentId)
  if (!t || !parent) return false
  renumber(siblings(t).filter((x) => x.id !== id))
  const target = childrenOf(parent.parentId, t.frontId).filter((x) => x.id !== id)
  target.splice(target.findIndex((x) => x.id === parent.id) + 1, 0, t)
  t.parentId = parent.parentId
  renumber(target)
  commit()
  return true
}
/** Alt+↑ / Alt+↓: intercambia posición con su hermana anterior o siguiente. */
export function moveTask(id: string, dir: -1 | 1): boolean {
  const t = taskById(id)
  if (!t) return false
  const list = siblings(t)
  const i = list.findIndex((x) => x.id === id),
    j = i + dir
  if (j < 0 || j >= list.length) return false
  ;[list[i], list[j]] = [list[j], list[i]]
  renumber(list)
  commit()
  return true
}
/** Elimina la tarea con todas sus subtareas. Devuelve cuántas se eliminaron. */
export function removeTask(id: string): number {
  const t = taskById(id)
  if (!t) return 0
  const gone = new Set([id, ...descendantsOf(id).map((d) => d.id)])
  db.tasks = db.tasks.filter((x) => !gone.has(x.id))
  forgetTasks(gone)
  db.decisions.forEach((d) => {
    if (d.taskId && gone.has(d.taskId)) d.taskId = null
  })
  renumber(siblings(t))
  commit()
  return gone.size
}

/* Verificable (opcional) */
const blankVerify = (): Verify => ({ scope: 'candidato', priority: 'media', verification: 'ninguna', evidence: '', checks: {}, verifiedAt: null, acceptedAt: null })
export function setVerifiable(id: string, on: boolean) {
  const t = taskById(id)
  if (!t) return
  t.verify = on ? (t.verify ?? blankVerify()) : null
  commit()
}
export function updateVerify<K extends keyof Verify>(id: string, field: K, value: Verify[K]) {
  const t = taskById(id)
  if (!t?.verify) return
  t.verify[field] = value
  commit()
}
/** Verificar implica que la tarea está hecha; quitar la verificación no la reabre. */
export function setVerification(id: string, verification: Verification) {
  const t = taskById(id)
  if (!t?.verify) return
  const v = t.verify
  v.verification = verification
  if (verification !== 'ninguna') {
    stampDone(t, 'hecha')
    t.status = 'hecha'
    v.verifiedAt = v.verifiedAt ?? iso()
  } else v.verifiedAt = null
  v.acceptedAt = verification === 'aceptado' ? (v.acceptedAt ?? iso()) : null
  commit()
}
export function setCheck(id: string, key: string, on: boolean) {
  const t = taskById(id)
  if (!t?.verify) return
  t.verify.checks = { ...t.verify.checks, [key]: on }
  commit()
}
export function markReviewed(id: string) {
  const t = taskById(id)
  if (t) t.needsReview = false
  commit()
}
export function linkTaskDecision(id: string, decisionId: string | null) {
  const t = taskById(id)
  if (t) t.decisionId = decisionId
  commit()
}

/* ---------- Acciones: repositorios y vínculos ---------- */
/** Crea el vínculo repositorio × frente si todavía no existe (se crea al registrar algo de ese par). */
function ensureLink(projectId: string | null | undefined, frontId: string | undefined) {
  if (!projectId || !frontId) return
  if (!db.links.some((l) => l.projectId === projectId && l.frontId === frontId)) db.links.push({ id: uid(), projectId, frontId })
}
export function addProject(name: string, path: string): string | null {
  if (db.projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'Ya existe un repositorio con ese nombre'
  db.projects.push({ id: uid(), name, path })
  commit()
  return null
}
export function updateProject(id: string, name: string, path: string): string | null {
  if (db.projects.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) return 'Ya existe un repositorio con ese nombre'
  const p = projectOf(id)
  if (p) {
    p.name = name
    p.path = path
  }
  commit()
  return null
}
/** Devuelve un mensaje de error si no se puede eliminar. */
export function removeProject(id: string): string | null {
  if (db.tasks.some((t) => t.projectId === id) || db.decisions.some((d) => d.projectIds.includes(id)))
    return 'Tiene tareas o decisiones: reasígnalas primero'
  db.projects = db.projects.filter((p) => p.id !== id)
  db.links = db.links.filter((l) => l.projectId !== id)
  commit()
  return null
}
export function addLink(projectId: string, frontId: string) {
  ensureLink(projectId, frontId)
  commit()
}
export function removeLink(id: string): string | null {
  const l = db.links.find((x) => x.id === id)
  if (!l) return null
  if (linkInUse(l)) return 'Hay tareas o decisiones de ese frente en el repositorio'
  db.links = db.links.filter((x) => x.id !== id)
  commit()
  return null
}

/* ---------- Acciones: decisiones ---------- */
const stamp = () => new Date().toISOString()
const logTo = (d: Decision, state: DecisionState, note?: string) => d.log.push({ at: stamp(), state, ...(note ? { note } : {}) })
const openState = (assumption: string): DecisionState => (assumption.trim() ? 'en_supuesto' : 'abierta')
function linkDecision(d: Decision) {
  d.projectIds.forEach((pid) => ensureLink(pid, d.frontId))
}

export type NewDecision = Pick<Decision, 'question' | 'assumption' | 'impact' | 'projectIds'> & { context?: string; frontId?: string; taskId?: string | null }
/**
 * Registra una duda. Si se indica `taskId`, hereda su frente y su repositorio cuando no se dan, y la tarea queda
 * esperando esa decisión (si ya esperaba otra, solo se reemplaza con `force`).
 */
export function addDecision(n: NewDecision, force = false) {
  const id = uid()
  db.counters.decision = (db.counters.decision || 0) + 1
  const task = taskById(n.taskId)
  const assumption = n.assumption.trim()
  const state = openState(assumption)
  const eff = task ? effectiveProjectId(task) : null
  const d: Decision = {
    id, code: decisionCode(db.counters.decision), question: n.question.trim(), context: (n.context ?? '').trim(), assumption, impact: n.impact, state, outcome: null,
    resolution: '', created: iso(),
    frontId: n.frontId || task?.frontId || generalFront().id,
    taskId: task?.id ?? null,
    projectIds: n.projectIds.length ? n.projectIds : eff ? [eff] : [],
    log: [{ at: stamp(), state, note: 'Registrada' }],
  }
  db.decisions.unshift(d)
  if (task && (force || !task.decisionId)) task.decisionId = id
  linkDecision(d)
  commit()
  return id
}
/** Cambia el alcance de una decisión: su frente, su tarea (opcional) y los repositorios afectados (el primero es el principal). */
export function setDecisionScope(id: string, frontId: string, taskId: string | null, projectIds: string[]) {
  const d = db.decisions.find((x) => x.id === id)
  if (!d) return
  d.frontId = frontId
  d.taskId = taskId && db.tasks.some((t) => t.id === taskId && t.frontId === frontId) ? taskId : null
  d.projectIds = projectIds
  linkDecision(d)
  commit()
}
/** Reescribe la pregunta (no puede quedar vacía). No cambia el estado; queda anotado en el historial. */
export function setQuestion(id: string, text: string) {
  const d = db.decisions.find((x) => x.id === id)
  const next = text.trim()
  if (!d || !next || next === d.question) return
  d.question = next
  logTo(d, d.state, 'Pregunta editada')
  commit()
}
/** Escribe o borra el contexto de la pregunta (puede quedar vacío). */
export function setContext(id: string, text: string) {
  const d = db.decisions.find((x) => x.id === id)
  const next = text.trim()
  if (!d || next === (d.context ?? '')) return
  d.context = next
  logTo(d, d.state, next ? 'Contexto editado' : 'Contexto retirado')
  commit()
}
export function setImpact(id: string, impact: Impact) {
  const d = db.decisions.find((x) => x.id === id)
  if (!d || d.impact === impact) return
  logTo(d, d.state, `Impacto: ${d.impact} → ${impact}`)
  d.impact = impact
  commit()
}
/** Define, edita o retira el supuesto provisional; mueve la decisión entre «abierta» y «en supuesto». */
export function setAssumption(id: string, text: string) {
  const d = db.decisions.find((x) => x.id === id)
  if (!d || d.state === 'resuelta') return
  const next = text.trim()
  if (next === d.assumption) return
  d.assumption = next
  const state = openState(next)
  logTo(d, state, state === d.state ? 'Supuesto editado' : next ? 'Supuesto definido' : 'Supuesto retirado')
  d.state = state
  commit()
}
/**
 * Resuelve la decisión. Si venía «en supuesto» hay que indicar si el PO lo confirmó o lo cambió;
 * al cambiarlo, las tareas ligadas que ya se construyeron sobre él quedan «requieren revisión».
 */
export function resolveDecision(id: string, resolution: string, outcome: Outcome | null) {
  const d = db.decisions.find((x) => x.id === id)
  if (!d) return { unblocked: 0, flagged: 0 }
  const assumed = d.state === 'en_supuesto'
  d.resolution = resolution
  d.state = 'resuelta'
  d.outcome = assumed ? outcome : null
  logTo(d, 'resuelta', d.outcome ? OUTCOMES[d.outcome] : undefined)
  let flagged = 0
  if (d.outcome === 'cambia')
    for (const t of db.tasks)
      if (t.decisionId === id && ['curso', 'hecha'].includes(t.status)) {
        t.needsReview = true
        flagged++
      }
  commit()
  return { unblocked: db.tasks.filter((t) => t.decisionId === id && t.status === 'bloqueada').length, flagged }
}
export function reopenDecision(id: string) {
  const d = db.decisions.find((x) => x.id === id)
  if (!d) return
  d.state = openState(d.assumption)
  d.outcome = null
  logTo(d, d.state, 'Reabierta')
  commit()
}
export function removeDecision(id: string) {
  db.tasks.forEach((t) => {
    if (t.decisionId === id) t.decisionId = null
  })
  db.decisions = db.decisions.filter((x) => x.id !== id)
  commit()
}

/* ---------- Importar un esquema de texto ---------- */
export type ImportSummary = { fronts: number; created: number; reused: number; decisions: number }
/**
 * Vuelca lo que devolvió `parseOutline`. Si ya existe una tarea con el mismo título bajo el mismo padre se reutiliza
 * (así importar dos veces no duplica). Una sola escritura al final.
 */
export function importOutline(groups: OutlineGroup[], defaultFrontId: string, questionsToDecisions: boolean, targets: string[] = []): ImportSummary {
  const sum: ImportSummary = { fronts: 0, created: 0, reused: 0, decisions: 0 }
  for (const [gi, g] of groups.entries()) {
    let found: Front | undefined
    let front: Front
    if (targets[gi] && frontById(targets[gi])) found = frontById(targets[gi]) // el usuario lo asignó a un frente existente
    if (found) front = found
    else if (g.front) {
      const key = normText(g.front)
      let byName = db.fronts.find((f) => normText(f.name) === key || f.slug === slugify(g.front!))
      if (!byName) {
        byName = newFront(g.front)
        sum.fronts++
      }
      front = byName
    } else front = frontById(defaultFrontId) ?? generalFront()
    const stack: Task[] = [] // stack[d] = última tarea creada o reutilizada a profundidad d
    for (const n of g.nodes) {
      const depth = Math.min(n.depth, stack.length)
      const parent = depth > 0 ? stack[depth - 1] : null
      const list = childrenOf(parent?.id ?? null, front.id)
      let task = list.find((t) => normText(t.title) === normText(n.title))
      if (task) sum.reused++
      else {
        task = blankTask(front.id, parent?.id ?? null, n.title)
        task.status = n.status
        task.order = list.length
        db.tasks.push(task)
        sum.created++
        if (questionsToDecisions && n.question) {
          db.counters.decision = (db.counters.decision || 0) + 1
          const d: Decision = {
            id: uid(), code: decisionCode(db.counters.decision), question: n.title, context: '', assumption: '', impact: 'medio', state: 'abierta', outcome: null,
            resolution: '', created: iso(), frontId: front.id, taskId: task.id, projectIds: [], log: [{ at: stamp(), state: 'abierta', note: 'Registrada al importar' }],
          }
          db.decisions.unshift(d)
          task.decisionId = d.id
          sum.decisions++
        }
      }
      stack.length = depth
      stack[depth] = task
    }
  }
  commit()
  return sum
}

/* ---------- Copia de seguridad ---------- */
export function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = 'faro-respaldo-' + iso() + '.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
/** Lee y revisa un respaldo (v2 a v11); lanza Error con un mensaje legible. La migración la hace el servidor. */
export async function readBackup(file: File): Promise<unknown> {
  const data = JSON.parse(await file.text())
  const ok =
    data && [2, 3, 4, 5, 6, 7, 8, 9, 10].includes(data.v) &&
    ['fronts', 'tasks', 'decisions'].every((k) => Array.isArray(data[k])) && (data.v >= 6 || Array.isArray(data.verifiables) || Array.isArray(data.caps)) &&
    typeof data.days === 'object' && typeof data.weeks === 'object'
  if (!ok)
    throw Error(
      data && data.tasks && !data.fronts
        ? 'Es una copia de la versión 1 y no es compatible con esta versión.'
        : 'Formato no válido',
    )
  return data
}
/** Reemplaza los datos del servidor por el respaldo (el servidor guarda antes una copia de lo que había). */
export async function importBackup(data: unknown) {
  const { status, body } = await api<Remote & { error?: string }>('/api/import', { method: 'POST', body: JSON.stringify(data) })
  if (status !== 200) throw new Error(body.error || 'No se pudo importar')
  apply(body)
  emit({ file, save: { kind: 'ok', at: new Date() } })
}
