// Almacén de FARO: un único faro.json con escritura atómica, revisiones y copias de respaldo rotativas.
import fs from 'node:fs'
import path from 'node:path'
import { CURRENT, fresh, migrate, validate } from './migrate.mjs'

const BACKUP_EVERY_MS = 10 * 60 * 1000
const BACKUP_KEEP = 30

const stamp = (d = new Date()) => {
  const p = (n, l = 2) => String(n).padStart(l, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function createStore({ dir }) {
  const file = path.join(dir, 'faro.json')
  const backups = path.join(dir, 'backups')
  fs.mkdirSync(backups, { recursive: true })

  let db = null
  let rev = 0
  let mtimeMs = 0
  let lastBackupAt = 0
  let lastError = null

  function backup(tag = '') {
    if (!fs.existsSync(file)) return
    const name = `faro-${stamp()}${tag ? '-' + tag : ''}.json`
    fs.copyFileSync(file, path.join(backups, name))
    lastBackupAt = Date.now()
    const all = fs.readdirSync(backups).filter((f) => /^faro-.*\.json$/.test(f)).sort()
    for (const old of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) fs.rmSync(path.join(backups, old), { force: true })
  }

  /** Escritura atómica: archivo temporal y renombrado, con reintentos por bloqueos de antivirus en Windows. */
  function write() {
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify({ v: db.v, rev, ...db }, null, 2) + '\n', 'utf8')
    for (let i = 0; ; i++) {
      try {
        fs.renameSync(tmp, file)
        break
      } catch (e) {
        if (i >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 * (i + 1))
      }
    }
    mtimeMs = fs.statSync(file).mtimeMs
  }

  function readDisk() {
    let raw
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      throw new Error(`No se pudo leer ${file}: ${e.message}. Las copias están en ${backups}`)
    }
    const { db: next, from } = migrate(raw)
    return { next, from, fileRev: Number.isInteger(raw.rev) ? raw.rev : 0 }
  }

  // Arranque: crear, leer o migrar. Si el archivo es ilegible no se toca: es preferible no arrancar a perder datos.
  if (!fs.existsSync(file)) {
    db = fresh()
    rev = 1
    write()
  } else {
    const { next, from, fileRev } = readDisk()
    db = next
    rev = Math.max(fileRev, 1)
    if (from < CURRENT) {
      backup(`pre-v${from}`)
      rev++
      write()
    } else {
      mtimeMs = fs.statSync(file).mtimeMs
      backup('inicio')
    }
  }

  /** Si el archivo cambió fuera del servidor (edición manual, restauración), lo recarga. */
  function refresh() {
    let st
    try {
      st = fs.statSync(file)
    } catch {
      lastError = `No existe ${file}`
      return
    }
    if (st.mtimeMs === mtimeMs) return
    mtimeMs = st.mtimeMs
    try {
      const { next, from, fileRev } = readDisk()
      db = next
      rev = Math.max(rev + 1, fileRev)
      lastError = null
      if (from < CURRENT) backup(`pre-v${from}`)
      write() // normaliza el archivo con la revisión nueva
    } catch (e) {
      lastError = e.message // se conserva lo que hay en memoria hasta que el archivo vuelva a ser válido
    }
  }

  return {
    file,
    backups,
    snapshot() {
      refresh()
      return { rev, db, file, error: lastError }
    },
    rev() {
      refresh()
      return { rev, error: lastError }
    },
    /** Reemplaza la base completa si el cliente tenía la revisión vigente. */
    put(clientRev, next) {
      refresh()
      if (clientRev !== rev) return { conflict: true, rev }
      validate(next)
      if (Date.now() - lastBackupAt > BACKUP_EVERY_MS) backup()
      db = structuredClone(next)
      rev++
      write()
      return { rev }
    },
    /**
     * Aplica un cambio hecho por el servidor (p. ej. un agente). `fn` recibe una copia de trabajo y devuelve
     * `{ changed, ... }`; solo se persiste si `changed`. Si `fn` lanza, no se escribe nada.
     */
    mutate(fn) {
      refresh()
      const draft = structuredClone(db)
      const out = fn(draft)
      if (out.changed) {
        validate(draft)
        if (Date.now() - lastBackupAt > BACKUP_EVERY_MS) backup()
        db = draft
        rev++
        write()
      }
      return { ...out, rev }
    },
    /** Importa un respaldo de cualquier versión soportada; guarda una copia de lo que había. */
    import(raw) {
      refresh()
      const { db: next } = migrate(raw)
      backup('pre-importar')
      db = next
      rev++
      write()
      return { rev, db, file }
    },
  }
}
