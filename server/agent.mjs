// API para agentes de IA: contexto, consulta y registro de decisiones. Lógica pura sobre la base (sin I/O).
// Vocabulario: `repository` = repositorio (en los datos, `projects`); `front` = frente; `task` = tarea o subtarea de un frente
// (en los datos, `tasks` es un árbol plano: `parentId` + `order`).
import { decisionCode } from './migrate.mjs'

export class AgentError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

const IMPACTS = ['alto', 'medio', 'bajo']
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
const str = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/* ---------- Búsquedas ---------- */
const findRepo = (db, ref) => db.projects.find((p) => p.id === ref || norm(p.name) === norm(ref))
const findFront = (db, ref) => db.fronts.find((f) => f.id === ref || f.slug === norm(ref) || norm(f.name) === norm(ref))
const frontOptions = (fronts) => fronts.map((f) => ({ front: f.name, frontSlug: f.slug }))
const repoOptions = (db) => db.projects.map((p) => p.name)

const NO_REPO = (db, ref) =>
  new AgentError(422, `No existe el repositorio «${ref}» en FARO.`, { options: repoOptions(db), hint: 'Pide al usuario que lo cree en FARO > Repositorios.' })

/* ---------- Árbol de tareas ---------- */
const SEP = /\s*[›»]\s*|\s+>\s+|\s*\/\s*/
const pathOf = (db, t) => {
  const out = []
  for (let n = t, guard = 0; n && guard < 100; n = db.tasks.find((x) => x.id === n.parentId), guard++) out.unshift(n.title)
  return out
}
/** Rutas de las tareas de un frente hasta cierta profundidad (para ofrecer opciones sin volcar todo el árbol). */
const taskPaths = (db, frontId, maxDepth = 2, limit = 40) =>
  db.tasks
    .filter((t) => t.frontId === frontId && t.kind !== 'texto')
    .map((t) => pathOf(db, t))
    .filter((p) => p.length <= maxDepth)
    .map((p) => p.join(' › '))
    .slice(0, limit)

/* ---------- Presentación ---------- */
function summary(db, d) {
  const front = db.fronts.find((f) => f.id === d.frontId)
  const task = db.tasks.find((t) => t.id === d.taskId)
  return {
    code: d.code,
    question: d.question,
    state: d.state,
    impact: d.impact,
    context: d.context || null,
    assumption: d.assumption || null,
    resolution: d.resolution || null,
    outcome: d.outcome ?? null,
    front: front ? { name: front.name, slug: front.slug, docs: `docs/${front.slug}/` } : null,
    task: task ? pathOf(db, task).join(' › ') : null,
    repositories: d.projectIds.map((id) => db.projects.find((p) => p.id === id)?.name).filter(Boolean),
    // tareas que se construyeron sobre un supuesto que el PO cambió y siguen sin revisar
    requiresReview: db.tasks.filter((t) => t.decisionId === d.id && t.needsReview).map((t) => ({ id: t.id, title: t.title })),
    origin: d.origin ?? null,
  }
}

/* ---------- Contexto ---------- */
export function context(db, { repository }) {
  const out = {
    app: 'FARO',
    fronts: db.fronts.map((f) => ({
      name: f.name,
      slug: f.slug,
      docs: `docs/${f.slug}/`,
      tasks: db.tasks.filter((t) => t.frontId === f.id && !t.parentId && t.kind !== 'texto').map((t) => t.title),
    })),
    repositories: db.projects.map((p) => ({
      name: p.name,
      path: p.path,
      fronts: db.links.filter((l) => l.projectId === p.id).map((l) => db.fronts.find((f) => f.id === l.frontId)?.slug).filter(Boolean),
    })),
    impacts: IMPACTS,
    states: ['abierta', 'en_supuesto', 'resuelta'],
  }
  if (repository) {
    const p = findRepo(db, repository)
    if (!p) throw NO_REPO(db, repository)
    out.repository = out.repositories.find((x) => x.name === p.name)
  }
  return out
}

/* ---------- Consulta ---------- */
export function queryDecisions(db, { repository, front, state }) {
  let pool = db.decisions
  if (repository) {
    const p = findRepo(db, repository)
    if (!p) throw NO_REPO(db, repository)
    pool = pool.filter((d) => d.projectIds.includes(p.id))
  }
  if (front) {
    const f = findFront(db, front)
    if (!f) throw new AgentError(422, `No existe el frente «${front}» en FARO.`, { options: db.fronts.map((x) => x.slug) })
    pool = pool.filter((d) => d.frontId === f.id)
  }
  const s = norm(state)
  if (s && !['vigentes', 'todas', 'abierta', 'en_supuesto', 'resuelta'].includes(s))
    throw new AgentError(400, `«state» no es válido: ${state}`, { options: ['vigentes', 'todas', 'abierta', 'en_supuesto', 'resuelta'] })
  const items = pool
    .map((d) => summary(db, d))
    .filter((d) => {
      if (s === 'todas') return true
      if (s === 'abierta' || s === 'en_supuesto' || s === 'resuelta') return d.state === s
      // por defecto: lo vigente = abiertas, en supuesto y las cambiadas por el PO con trabajo aún sin revisar
      return d.state !== 'resuelta' || d.requiresReview.length > 0
    })
  return { count: items.length, decisions: items }
}

/* ---------- Registro ---------- */
/** El frente se indica o se infiere del repositorio (si está vinculado a uno solo); si no, se pide aclararlo. */
function resolveFront(db, repo, frontRef) {
  if (frontRef) {
    const f = findFront(db, frontRef)
    if (f) return f
    throw new AgentError(422, `No existe el frente «${frontRef}» en FARO.`, { options: frontOptions(db.fronts), hint: 'Elige un frente de la lista o pregunta al usuario.' })
  }
  const linked = db.links.filter((l) => l.projectId === repo.id).map((l) => db.fronts.find((f) => f.id === l.frontId)).filter(Boolean)
  if (linked.length === 1) return linked[0]
  throw new AgentError(422, 'Indica el frente.', {
    options: frontOptions(linked.length ? linked : db.fronts),
    hint: linked.length ? 'El repositorio trabaja en varios frentes: elige uno.' : 'El repositorio aún no está vinculado a ningún frente.',
  })
}

/**
 * La tarea es opcional; si se indica debe existir en ese frente. Acepta su id, su título o una ruta «Padre › Hija»
 * (basta con el final de la ruta). Si varias coinciden, se pide precisar con la ruta completa.
 */
function resolveTask(db, front, taskRef) {
  if (!taskRef) return null
  // Las líneas de texto son documentación, no tareas: no se puede ligar una decisión a ellas.
  const inFront = db.tasks.filter((t) => t.frontId === front.id && t.kind !== 'texto')
  const byId = inFront.find((t) => t.id === taskRef)
  if (byId) return byId
  const wanted = String(taskRef).split(SEP).map(norm).filter(Boolean)
  const matches = inFront.filter((t) => {
    const path = pathOf(db, t).map(norm)
    if (path.length < wanted.length) return false
    return wanted.every((w, i) => path[path.length - wanted.length + i] === w)
  })
  if (matches.length === 1) return matches[0]
  if (matches.length > 1)
    throw new AgentError(422, `Hay varias tareas llamadas «${taskRef}» en «${front.name}»: indica la ruta completa («Padre › Hija»).`, {
      options: matches.map((t) => pathOf(db, t).join(' › ')),
    })
  throw new AgentError(422, `No existe la tarea «${taskRef}» en el frente «${front.name}».`, {
    options: taskPaths(db, front.id),
    hint: 'Elige una tarea de la lista, omite «task», o pide al usuario que la cree en FARO > Frentes.',
  })
}

/** Registra una decisión propuesta por un agente. Los agentes proponen; resolver es de la persona, en FARO. */
export function registerDecision(db, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AgentError(400, 'Se esperaba un objeto JSON.')
  // «project» y «capability» son los nombres anteriores de «repository» y «task»: se siguen aceptando.
  const repoRef = body.repository ?? body.project
  const taskRef = body.task ?? body.capability
  const otherRefs = body.other_repositories ?? body.other_projects

  const question = str(body.question, 2000)
  if (!question) throw new AgentError(400, 'Falta «question»: la pregunta de negocio, concreta.', { field: 'question' })
  const impact = body.impact == null ? 'medio' : norm(body.impact)
  if (!IMPACTS.includes(impact)) throw new AgentError(400, '«impact» debe ser alto, medio o bajo.', { field: 'impact', options: IMPACTS })
  if (!repoRef) throw new AgentError(422, 'Falta «repository»: el nombre del repositorio en FARO.', { options: repoOptions(db) })
  const repo = findRepo(db, String(repoRef))
  if (!repo) throw NO_REPO(db, repoRef)

  const others = []
  for (const ref of Array.isArray(otherRefs) ? otherRefs : []) {
    const p = findRepo(db, String(ref))
    if (!p) throw new AgentError(422, `No existe el repositorio «${ref}» (other_repositories).`, { options: repoOptions(db) })
    if (p.id !== repo.id && !others.includes(p.id)) others.push(p.id)
  }

  const assumption = str(body.assumption, 2000)
  const ctxText = str(body.context, 4000)
  const key = str(body.key, 200) || null
  const origin = str(body.origin, 60) || null

  // Anti-duplicados: la misma clave, o la misma pregunta abierta en el mismo repositorio principal.
  const dup = db.decisions.find(
    (d) => (key && d.key === key) || (!key && d.state !== 'resuelta' && d.projectIds[0] === repo.id && norm(d.question) === norm(question)),
  )
  if (dup) return { changed: false, status: 200, body: { duplicate: true, ...summary(db, dup) } }

  const front = resolveFront(db, repo, body.front ? String(body.front) : '')
  const task = resolveTask(db, front, taskRef ? String(taskRef) : '')
  const state = assumption ? 'en_supuesto' : 'abierta'
  const at = new Date().toISOString()

  db.counters.decision = (db.counters.decision || 0) + 1
  const d = {
    id: newId(),
    code: decisionCode(db.counters.decision),
    question,
    context: ctxText,
    assumption,
    impact,
    state,
    outcome: null,
    resolution: '',
    created: at.slice(0, 10),
    frontId: front.id,
    taskId: task?.id ?? null,
    projectIds: [repo.id, ...others],
    log: [{ at, state, note: origin ? `Registrada por ${origin}` : 'Registrada por un agente' }],
    ...(key ? { key } : {}),
    ...(origin ? { origin } : {}),
  }
  db.decisions.unshift(d)
  // el vínculo repositorio × frente nace al registrar algo de ese par
  for (const pid of d.projectIds) if (!db.links.some((l) => l.projectId === pid && l.frontId === front.id)) db.links.push({ id: newId(), projectId: pid, frontId: front.id })
  return { changed: true, status: 201, body: { duplicate: false, ...summary(db, d) } }
}

/* ---------- Instrucciones para pegar en AGENTS.md ---------- */
export function instructions(db, { repository, base }) {
  const repo = repository ? findRepo(db, repository) : null
  const name = repo ? repo.name : '<REPOSITORIO>'
  const fronts = repo ? db.links.filter((l) => l.projectId === repo.id).map((l) => db.fronts.find((f) => f.id === l.frontId)).filter(Boolean) : []
  const frontsLine = fronts.length
    ? fronts.map((f) => `\`${f.slug}\` (docs/${f.slug}/)`).join(', ')
    : 'consúltalos en `GET ' + base + '/api/agent/context?repository=' + name + '`'
  const exampleFront = fronts.length === 1 ? fronts[0].slug : '<slug-del-frente>'
  return `<!-- faro:inicio · bloque generado por FARO (GET /api/agent/instructions). Para actualizarlo, reemplaza todo hasta faro:fin. -->
## FARO: decisiones y supuestos

FARO es la fuente de verdad de las decisiones de negocio y corre en ${base}.
Repositorio en FARO: \`${name}\`. Frentes vinculados: ${frontsLine}.

### Antes de desarrollar
1. Consulta lo vigente: \`GET ${base}/api/agent/decisions?repository=${name}&front=<slug-del-frente>\`
   - Respeta los supuestos con \`state: "en_supuesto"\`.
   - Si una decisión trae \`requiresReview\`, el PO cambió el supuesto: corrige primero ese código.
2. Lee \`docs/<slug-del-frente>/index.md\` y \`progreso.md\` si existen.
   Los slugs válidos salen de \`GET ${base}/api/agent/context?repository=${name}\`.

### Al asumir algo de negocio
Si una regla de negocio no está definida y avanzas con un supuesto provisional, regístralo:

\`POST ${base}/api/agent/decisions\` con \`Content-Type: application/json\`:

\`\`\`json
{
  "repository": "${name}",
  "front": "${exampleFront}",
  "task": "<tarea o ruta «Padre › Hija», opcional>",
  "question": "¿Puede anularse una factura con pago parcial?",
  "context": "<opcional: qué caso originó la duda, qué opciones ves y qué pasa si no se responde>",
  "assumption": "No permitir anulación hasta definir el tratamiento del pago",
  "impact": "alto",
  "origin": "<tu nombre: claude, codex...>",
  "key": "<texto estable que identifique esta duda>"
}
\`\`\`

- 201 = registrada: usa el \`code\` devuelto (p. ej. \`DEC-0007\`). 200 con \`duplicate: true\` = ya existía.
- 422 = ambigua o desconocida: elige una entrada de \`options\` y reintenta; si ninguna aplica, pregunta al usuario.
- \`front\` es obligatorio si el repositorio trabaja en varios frentes (o en ninguno todavía); \`task\` es opcional y puede ser una subtarea («Padre › Hija»).
- \`impact\` es qué tan grave sería equivocarse (dinero, contabilidad, datos, permisos = alto).
- \`context\` es opcional pero ayuda al PO a responder: qué caso originó la duda, qué opciones ves y qué pasaría si no se resuelve.
- Sin \`assumption\` la decisión queda abierta (bloquea); con \`assumption\` queda en supuesto.
- No resuelvas decisiones: las resuelve el usuario en FARO, con el PO.
- El cuerpo debe ir en **UTF-8**; si no, FARO responde 400 en vez de guardar acentos rotos. En Windows guarda el JSON en un archivo UTF-8 y usa \`curl.exe --data-binary @archivo.json\`; con PowerShell 5.1 envía bytes UTF-8 (\`-Body ([Text.Encoding]::UTF8.GetBytes($json))\`).

### En el código y los docs
- Menciona la decisión solo por su código (\`DEC-0007\`); nunca copies su estado.
- \`docs/<slug>/progreso.md\` es tu bitácora de desarrollo (retomar trabajo, cambiar de agente); no afirmes ahí qué está verificado.

### Si FARO está apagado (conexión rechazada)
Avisa al usuario de inmediato. Anota en \`docs/<slug>/progreso.md\` una línea
\`Pendiente de registrar en FARO: <pregunta> | supuesto: <supuesto>\` y continúa; el usuario la registrará.
Si se desarrolla a mano, la decisión también se registra a mano en FARO.
<!-- faro:fin -->
`
}
