import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate, slugify, fresh } from './migrate.mjs'
import { createStore } from './store.mjs'
import { createApp } from './index.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'faro-test-'))
const v2 = () => ({
  v: 2,
  fronts: [
    { id: 'a', name: 'Información exógena' },
    { id: 'b', name: 'Informacion Exogena' },
    { id: 'c', name: 'Cartera' },
  ],
  caps: [{ id: 'c1', frontId: 'c', name: 'Pagos' }],
  tasks: [{ id: 't1', capId: 'c1', title: 'x' }],
  // el arreglo guarda lo más nuevo primero
  decisions: [{ id: 'd2', question: 'segunda' }, { id: 'd1', question: 'primera' }],
  days: { '2026-01-01': { mainGoal: 'm' } },
  weeks: {},
})

test('migrate v2→v3: slugs únicos sin tildes, códigos de la más antigua a la más nueva', () => {
  const input = v2()
  const copy = structuredClone(input)
  const { db, from } = migrate(input)
  assert.equal(from, 2)
  assert.equal(db.v, 11)
  assert.deepEqual(db.fronts.map((f) => f.slug), ['general', 'informacion-exogena', 'informacion-exogena-2', 'cartera'])
  assert.equal(db.decisions.find((d) => d.id === 'd1').code, 'DEC-0001')
  assert.equal(db.decisions.find((d) => d.id === 'd2').code, 'DEC-0002')
  assert.equal(db.counters.decision, 2)
  assert.deepEqual(db.projects, [])
  assert.deepEqual(db.links, [])
  assert.deepEqual(db.tasks.map((t) => [t.id, t.parentId, t.title]), [['c1', null, 'Pagos'], ['t1', 'c1', 'x']], 'la capacidad es la tarea y el entregable su subtarea')
  assert.equal(db.caps, undefined)
  assert.equal(db.verifiables, undefined)
  assert.deepEqual(input, copy, 'no debe mutar la entrada')
})

test('migrate v3→v4: estados del ciclo de vida, alcance y marcas', () => {
  const v3 = {
    v: 3,
    fronts: [{ id: 'f', name: 'Cartera', slug: 'cartera' }],
    caps: [{ id: 'c', frontId: 'f', name: 'Pagos' }],
    tasks: [
      { id: 't1', capId: 'c', title: 'a', state: 'curso', decisionId: 'd1' },
      { id: 't2', capId: 'c', title: 'b', state: 'lista', decisionId: null, projectId: 'p9' },
    ],
    decisions: [
      { id: 'd1', code: 'DEC-0001', state: 'pendiente', assumption: 'No anular', created: '2026-11-02' },
      { id: 'd2', code: 'DEC-0002', state: 'pendiente', assumption: '   ', created: '2026-11-02' },
      { id: 'd3', code: 'DEC-0003', state: 'resuelta', assumption: 'x', resolution: 'ok', created: '2026-11-01' },
    ],
    projects: [], links: [], counters: { decision: 3 }, days: {}, weeks: {},
  }
  const copy = structuredClone(v3)
  const { db, from } = migrate(v3)
  assert.equal(from, 3)
  assert.equal(db.v, 11)
  const [d1, d2, d3] = db.decisions
  assert.deepEqual([d1.state, d2.state, d3.state], ['en_supuesto', 'abierta', 'resuelta'])
  assert.equal(d1.taskId, 'c', 'toma la tarea del verificable ligado')
  assert.equal(d1.frontId, 'f')
  assert.equal(d2.taskId, null)
  assert.equal(d3.outcome, null, 'no se inventa si confirmó o cambió')
  assert.deepEqual(d1.projectIds, [])
  assert.equal(d1.log.length, 1)
  assert.equal(d1.log[0].state, 'en_supuesto')
  const sub = (id) => db.tasks.find((t) => t.id === id)
  assert.equal(sub('t1').projectId, null)
  assert.equal(sub('t1').needsReview, false)
  assert.equal(sub('t2').projectId, 'p9', 'no pisa un valor existente')
  assert.deepEqual(v3, copy, 'no debe mutar la entrada')
})

test('migrate v10→v11: las tareas existentes pasan a kind «tarea» sin pisar un kind ya puesto', () => {
  const v10 = {
    v: 10, fronts: [{ id: 'f', name: 'General', slug: 'general' }], decisions: [], projects: [], links: [], counters: { decision: 0 }, days: {}, weeks: {}, meetings: [],
    tasks: [{ id: 'a', frontId: 'f', parentId: null, order: 0, title: 'A' }, { id: 'b', frontId: 'f', parentId: null, order: 1, title: 'B', kind: 'texto' }],
  }
  const copy = structuredClone(v10)
  const { db, from } = migrate(v10)
  assert.equal(from, 10)
  assert.equal(db.v, 11)
  assert.deepEqual(db.tasks.map((t) => t.kind), ['tarea', 'texto'])
  assert.deepEqual(v10, copy, 'no debe mutar la entrada')
})

test('migrate v9→v10: aparece el historial de reuniones, vacío', () => {
  const v9 = { v: 9, fronts: [{ id: 'f', name: 'General', slug: 'general' }], tasks: [], decisions: [], projects: [], links: [], counters: { decision: 0 }, days: {}, weeks: {} }
  const copy = structuredClone(v9)
  const { db, from } = migrate(v9)
  assert.equal(from, 9)
  assert.equal(db.v, 11)
  assert.deepEqual(db.meetings, [])
  assert.deepEqual(v9, copy, 'no debe mutar la entrada')
})

test('migrate v4→v5: capacidades→tareas, entregables→verificables, frente General y decisiones con frente', () => {
  const v4 = {
    v: 4,
    fronts: [{ id: 'f1', name: 'Cartera', slug: 'cartera' }, { id: 'f2', name: 'Exógena', slug: 'exogena' }],
    caps: [{ id: 'c1', frontId: 'f1', name: 'Pagos' }, { id: 'c2', frontId: 'f2', name: 'Formato 1001' }],
    tasks: [{ id: 't1', capId: 'c1', title: 'Pago parcial', state: 'curso', decisionId: 'd1', projectId: null, needsReview: true }],
    decisions: [
      { id: 'd1', code: 'DEC-0001', capId: 'c1', state: 'en_supuesto' },
      { id: 'd2', code: 'DEC-0002', capId: 'c2', state: 'abierta' },
      { id: 'd3', code: 'DEC-0003', capId: null, state: 'abierta' },
    ],
    projects: [], links: [], counters: { decision: 3 }, days: { '2026-01-01': { mainGoal: 'x' } }, weeks: {},
  }
  const copy = structuredClone(v4)
  const { db, from } = migrate(v4)
  assert.equal(from, 4)
  assert.equal(db.v, 11)
  assert.equal(db.caps, undefined, 'ya no existe «caps»')
  assert.deepEqual(db.tasks.map((t) => [t.id, t.frontId, t.parentId, t.title]), [
    ['c1', 'f1', null, 'Pagos'],
    ['c2', 'f2', null, 'Formato 1001'],
    ['t1', 'f1', 'c1', 'Pago parcial'],
  ])
  const t1 = db.tasks.find((t) => t.id === 't1')
  assert.deepEqual([t1.status, t1.decisionId, t1.needsReview, t1.verify.verification], ['curso', 'd1', true, 'ninguna'])
  const general = db.fronts.find((f) => f.slug === 'general')
  assert.ok(general, 'aparece el frente General')
  assert.deepEqual(db.fronts.map((f) => f.slug), ['general', 'cartera', 'exogena'])
  const [d1, d2, d3] = db.decisions
  assert.deepEqual([d1.frontId, d1.taskId], ['f1', 'c1'])
  assert.deepEqual([d2.frontId, d2.taskId], ['f2', 'c2'])
  assert.deepEqual([d3.frontId, d3.taskId], [general.id, null], 'sin tarea → General')
  assert.equal(d1.capId, undefined)
  assert.deepEqual(db.days, {}, 'el historial diario en texto se descarta en v7')
  assert.deepEqual(v4, copy, 'no debe mutar la entrada')
})

test('migrate v5→v6: las tareas pasan a ser un árbol y los verificables, subtareas verificables', () => {
  const v5 = {
    v: 5,
    fronts: [{ id: 'f1', name: 'Cartera', slug: 'cartera' }, { id: 'fg', name: 'General', slug: 'general' }],
    tasks: [
      { id: 'a', frontId: 'f1', name: 'Pagos', done: false },
      { id: 'b', frontId: 'f1', name: 'Anticipos', done: false },
      { id: 'c', frontId: 'fg', name: 'Llamar al PO', done: true },
    ],
    verifiables: [
      { id: 'v1', taskId: 'a', title: 'Pago parcial', scope: 'confirmado', state: 'tecnico', priority: 'alta', evidence: 'PR 12', decisionId: 'd1', checks: { def: true }, created: '2026-01-02', verifiedAt: '2026-01-03', acceptedAt: null, projectId: 'p1', needsReview: true },
      { id: 'v2', taskId: 'a', title: 'Saldo en cero', state: 'lista' },
      { id: 'v3', taskId: 'a', title: 'Bloqueado por el PO', state: 'bloqueado' },
      { id: 'v4', taskId: 'b', title: 'Aceptado', state: 'aceptado', acceptedAt: '2026-02-01', verifiedAt: '2026-01-30' },
      { id: 'v5', taskId: 'no-existe', title: 'Huérfano', state: 'curso' },
    ],
    decisions: [], projects: [], links: [], counters: { decision: 0 }, days: {}, weeks: {},
  }
  const copy = structuredClone(v5)
  const { db, from } = migrate(v5)
  assert.equal(from, 5)
  assert.equal(db.v, 11)
  assert.equal(db.verifiables, undefined)
  const by = (id) => db.tasks.find((t) => t.id === id)
  // las tareas conservan su identidad y quedan en el primer nivel, en orden
  assert.deepEqual(['a', 'b', 'c'].map((id) => [by(id).parentId, by(id).frontId]), [[null, 'f1'], [null, 'f1'], [null, 'fg']])
  assert.deepEqual(['a', 'b'].map((id) => by(id).order), [0, 1])
  assert.deepEqual([by('c').status, by('a').status], ['hecha', 'pendiente'], 'el «done» de una tarea suelta pasa a estado')
  // los verificables cuelgan de su tarea, marcados como verificables
  assert.deepEqual(['v1', 'v2', 'v3'].map((id) => [by(id).parentId, by(id).order]), [['a', 0], ['a', 1], ['a', 2]])
  assert.equal(by('v1').frontId, 'f1', 'toma el frente de su tarea')
  assert.deepEqual(by('v1').verify, { scope: 'confirmado', priority: 'alta', verification: 'tecnico', evidence: 'PR 12', checks: { def: true }, verifiedAt: '2026-01-03', acceptedAt: null })
  assert.deepEqual([by('v1').status, by('v1').projectId, by('v1').decisionId, by('v1').needsReview], ['hecha', 'p1', 'd1', true])
  // estados antiguos → estado + verificación
  assert.deepEqual([by('v2').status, by('v2').verify.verification], ['pendiente', 'ninguna'])
  assert.deepEqual([by('v3').status, by('v3').verify.verification], ['bloqueada', 'ninguna'])
  assert.deepEqual([by('v4').status, by('v4').verify.verification], ['hecha', 'aceptado'])
  // sin tarea padre: pasa al frente General, en el primer nivel
  assert.deepEqual([by('v5').parentId, by('v5').frontId, by('v5').status], [null, 'fg', 'curso'])
  assert.equal(by('a').verify, null, 'las tareas normales no son verificables')
  assert.deepEqual(v5, copy, 'no debe mutar la entrada')
})

test('migrate v6→v7: tareas con doneAt y el historial diario en texto se descarta', () => {
  const task = { id: 't', frontId: 'f', parentId: null, order: 0, title: 'x', status: 'hecha' }
  const v6 = {
    v: 6, fronts: [{ id: 'f', name: 'General', slug: 'general' }], tasks: [task, { ...task, id: 'u', doneAt: '2026-11-02' }],
    decisions: [], projects: [], links: [], counters: { decision: 0 },
    days: { '2026-11-02': { mainGoal: 'texto', blocks: {}, stuckProblem: 'x', tomorrow: 'nota vieja' } }, weeks: { w: { weekDone: 'se conserva' } },
  }
  const copy = structuredClone(v6)
  const { db, from } = migrate(v6)
  assert.equal(from, 6)
  assert.equal(db.v, 11)
  assert.deepEqual(db.tasks.map((t) => t.doneAt), [null, '2026-11-02'], 'no pisa un doneAt existente')
  assert.deepEqual(db.days, {})
  assert.deepEqual(db.weeks, v6.weeks)
  assert.deepEqual(v6, copy, 'no debe mutar la entrada')
})

test('migrate v7→v8: «Para destrabar» pasa a «Secundario» sin duplicar', () => {
  const v7 = {
    v: 7, fronts: [{ id: 'f', name: 'General', slug: 'general' }], tasks: [], decisions: [], projects: [], links: [], counters: { decision: 0 }, weeks: {},
    days: {
      a: { plan: { primary: ['1'], secondary: ['2'], unblock: ['2', '3'] }, tomorrow: 'n' },
      b: { plan: { primary: ['1'] } },
      c: { achieved: ['1'] },
    },
  }
  const copy = structuredClone(v7)
  const { db } = migrate(v7)
  assert.equal(db.v, 11)
  assert.deepEqual(db.days.a, { plan: { primary: ['1'], secondary: ['2', '3'] }, tomorrow: 'n' })
  assert.deepEqual([db.days.b, db.days.c], [v7.days.b, v7.days.c])
  assert.deepEqual(v7, copy, 'no debe mutar la entrada')
})

test('migrate v8→v9: las decisiones ganan «context» en blanco y no se pisa el existente', () => {
  const v8 = {
    v: 8, fronts: [{ id: 'f', name: 'General', slug: 'general' }], tasks: [], projects: [], links: [], counters: { decision: 2 }, days: {}, weeks: {},
    decisions: [{ id: 'a', code: 'DEC-0001', question: 'q' }, { id: 'b', code: 'DEC-0002', question: 'r', context: 'ya tenía' }],
  }
  const copy = structuredClone(v8)
  const { db, from } = migrate(v8)
  assert.equal(from, 8)
  assert.equal(db.v, 11)
  assert.deepEqual(db.decisions.map((d) => d.context), ['', 'ya tenía'])
  assert.deepEqual(v8, copy, 'no debe mutar la entrada')
})

test('migrate v4→v5: la instalación sin uso estrena los frentes por defecto', () => {
  const pristine = {
    v: 4,
    fronts: [{ id: 'f_erp', name: 'ERP principal', slug: 'erp-principal' }],
    caps: [{ id: 'c_fact', frontId: 'f_erp', name: 'Facturación y gestión de pagos' }],
    tasks: [], decisions: [], projects: [], links: [], counters: { decision: 0 }, days: {}, weeks: {},
  }
  const { db } = migrate(pristine)
  assert.deepEqual(db.fronts.map((f) => f.slug), ['general', 'contabilidad', 'erp-en-efactura'])
  assert.deepEqual(db.tasks, [])
  // en cuanto hay algo, no se toca lo que el usuario tiene
  const used = { ...structuredClone(pristine), tasks: [{ id: 't', capId: 'c_fact', title: 'x' }] }
  const kept = migrate(used).db
  assert.deepEqual(kept.fronts.map((f) => f.slug), ['general', 'erp-principal'])
  assert.equal(kept.tasks.length, 2, 'la tarea que era capacidad y su subtarea (el entregable)')
})

test('migrate rechaza v1, versiones futuras y basura', () => {
  assert.throws(() => migrate({ tasks: [] }), /versión 1/)
  assert.throws(() => migrate({ v: 99 }), /más nueva/)
  assert.throws(() => migrate(null), /Formato/)
  assert.throws(() => migrate({ v: 2, fronts: [] }), /Formato/)
  assert.throws(() => migrate({ ...fresh(), projects: 'no' }), /projects/)
})

test('slugify', () => {
  assert.equal(slugify('  ERP en Efactura!! '), 'erp-en-efactura')
  assert.equal(slugify('Información exógena'), 'informacion-exogena')
  assert.equal(slugify('###'), 'frente')
})

test('store: crea el archivo, guarda con revisión y detecta conflictos', () => {
  const dir = tmp()
  const s = createStore({ dir })
  const { rev, db } = s.snapshot()
  assert.equal(rev, 1)
  assert.ok(fs.existsSync(path.join(dir, 'faro.json')))
  db.fronts.push({ id: 'n', name: 'Nuevo', slug: 'nuevo' })
  const ok = s.put(rev, db)
  assert.equal(ok.rev, 2)
  assert.equal(s.put(rev, db).conflict, true, 'revisión vieja → conflicto')
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'faro.json'), 'utf8'))
  assert.equal(onDisk.rev, 2)
  assert.equal(onDisk.fronts.length, 4)
  assert.ok(!fs.existsSync(path.join(dir, 'faro.json.tmp')), 'no queda el temporal')
  assert.throws(() => s.put(2, { v: 3 }), /Formato/)
  // persiste entre reinicios
  assert.equal(createStore({ dir }).snapshot().db.fronts.length, 4)
})

test('store: detecta ediciones externas del archivo y sube la revisión', () => {
  const dir = tmp()
  const s = createStore({ dir })
  const before = s.snapshot().rev
  const f = path.join(dir, 'faro.json')
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'))
  raw.fronts[0].name = 'Editado a mano'
  fs.writeFileSync(f, JSON.stringify(raw))
  const t = new Date(Date.now() + 5000)
  fs.utimesSync(f, t, t)
  const snap = s.snapshot()
  assert.ok(snap.rev > before)
  assert.equal(snap.db.fronts[0].name, 'Editado a mano')
  assert.equal(s.put(before, snap.db).conflict, true, 'un cliente con la revisión anterior no pisa la edición')
})

test('store: un JSON externo roto no borra lo que hay en memoria', () => {
  const dir = tmp()
  const s = createStore({ dir })
  const f = path.join(dir, 'faro.json')
  fs.writeFileSync(f, '{ roto')
  const t = new Date(Date.now() + 5000)
  fs.utimesSync(f, t, t)
  const snap = s.snapshot()
  assert.match(snap.error, /No se pudo leer/)
  assert.equal(snap.db.fronts.length, 3)
})

test('store: no arranca (ni sobrescribe) con un faro.json ilegible', () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'faro.json'), '{ roto')
  assert.throws(() => createStore({ dir }), /No se pudo leer/)
  assert.equal(fs.readFileSync(path.join(dir, 'faro.json'), 'utf8'), '{ roto')
})

test('store: migra un v2 al arrancar y guarda copia previa', () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'faro.json'), JSON.stringify(v2()))
  const s = createStore({ dir })
  assert.equal(s.snapshot().db.v, 11)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'faro.json'), 'utf8')).v, 11)
  const copies = fs.readdirSync(path.join(dir, 'backups'))
  assert.ok(copies.some((c) => c.endsWith('-pre-v2.json')), copies.join())
})

test('store: las copias rotan a un máximo', () => {
  const dir = tmp()
  fs.mkdirSync(path.join(dir, 'backups'))
  for (let i = 0; i < 40; i++) fs.writeFileSync(path.join(dir, 'backups', `faro-2000010${i < 10 ? '0' + i : i}-000000.json`), '{}')
  fs.writeFileSync(path.join(dir, 'faro.json'), JSON.stringify(fresh()))
  createStore({ dir })
  assert.ok(fs.readdirSync(path.join(dir, 'backups')).length <= 30)
})

test('API HTTP: db, rev, put, conflicto, import', async () => {
  const dir = tmp()
  const server = createApp({ store: createStore({ dir }), staticDir: null })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const j = (p, init) => fetch(base + p, init).then(async (r) => ({ status: r.status, body: await r.json() }))
  const put = (rev, db) => j('/api/db', { method: 'PUT', body: JSON.stringify({ rev, db }) })
  try {
    const health = (await j('/api/health')).body
    assert.equal(health.ok, true)
    assert.ok(fs.existsSync(path.join(health.appDir, 'templates', 'AGENTS.md')), 'appDir apunta a la carpeta de FARO')
    const g = await j('/api/db')
    assert.equal(g.status, 200)
    assert.equal(g.body.rev, 1)
    g.body.db.tasks.push({ id: 't' })
    const p = await put(1, g.body.db)
    assert.deepEqual([p.status, p.body.rev], [200, 2])
    assert.equal((await j('/api/rev')).body.rev, 2)
    const stale = await put(1, g.body.db)
    assert.equal(stale.status, 409)
    assert.equal((await put(2, { v: 3 })).status, 400)
    assert.equal((await j('/api/db', { method: 'PUT', body: '{no' })).status, 400)
    const imp = await j('/api/import', { method: 'POST', body: JSON.stringify(v2()) })
    assert.equal(imp.status, 200)
    assert.equal(imp.body.db.v, 11)
    assert.ok(imp.body.db.fronts.some((f) => f.slug === 'informacion-exogena'))
    assert.equal((await j('/api/import', { method: 'POST', body: JSON.stringify({ tasks: [] }) })).status, 400)
    assert.equal((await j('/api/nada')).status, 404)
  } finally {
    server.close()
  }
})
