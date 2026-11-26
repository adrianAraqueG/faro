import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fresh } from './migrate.mjs'
import { createStore } from './store.mjs'
import { createApp } from './index.mjs'
import { AgentError, context, instructions, queryDecisions, registerDecision } from './agent.mjs'

/** Frentes: General, Cartera (con tareas y subtareas) e Información exógena (1); dos repositorios sin vínculos todavía. */
function base() {
  const db = fresh()
  db.fronts = [
    { id: 'fg', name: 'General', slug: 'general' },
    { id: 'fc', name: 'Cartera', slug: 'cartera' },
    { id: 'fe', name: 'Información exógena', slug: 'informacion-exogena' },
  ]
  const node = (o) => ({ kind: 'tarea', parentId: null, order: 0, status: 'pendiente', note: '', collapsed: false, projectId: null, decisionId: null, needsReview: false, verify: null, created: '2026-01-01', ...o })
  db.tasks = [
    node({ id: 'c1', frontId: 'fc', title: 'Pagos' }),
    node({ id: 'c2', frontId: 'fc', title: 'Anticipos', order: 1 }),
    node({ id: 'c3', frontId: 'fe', title: 'Formato 1001' }),
    // subtareas: «Pago parcial» existe bajo dos tareas distintas
    node({ id: 'c4', frontId: 'fc', parentId: 'c1', title: 'Pago parcial' }),
    node({ id: 'c5', frontId: 'fc', parentId: 'c2', title: 'Pago parcial' }),
    node({ id: 'c6', frontId: 'fc', parentId: 'c4', title: 'Redondeo' }),
  ]
  db.projects = [
    { id: 'p1', name: 'contabilidad', path: 'C:\\Dev\\contabilidad' },
    { id: 'p2', name: 'erp-api', path: 'C:\\Dev\\erp-api' },
  ]
  return db
}
const reg = (db, body) => registerDecision(db, body)
const errOf = (fn) => {
  try {
    fn()
  } catch (e) {
    return e
  }
  assert.fail('debía lanzar')
}

test('registrar: valida lo básico', () => {
  const db = base()
  assert.equal(errOf(() => reg(db, null)).status, 400)
  assert.equal(errOf(() => reg(db, { repository: 'erp-api' })).status, 400) // sin pregunta
  assert.equal(errOf(() => reg(db, { repository: 'erp-api', question: 'x', impact: 'enorme', front: 'cartera' })).status, 400)
  const noRepo = errOf(() => reg(db, { question: 'x' }))
  assert.equal(noRepo.status, 422)
  assert.deepEqual(noRepo.extra.options, ['contabilidad', 'erp-api'])
  const unknown = errOf(() => reg(db, { question: 'x', repository: 'nada' }))
  assert.equal(unknown.status, 422)
  assert.match(unknown.extra.hint, /Repositorios/)
})

test('registrar: crea la decisión con frente y tarea, el código, el log y el vínculo repositorio × frente', () => {
  const db = base()
  const out = reg(db, { repository: 'ERP-API', front: 'Cartera', task: 'pagos', question: '¿Anular con pago parcial?', context: 'Pasa en pagos de cartera', assumption: 'No permitir', impact: 'ALTO', origin: 'claude', key: 'k1' })
  assert.equal(out.status, 201)
  assert.equal(out.body.code, 'DEC-0001')
  assert.equal(out.body.state, 'en_supuesto')
  assert.equal(out.body.impact, 'alto')
  assert.deepEqual(out.body.front, { name: 'Cartera', slug: 'cartera', docs: 'docs/cartera/' })
  assert.equal(out.body.task, 'Pagos')
  assert.deepEqual(out.body.repositories, ['erp-api'])
  assert.equal(db.counters.decision, 1)
  assert.deepEqual(db.links.map((l) => [l.projectId, l.frontId]), [['p2', 'fc']])
  const d = db.decisions[0]
  assert.deepEqual([d.frontId, d.taskId], ['fc', 'c1'])
  assert.equal(d.log[0].note, 'Registrada por claude')
  assert.equal(d.origin, 'claude')
  assert.equal(d.key, 'k1')
  assert.equal(d.context, 'Pasa en pagos de cartera')
  assert.equal(out.body.context, 'Pasa en pagos de cartera')
  // sin supuesto queda abierta; la tarea es opcional
  const open = reg(db, { repository: 'erp-api', front: 'cartera', question: 'otra' })
  assert.equal(open.body.state, 'abierta')
  assert.equal(open.body.task, null)
})

test('registrar: acepta los nombres anteriores (project, capability, other_projects)', () => {
  const db = base()
  const out = reg(db, { project: 'erp-api', front: 'cartera', capability: 'Anticipos', other_projects: ['contabilidad'], question: 'q' })
  assert.equal(out.status, 201)
  assert.equal(out.body.task, 'Anticipos')
  assert.deepEqual(out.body.repositories, ['erp-api', 'contabilidad'])
})

test('registrar: el frente se infiere solo si el repositorio está vinculado a uno; si no, pide aclarar con opciones', () => {
  const db = base()
  // sin vínculos: ofrece todos los frentes
  const e = errOf(() => reg(db, { repository: 'erp-api', question: 'q' }))
  assert.equal(e.status, 422)
  assert.deepEqual(e.extra.options.map((o) => o.frontSlug), ['general', 'cartera', 'informacion-exogena'])
  assert.deepEqual(Object.keys(e.extra.options[0]), ['front', 'frontSlug'])
  assert.match(e.extra.hint, /vinculado/)

  // un solo frente vinculado: se infiere
  db.links.push({ id: 'l1', projectId: 'p2', frontId: 'fe' })
  const inferred = reg(db, { repository: 'erp-api', question: 'q1' })
  assert.equal(inferred.status, 201)
  assert.equal(inferred.body.front.slug, 'informacion-exogena')

  // varios vinculados: ambiguo, pero acota las opciones a los suyos
  db.links.push({ id: 'l2', projectId: 'p2', frontId: 'fc' })
  const amb = errOf(() => reg(db, { repository: 'erp-api', question: 'q2' }))
  assert.deepEqual(amb.extra.options.map((o) => o.frontSlug), ['informacion-exogena', 'cartera'], 'solo los vinculados, en el orden de los vínculos')
  assert.match(amb.extra.hint, /varios frentes/)
  // indicando el frente se resuelve
  assert.equal(reg(db, { repository: 'erp-api', front: 'Cartera', question: 'q2' }).status, 201)
})

test('registrar: frente o tarea desconocidos devuelven opciones', () => {
  const db = base()
  const f = errOf(() => reg(db, { repository: 'erp-api', front: 'nada', question: 'q' }))
  assert.equal(f.status, 422)
  assert.equal(f.extra.options.length, 3)
  const t = errOf(() => reg(db, { repository: 'erp-api', front: 'cartera', task: 'Inexistente', question: 'q' }))
  assert.equal(t.status, 422)
  assert.deepEqual(t.extra.options, ['Pagos', 'Anticipos', 'Pagos › Pago parcial', 'Anticipos › Pago parcial'], 'ofrece las rutas hasta dos niveles')
  assert.match(t.extra.hint, /omite «task»/)
  // una tarea de OTRO frente no vale
  assert.equal(errOf(() => reg(db, { repository: 'erp-api', front: 'cartera', task: 'Formato 1001', question: 'q' })).status, 422)
  // se puede registrar en General (tareas sueltas)
  const g = reg(db, { repository: 'erp-api', front: 'general', question: 'suelta' })
  assert.equal(g.body.front.slug, 'general')
})

test('registrar: la tarea puede ser una subtarea (por ruta, por final de ruta o por id)', () => {
  const db = base()
  const q = (task) => reg(db, { repository: 'erp-api', front: 'cartera', task, question: `duda ${task}` })
  assert.equal(q('Pagos › Pago parcial').body.task, 'Pagos › Pago parcial')
  assert.equal(q('Anticipos > Pago parcial').body.task, 'Anticipos › Pago parcial', 'acepta > y / como separador')
  assert.equal(q('pagos / pago parcial / redondeo').body.task, 'Pagos › Pago parcial › Redondeo', 'sin importar mayúsculas')
  assert.equal(q('Redondeo').body.task, 'Pagos › Pago parcial › Redondeo', 'basta el nombre si es único')
  assert.equal(q('c5').body.task, 'Anticipos › Pago parcial', 'también por id')
  // «Pago parcial» está bajo dos tareas: hay que precisar
  const amb = errOf(() => q('Pago parcial'))
  assert.equal(amb.status, 422)
  assert.deepEqual(amb.extra.options, ['Pagos › Pago parcial', 'Anticipos › Pago parcial'])
  assert.match(amb.message, /ruta completa/)
  // una subtarea de otro frente no vale
  assert.equal(errOf(() => q('Formato 1001')).status, 422)
})

test('registrar: anti-duplicados por clave y por pregunta abierta', () => {
  const db = base()
  const a = reg(db, { repository: 'erp-api', front: 'cartera', question: 'Misma duda', key: 'abc' })
  const b = reg(db, { repository: 'erp-api', front: 'cartera', question: 'otro texto', key: 'abc' })
  assert.equal(b.status, 200)
  assert.equal(b.changed, false)
  assert.equal(b.body.duplicate, true)
  assert.equal(b.body.code, a.body.code)
  // sin clave: misma pregunta (sin importar tildes ni mayúsculas) abierta en el mismo repositorio
  const c = reg(db, { repository: 'erp-api', front: 'cartera', question: 'MISMA   duda' })
  assert.equal(c.body.duplicate, true)
  assert.equal(db.decisions.length, 1)
  // si ya se resolvió, volver a preguntarlo es una duda nueva
  db.decisions[0].state = 'resuelta'
  delete db.decisions[0].key
  assert.equal(reg(db, { repository: 'erp-api', front: 'cartera', question: 'Misma duda' }).status, 201)
  // otro repositorio principal: no es duplicado
  assert.equal(reg(db, { repository: 'contabilidad', front: 'cartera', question: 'Misma duda' }).status, 201)
})

test('registrar: repositorios adicionales', () => {
  const db = base()
  const out = reg(db, { repository: 'erp-api', other_repositories: ['contabilidad', 'erp-api', 'contabilidad'], front: 'cartera', question: 'q' })
  assert.deepEqual(out.body.repositories, ['erp-api', 'contabilidad'])
  assert.equal(db.links.length, 2, 'un vínculo por repositorio')
  assert.equal(errOf(() => reg(db, { repository: 'erp-api', other_repositories: ['zzz'], front: 'cartera', question: 'otra' })).status, 422)
})

test('consultar: lo vigente incluye las cambiadas con trabajo sin revisar; filtros y errores', () => {
  const db = base()
  reg(db, { repository: 'erp-api', front: 'cartera', question: 'abierta' })
  reg(db, { repository: 'erp-api', front: 'cartera', question: 'con supuesto', assumption: 'x' })
  reg(db, { repository: 'contabilidad', front: 'informacion-exogena', question: 'otro repositorio', assumption: 'y' })
  reg(db, { repository: 'erp-api', front: 'cartera', question: 'cambiada', assumption: 'z' })
  reg(db, { repository: 'erp-api', front: 'cartera', question: 'confirmada', assumption: 'w' })
  const byQ = (q) => db.decisions.find((d) => d.question === q)
  Object.assign(byQ('cambiada'), { state: 'resuelta', outcome: 'cambia', resolution: 'otra cosa' })
  Object.assign(byQ('confirmada'), { state: 'resuelta', outcome: 'confirma', resolution: 'w' })
  db.tasks.push({ ...db.tasks[0], id: 'v1', parentId: 'c1', title: 'Anular factura', decisionId: byQ('cambiada').id, status: 'curso', needsReview: true })

  const vigentes = queryDecisions(db, {}).decisions.map((d) => d.question).sort()
  assert.deepEqual(vigentes, ['abierta', 'cambiada', 'con supuesto', 'otro repositorio'])
  const cambiada = queryDecisions(db, { state: 'resuelta' }).decisions.find((d) => d.question === 'cambiada')
  assert.deepEqual(cambiada.requiresReview, [{ id: 'v1', title: 'Anular factura' }])
  assert.equal(queryDecisions(db, { repository: 'erp-api' }).count, 3)
  assert.equal(queryDecisions(db, { repository: 'contabilidad' }).count, 1)
  assert.equal(queryDecisions(db, { front: 'informacion-exogena' }).count, 1)
  assert.equal(queryDecisions(db, { repository: 'erp-api', front: 'cartera', state: 'en_supuesto' }).count, 1)
  assert.equal(queryDecisions(db, { state: 'todas' }).count, 5)
  assert.equal(queryDecisions(db, { state: 'resuelta' }).count, 2)
  assert.equal(errOf(() => queryDecisions(db, { state: 'rara' })).status, 400)
  assert.equal(errOf(() => queryDecisions(db, { repository: 'nada' })).status, 422)
  assert.equal(errOf(() => queryDecisions(db, { front: 'nada' })).status, 422)
})

test('contexto e instrucciones', () => {
  const db = base()
  reg(db, { repository: 'erp-api', front: 'cartera', question: 'q' })
  const c = context(db, {})
  assert.deepEqual(c.fronts[1], { name: 'Cartera', slug: 'cartera', docs: 'docs/cartera/', tasks: ['Pagos', 'Anticipos'] }, 'solo el primer nivel')
  assert.deepEqual(c.repositories.find((p) => p.name === 'erp-api').fronts, ['cartera'])
  assert.deepEqual(context(db, { repository: 'erp-api' }).repository.fronts, ['cartera'])
  assert.equal(errOf(() => context(db, { repository: 'nada' })).status, 422)

  const t = instructions(db, { repository: 'erp-api', base: 'http://localhost:4317' })
  assert.match(t, /http:\/\/localhost:4317\/api\/agent\/decisions/)
  assert.match(t, /Repositorio en FARO: `erp-api`/)
  assert.match(t, /`cartera` \(docs\/cartera\/\)/)
  assert.match(t, /"front": "cartera"/, 'con un solo frente vinculado el ejemplo ya lo trae')
  assert.match(t, /Si FARO está apagado/)
  assert.ok(t.startsWith('<!-- faro:inicio') && t.trimEnd().endsWith('<!-- faro:fin -->'), 'bloque delimitado para poder reemplazarlo')
  assert.match(instructions(db, { repository: null, base: 'http://x' }), /<REPOSITORIO>/)
})

test('HTTP: registrar, consultar, duplicado, errores con opciones y nombres anteriores', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faro-agent-'))
  fs.writeFileSync(path.join(dir, 'faro.json'), JSON.stringify(base()))
  const store = createStore({ dir })
  const server = createApp({ store, staticDir: null })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}`
  const call = async (p, init) => {
    const r = await fetch(url + p, init)
    const ct = r.headers.get('content-type')
    return { status: r.status, ct, body: ct.includes('json') ? await r.json() : await r.text() }
  }
  const post = (body) => call('/api/agent/decisions', { method: 'POST', body: JSON.stringify(body) })
  try {
    const rev0 = store.rev().rev
    const a = await post({ repository: 'erp-api', front: 'cartera', task: 'Pagos', question: '¿Anular?', assumption: 'No', impact: 'alto', origin: 'codex', key: 'k' })
    assert.equal(a.status, 201)
    assert.equal(a.body.code, 'DEC-0001')
    const rev1 = store.rev().rev
    assert.equal(rev1, rev0 + 1)

    const dup = await post({ repository: 'erp-api', front: 'cartera', question: '¿Anular?', key: 'k' })
    assert.deepEqual([dup.status, dup.body.duplicate], [200, true])
    assert.equal(store.rev().rev, rev1, 'un duplicado no escribe')

    // erp-api ya quedó vinculado a «cartera» (se infiere); «contabilidad» no tiene vínculos: hay que indicar el frente
    const bad = await post({ repository: 'contabilidad', question: 'q' })
    assert.equal(bad.status, 422)
    assert.ok(Array.isArray(bad.body.options) && bad.body.error)
    assert.equal(store.rev().rev, rev1, 'un error no escribe')
    assert.equal((await call('/api/agent/decisions', { method: 'POST', body: '{no' })).status, 400)

    // acentos en Latin-1 (no UTF-8): se rechaza con un mensaje accionable y no se guarda nada
    const latin1 = await call('/api/agent/decisions', {
      method: 'POST',
      body: Buffer.from('{"repository":"erp-api","front":"cartera","question":"¿Cuál es la regla?"}', 'latin1'),
    })
    assert.equal(latin1.status, 400)
    assert.match(latin1.body.error, /UTF-8/)
    assert.equal(store.rev().rev, rev1, 'no escribe')
    // el mismo texto en UTF-8 se guarda tal cual
    const utf8 = await post({ repository: 'erp-api', front: 'cartera', question: '¿Cuál es la regla?' })
    assert.equal(utf8.status, 201)
    assert.equal(utf8.body.question, '¿Cuál es la regla?')

    // consulta con el nombre nuevo y con el anterior
    const q = await call('/api/agent/decisions?repository=erp-api&front=cartera')
    assert.equal(q.status, 200)
    assert.equal(q.body.decisions.find((d) => d.code === 'DEC-0001').origin, 'codex')
    assert.equal((await call('/api/agent/decisions?project=erp-api')).body.count, q.body.count, 'project sigue funcionando')
    assert.equal((await call('/api/agent/decisions?repository=nada')).status, 422)

    // la edición persistió en disco con el esquema válido
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'faro.json'), 'utf8'))
    assert.equal(onDisk.decisions[1].code, 'DEC-0001')
    assert.equal(onDisk.decisions[0].question, '¿Cuál es la regla?')
    assert.equal(onDisk.rev, rev1 + 1)

    const ins = await call('/api/agent/instructions?repository=erp-api')
    assert.match(ins.ct, /markdown/)
    assert.ok(ins.body.includes(`http://localhost:${server.address().port}/api/agent/decisions`), 'usa el puerto real del servidor')
    assert.equal((await call('/api/agent/context')).body.app, 'FARO')
  } finally {
    server.close()
  }
})
