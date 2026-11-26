import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOutline, outlineStats } from '../src/lib/outline.ts'

// Parte del bloc de notas real: cada [nivel, texto] se escribe con tabuladores y «-> », como en el original.
const NOTES = [
  'FRENTE GENERAL:',
  [0, 'Escribir documentación de productos faltantes'],
  [1, 'Contabilidad - Actualizar artículos'],
  [1, 'Contabilidad - Gestión de empresa'],
  [1, 'ERP - TODO.'],
  [0, 'Publicar documentación'],
  [0, 'Chatbot con IA alimentado con documentación'],
  '',
  'FRENTE CONTABILIDAD:',
  [0, 'Cambiar nombre de ramas (De ref/migración a ref/exógena).'],
  [0, 'Implementar MÓDULO DE CARGA DE DOCUMENTOS POR CUFE/XML/ZIP'],
  '',
  'FRENTE ERP:',
  [0, 'Nuevo módulo de compras'],
  [1, 'Corregir features ya implementadas'],
  [0, 'Ajustar módulo de compras según los nuevos parámetros ¿Afectan al backend de compras? Tal vez no, y sólo aplique en frontend.'],
  [0, 'Falta añadir a compras:'],
  [1, 'Manejo de lotes al registrar compras. (? Aparece comentado en el DDL y no está implementado en modelos.'],
  [1, 'Centro de costo: ¿De dónde saldrá? Tenemos que esperara a que la nueva integración contable esté lista.'],
  [0, 'CANCELADO: Nuevo sistema de matriz contable'],
  [1, 'Nueva forma de establecer matriz contable (? Puede ser CONCEPTO x MOVIMIENTO Ej: IVA 19% en Compras -> base - impuesto'],
  [1, 'Construir nuevo modelo de matriz contable'],
  [2, '¿Qué pasa con configuración por categoría, medios de pago, etc.?'],
  [0, 'Construir MÓDULO CARTERA POR PAGAR'],
]
const text = NOTES.map((n) => (typeof n === 'string' ? n : '\t'.repeat(n[0]) + '-> ' + n[1])).join('\n')
const tasksOnly = NOTES.filter((n) => typeof n !== 'string')

test('outline: reconoce frentes, tareas y profundidad en el formato del bloc de notas', () => {
  const groups = parseOutline(text)
  assert.deepEqual(groups.map((g) => g.front), ['General', 'Contabilidad', 'ERP'], '«FRENTE GENERAL:» → «General»; las siglas cortas se conservan')
  assert.equal(groups.flatMap((g) => g.nodes).length, tasksOnly.length)
  const [general, conta, erp] = groups
  assert.deepEqual(general.nodes.map((n) => [n.depth, n.title]), [
    [0, 'Escribir documentación de productos faltantes'],
    [1, 'Contabilidad - Actualizar artículos'],
    [1, 'Contabilidad - Gestión de empresa'],
    [1, 'ERP - TODO.'],
    [0, 'Publicar documentación'],
    [0, 'Chatbot con IA alimentado con documentación'],
  ])
  assert.equal(conta.nodes.length, 2)
  assert.equal(erp.nodes.find((n) => n.title.startsWith('¿Qué pasa'))?.depth, 2, 'tres niveles')
})

test('outline: «CANCELADO:» fija el estado y no queda en el título; «HECHO:» también', () => {
  const [, , erp] = parseOutline(text)
  const c = erp.nodes.find((n) => n.title === 'Nuevo sistema de matriz contable')
  assert.equal(c?.status, 'cancelada')
  const g = parseOutline('FRENTE X:\n-> HECHO: Algo\n-> Otra')
  assert.deepEqual(g[0].nodes.map((n) => [n.title, n.status]), [['Algo', 'hecha'], ['Otra', 'pendiente']])
})

test('outline: marca las dudas (¿ o ?) para poder convertirlas en decisiones', () => {
  const groups = parseOutline(text)
  const questions = groups.flatMap((g) => g.nodes).filter((n) => n.question).map((n) => n.title)
  assert.equal(questions.length, 5)
  assert.ok(questions.some((q) => q.startsWith('Centro de costo')))
  assert.ok(questions.some((q) => q.startsWith('Manejo de lotes')), 'también «(?» sin signo de apertura')
  assert.deepEqual(outlineStats(groups), { fronts: 3, tasks: tasksOnly.length, cancelled: 1, questions: 5 })
})

test('outline: no confunde «:» dentro de una tarea con un encabezado', () => {
  const [g] = parseOutline('FRENTE ERP:\n-> Falta añadir a compras:\n\t-> Orden de compra')
  assert.equal(g.front, 'ERP')
  assert.deepEqual(g.nodes.map((n) => [n.depth, n.title]), [[0, 'Falta añadir a compras:'], [1, 'Orden de compra']])
})

test('outline: sangría con espacios, saltos de nivel y tareas antes de cualquier frente', () => {
  const groups = parseOutline('-> Suelta\n-> Padre\n    -> Hija\n            -> Nieta muy sangrada\nFRENTE A:\n  - x\n    - y')
  assert.equal(groups[0].front, null, 'sin encabezado → grupo sin frente')
  assert.deepEqual(groups[0].nodes.map((n) => [n.depth, n.title]), [[0, 'Suelta'], [0, 'Padre'], [1, 'Hija'], [2, 'Nieta muy sangrada']], 'un salto grande se limita a un nivel')
  assert.deepEqual(groups[1].nodes.map((n) => [n.depth, n.title]), [[0, 'x'], [1, 'y']])
})

test('outline: texto con Windows (CRLF), BOM, líneas vacías y viñetas variadas', () => {
  const g = parseOutline('\uFEFFFRENTE B:\r\n\r\n• Uno\r\n→ Dos\r\n* Tres\r\n')
  assert.deepEqual(g[0].nodes.map((n) => n.title), ['Uno', 'Dos', 'Tres'])
  assert.deepEqual(parseOutline('   \n\n'), [])
  assert.deepEqual(parseOutline('FRENTE VACÍO:').map((x) => [x.front, x.nodes.length]), [['Vacío', 0]], 'un frente sin tareas también se crea')
})
