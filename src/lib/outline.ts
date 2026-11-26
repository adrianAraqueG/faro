// Lee un esquema de texto (como un bloc de notas) y lo convierte en frentes con árboles de tareas. Función pura, sin
// dependencias: se prueba directamente con Node.
//
// Formato que entiende:
//   FRENTE CONTABILIDAD:            ← una línea sin viñeta que termina en «:» abre un frente («FRENTE» es opcional)
//   -> Una tarea                    ← «->», «-», «*», «•» o «→» marcan una tarea (también valen sin viñeta)
//   	-> Una subtarea               ← cada tabulador (o bloque de espacios) baja un nivel
//   -> CANCELADO: Otra tarea        ← «CANCELADO:» o «HECHO:» al inicio fijan el estado
//   -> ¿Qué pasa con X?             ← las líneas con «¿» o «?» se marcan como dudas

export type OutlineStatus = 'pendiente' | 'hecha' | 'cancelada'
export type OutlineNode = { title: string; status: OutlineStatus; depth: number; question: boolean }
/** `front` es null para las tareas que aparecen antes de cualquier encabezado de frente. */
export type OutlineGroup = { front: string | null; nodes: OutlineNode[] }

const BULLET = /^(?:[-*•–—→>]+\s*)+/
const STATUS: [RegExp, OutlineStatus][] = [
  [/^(?:CANCELAD[OA]|DESCARTAD[OA])\s*:\s*/i, 'cancelada'],
  [/^(?:HECH[OA]|LISTO|LISTA|COMPLETAD[OA])\s*:\s*/i, 'hecha'],
]

/** «CONTABILIDAD» → «Contabilidad»; las siglas cortas (ERP) se conservan; lo que ya trae minúsculas no se toca. */
function frontName(raw: string): string {
  const name = raw.replace(/^frente\s+/i, '').replace(/\s+/g, ' ').trim()
  if (name !== name.toUpperCase()) return name
  return name
    .split(' ')
    .map((w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(' ')
}

export function parseOutline(text: string): OutlineGroup[] {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')

  // Unidad de sangrado en espacios: la menor sangría positiva hecha solo de espacios.
  const spaceIndents = lines
    .map((l) => /^( +)\S/.exec(l)?.[1].length ?? 0)
    .filter((n) => n > 0)
  const unit = spaceIndents.length ? Math.min(...spaceIndents) : 1

  const groups: OutlineGroup[] = []
  let group: OutlineGroup = { front: null, nodes: [] }
  const raw: number[] = [] // sangría bruta de cada nodo del grupo actual
  const close = () => {
    if (group.nodes.length) {
      // El primer nivel del frente es el menos sangrado; luego se evitan saltos de más de un nivel.
      const min = Math.min(...raw)
      let prev = -1
      group.nodes.forEach((n, i) => {
        n.depth = Math.min(raw[i] - min, prev + 1)
        prev = n.depth
      })
      groups.push(group)
    } else if (group.front) groups.push(group) // un frente sin tareas también se crea
    raw.length = 0
  }

  for (const line of lines) {
    if (!line.trim()) continue
    const indent = (/^\t*/.exec(line)?.[0].length ?? 0) + Math.floor((/^\t*( *)/.exec(line)?.[1].length ?? 0) / unit)
    let body = line.trim()

    // Encabezado de frente: sin viñeta, sin sangría, termina en «:».
    if (indent === 0 && !BULLET.test(body) && /:\s*$/.test(body) && !STATUS.some(([re]) => re.test(body))) {
      const name = frontName(body.replace(/^#+\s*/, '').replace(/:\s*$/, ''))
      if (name && name.length <= 60) {
        close()
        group = { front: name, nodes: [] }
        continue
      }
    }

    body = body.replace(BULLET, '')
    let status: OutlineStatus = 'pendiente'
    for (const [re, st] of STATUS)
      if (re.test(body)) {
        status = st
        body = body.replace(re, '')
        break
      }
    body = body.trim()
    if (!body) continue
    group.nodes.push({ title: body, status, depth: 0, question: /[¿?]/.test(body) })
    raw.push(indent)
  }
  close()
  return groups
}

/** Resumen para la vista previa. */
export function outlineStats(groups: OutlineGroup[]) {
  const nodes = groups.flatMap((g) => g.nodes)
  return {
    fronts: groups.filter((g) => g.front).length,
    tasks: nodes.length,
    cancelled: nodes.filter((n) => n.status === 'cancelada').length,
    questions: nodes.filter((n) => n.question).length,
  }
}
