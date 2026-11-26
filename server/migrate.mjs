// Esquema de datos de FARO y cadena de migraciones. Cada paso lleva la base de v(n) a v(n+1).

export const CURRENT = 11

/*
 * Vocabulario (v11). Estructura: Frente → árbol de tareas (profundidad libre).
 *   - `fronts`    frentes de trabajo (Contabilidad, ERP en Efactura, General…). «General» agrupa tareas sueltas.
 *   - `tasks`     todas las tareas y subtareas, en una lista plana: `parentId` (null = primer nivel del frente) y
 *                 `order` (posición entre hermanas) forman el árbol. Una tarea puede ser «verificable» (`verify` ≠ null):
 *                 entonces lleva criterios, verificación técnica y aceptación del PO. Con `kind: 'texto'` el ítem es una
 *                 simple línea de texto (documentación): sin estado, no cuenta en el avance ni se planea.
 *   - `projects`  repositorios (en la interfaz se llaman «Repositorios»).
 *   - `days`      por fecha: `plan` (ids de tareas por grupo: primary | secondary), `achieved` (ids de tareas del
 *                 cierre) y `tomorrow` (nota para el día siguiente) y `extras` (otros trabajos del día). Cada tarea guarda `doneAt`: el día que se marcó hecha.
 *   - `meetings`  historial de reuniones: `title`, `date`, `text` (notas libres) y marcas de creación y edición.
 */
export const GENERAL_SLUG = 'general'

/** Los frentes con los que arranca una instalación nueva. «General» siempre existe. */
export const seedFronts = () => [
  { id: 'f_general', name: 'General', slug: GENERAL_SLUG },
  { id: 'f_contabilidad', name: 'Contabilidad', slug: 'contabilidad' },
  { id: 'f_erp', name: 'ERP en Efactura', slug: 'erp-en-efactura' },
]

export const fresh = () => ({
  v: CURRENT,
  fronts: seedFronts(),
  tasks: [],
  decisions: [],
  projects: [],
  links: [],
  counters: { decision: 0 },
  days: {},
  weeks: {},
  meetings: [],
})

/** Nombre → identificador de carpeta: minúsculas, sin tildes, guiones. */
export function slugify(name) {
  return (
    String(name ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'frente'
  )
}

export function uniqueSlug(name, taken) {
  const base = slugify(name)
  let slug = base,
    n = 2
  while (taken.has(slug)) slug = `${base}-${n++}`
  return slug
}

export const decisionCode = (n) => `DEC-${String(n).padStart(4, '0')}`

const steps = {
  // v2 → v3: slug en frentes, proyectos y vínculos vacíos, código legible en decisiones.
  2(db) {
    const taken = new Set()
    const fronts = db.fronts.map((f) => {
      const slug = f.slug && !taken.has(f.slug) ? f.slug : uniqueSlug(f.name, taken)
      taken.add(slug)
      return { ...f, slug }
    })
    // El arreglo guarda lo más nuevo primero: numeramos de la más antigua a la más reciente.
    const decisions = [...db.decisions]
    for (let i = decisions.length - 1, n = 1; i >= 0; i--, n++) decisions[i] = { ...decisions[i], code: decisionCode(n) }
    return { ...db, v: 3, fronts, decisions, projects: [], links: [], counters: { decision: decisions.length } }
  },

  // v3 → v4: ciclo de vida de la decisión (abierta | en_supuesto | resuelta), alcance (capacidad y proyectos),
  // registro de cambios; entregables con proyecto y marca de revisión.
  3(db) {
    const decisions = db.decisions.map((d) => {
      const state = d.state === 'resuelta' ? 'resuelta' : d.assumption && String(d.assumption).trim() ? 'en_supuesto' : 'abierta'
      const linked = db.tasks.find((t) => t.decisionId === d.id)
      return {
        ...d,
        state,
        outcome: null, // las decisiones ya resueltas no registraron si confirmaron o cambiaron el supuesto
        capId: linked?.capId ?? null,
        projectIds: [],
        log: [{ at: `${d.created || '1970-01-01'}T00:00:00.000Z`, state, note: 'Migrada desde v3' }],
      }
    })
    const tasks = db.tasks.map((t) => ({ projectId: null, needsReview: false, ...t }))
    return { ...db, v: 4, decisions, tasks }
  },

  // v4 → v5: capacidades → tareas, entregables → verificables; las decisiones guardan su frente directamente;
  // aparece el frente «General» (y la instalación sin uso estrena los frentes por defecto).
  4(db) {
    const pristine =
      db.fronts.length === 1 && db.fronts[0].id === 'f_erp' && db.fronts[0].name === 'ERP principal' &&
      db.caps.length === 1 && db.caps[0].id === 'c_fact' &&
      db.tasks.length === 0 && db.decisions.length === 0 && db.projects.length === 0
    const fronts = pristine ? seedFronts() : db.fronts.map((f) => ({ ...f }))
    let general = fronts.find((f) => f.slug === GENERAL_SLUG)
    if (!general) {
      general = { id: 'f_general', name: 'General', slug: uniqueSlug('General', new Set(fronts.map((f) => f.slug))) }
      if (fronts.some((f) => f.id === general.id)) general.id = `f_general_${fronts.length}`
      fronts.unshift(general)
    }
    const caps = pristine ? [] : db.caps
    const frontOfCap = new Map(caps.map((c) => [c.id, c.frontId]))
    const tasks = caps.map((c) => ({ id: c.id, frontId: c.frontId, name: c.name, done: false }))
    const verifiables = db.tasks.map(({ capId, ...v }) => ({ ...v, taskId: capId }))
    const decisions = db.decisions.map(({ capId, ...d }) => ({ ...d, taskId: capId ?? null, frontId: frontOfCap.get(capId) ?? general.id }))
    const { caps: _caps, ...rest } = db
    return { ...rest, v: 5, fronts, tasks, verifiables, decisions }
  },

  // v5 → v6: las tareas pasan a ser un árbol; los verificables se convierten en subtareas marcadas como verificables.
  5(db) {
    const today = new Date().toISOString().slice(0, 10)
    const taskById = new Map(db.tasks.map((t) => [t.id, t]))
    const generalId = (db.fronts.find((f) => f.slug === GENERAL_SLUG) ?? db.fronts[0]).id
    const counters = new Map()
    const nextOrder = (frontId, parentId) => {
      const k = `${frontId}|${parentId ?? ''}`
      const n = counters.get(k) ?? 0
      counters.set(k, n + 1)
      return n
    }
    const node = (o) => ({ note: '', collapsed: false, projectId: null, decisionId: null, needsReview: false, verify: null, created: today, ...o })
    const nodes = db.tasks.map((t) =>
      node({ id: t.id, frontId: t.frontId, parentId: null, order: nextOrder(t.frontId, null), title: t.name, status: t.done ? 'hecha' : 'pendiente' }),
    )
    // estado antiguo del verificable → [estado de la tarea, nivel de verificación]
    const MAP = { lista: ['pendiente', 'ninguna'], curso: ['curso', 'ninguna'], bloqueado: ['bloqueada', 'ninguna'], tecnico: ['hecha', 'tecnico'], po: ['hecha', 'po'], aceptado: ['hecha', 'aceptado'] }
    for (const v of db.verifiables) {
      const parent = taskById.get(v.taskId)
      const [status, verification] = MAP[v.state] ?? ['pendiente', 'ninguna']
      const frontId = parent ? parent.frontId : generalId
      const parentId = parent ? parent.id : null
      nodes.push(
        node({
          id: v.id, frontId, parentId, order: nextOrder(frontId, parentId), title: v.title, status,
          projectId: v.projectId ?? null, decisionId: v.decisionId ?? null, needsReview: !!v.needsReview, created: v.created || today,
          verify: {
            scope: v.scope ?? 'candidato', priority: v.priority ?? 'media', verification, evidence: v.evidence ?? '',
            checks: v.checks ?? {}, verifiedAt: v.verifiedAt ?? null, acceptedAt: v.acceptedAt ?? null,
          },
        }),
      )
    }
    const { verifiables: _v, ...rest } = db
    return { ...rest, v: 6, tasks: nodes }
  },

  // v6 → v7: «Hoy» planea y cierra con tareas de Frentes (ya no hay texto libre, bloques ni antiatasco) y las tareas
  // guardan cuándo se hicieron. El historial diario anterior era texto que no se puede ligar a tareas: se descarta
  // (la copia automática previa a la migración lo conserva).
  6(db) {
    return { ...db, v: 7, tasks: db.tasks.map((t) => ({ doneAt: null, ...t })), days: {} }
  },

  // v7 → v8: desaparece el grupo «Para destrabar» del plan del día; sus tareas pasan a «Secundario».
  7(db) {
    const days = Object.fromEntries(
      Object.entries(db.days).map(([k, d]) => {
        const { unblock, ...plan } = d.plan ?? {}
        if (!unblock?.length) return [k, d]
        return [k, { ...d, plan: { ...plan, secondary: [...new Set([...(plan.secondary ?? []), ...unblock])] } }]
      }),
    )
    return { ...db, v: 8, days }
  },

  // v8 → v9: las decisiones ganan `context` (texto libre que explica la pregunta); las existentes quedan en blanco.
  8(db) {
    return { ...db, v: 9, decisions: db.decisions.map((d) => ({ context: '', ...d })) }
  },

  // v9 → v10: aparece el historial de reuniones (la utilidad «Reuniones»); las bases existentes empiezan sin ninguna.
  9(db) {
    return { ...db, v: 10, meetings: [] }
  },

  // v10 → v11: las tareas ganan `kind` ('tarea' | 'texto'); las existentes son tareas.
  10(db) {
    return { ...db, v: 11, tasks: db.tasks.map((t) => ({ kind: 'tarea', ...t })) }
  },
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x)

/** Lanza Error con un mensaje legible si la base no es una v actual válida. */
export function validate(db) {
  if (!isObj(db) || db.v !== CURRENT) throw new Error('Formato no válido')
  for (const k of ['fronts', 'tasks', 'decisions', 'projects', 'links', 'meetings'])
    if (!Array.isArray(db[k])) throw new Error(`Formato no válido: falta «${k}»`)
  for (const k of ['days', 'weeks', 'counters'])
    if (!isObj(db[k])) throw new Error(`Formato no válido: falta «${k}»`)
  return db
}

/** Lleva cualquier base soportada a la versión actual y la valida. Devuelve { db, from }. */
export function migrate(input) {
  if (!isObj(input)) throw new Error('Formato no válido')
  if (input.v == null && Array.isArray(input.tasks) && !input.fronts)
    throw new Error('Es una copia de la versión 1 y no es compatible con esta versión.')
  const from = input.v
  if (!Number.isInteger(from) || from < 2) throw new Error('Formato no válido')
  if (from > CURRENT) throw new Error(`Los datos son de una versión más nueva (v${from}) que esta app (v${CURRENT}).`)
  let db = structuredClone(input)
  delete db.rev
  if (from < CURRENT) {
    // lo mínimo que debe traer cada versión de origen para poder migrarla
    const required = from <= 4 ? ['fronts', 'caps', 'tasks', 'decisions'] : from === 5 ? ['fronts', 'tasks', 'verifiables', 'decisions'] : ['fronts', 'tasks', 'decisions']
    for (const k of required) if (!Array.isArray(db[k])) throw new Error('Formato no válido')
    if (!isObj(db.days) || !isObj(db.weeks)) throw new Error('Formato no válido')
    for (let v = from; v < CURRENT; v++) db = steps[v](db)
  }
  return { db: validate(db), from }
}
