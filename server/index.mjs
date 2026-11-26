// Servidor local de FARO: sirve la interfaz compilada y la API que lee y escribe faro.json.
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './store.mjs'
import { createReader } from './reader.mjs'
import { context, instructions, queryDecisions, registerDecision } from './agent.mjs'

const MAX_BODY = 50 * 1024 * 1024
// Carpeta de la app de FARO: la interfaz la usa para dar comandos exactos (p. ej. copiar las plantillas).
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const send = (res, status, body, headers = {}) => {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body)
  res.writeHead(status, { 'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(isJson ? JSON.stringify(body) : body)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 }))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      let text
      try {
        // Estricto: si llegan bytes que no son UTF-8 (p. ej. PowerShell 5.1 o una consola de Windows) se rechaza
        // en vez de guardar «�» en silencio.
        text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
      } catch {
        return reject(
          Object.assign(new Error('El cuerpo no es UTF-8 válido (los acentos llegaron en otra codificación). Guarda el JSON en un archivo UTF-8 y envíalo con curl.exe --data-binary @archivo.json, o en PowerShell usa Invoke-RestMethod con -Body ([Text.Encoding]::UTF8.GetBytes($json)).'), { status: 400 }),
        )
      }
      try {
        resolve(JSON.parse(text || 'null'))
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function serveStatic(staticDir, pathname, res) {
  if (!staticDir || !fs.existsSync(path.join(staticDir, 'index.html'))) {
    return send(res, 200, 'FARO: falta la interfaz compilada. Ejecuta «pnpm build» (o usa «pnpm dev» para desarrollo).')
  }
  let target = path.normalize(path.join(staticDir, decodeURIComponent(pathname)))
  const relative = path.relative(path.resolve(staticDir), target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return send(res, 403, 'Prohibido')
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(staticDir, 'index.html')
  const ext = path.extname(target)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable' })
  fs.createReadStream(target).pipe(res)
}

export function createApp({ store, staticDir, reader = null, readOnly = false }) {
  return http.createServer(async (req, res) => {
    try {
      const { pathname, searchParams } = new URL(req.url, 'http://localhost')
      if (readOnly) {
        if (req.method !== 'GET') return send(res, 405, { error: 'Solo lectura' })
        const match = pathname.match(/^\/api\/reader\/([a-f0-9]{48})$/)
        if (match) {
          const doc = reader.get(match[1])
          return doc ? send(res, 200, doc) : send(res, 404, { error: 'El enlace venció, fue revocado o FARO se reinició.' })
        }
        if (pathname.startsWith('/api/')) return send(res, 404, { error: 'No existe' })
        if (!/^\/read\/[a-f0-9]{48}$/.test(pathname) && !pathname.startsWith('/assets/')) return send(res, 404, 'No existe')
        res.setHeader('Referrer-Policy', 'no-referrer')
        return serveStatic(staticDir, pathname, res)
      }
      // el puerto real del servidor (no el del proxy de Vite en desarrollo)
      const base = `http://localhost:${req.socket.localPort}`
      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método no permitido')
        return serveStatic(staticDir, pathname, res)
      }
      const route = `${req.method} ${pathname}`
      if (pathname.startsWith('/api/reader')) {
        if (!reader || reader.error) return send(res, 503, { error: reader?.error || 'El lector móvil no está disponible.' })
        // Las operaciones de compartir solo se aceptan desde la interfaz local.
        const origin = req.headers.origin
        if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return send(res, 403, { error: 'Origen no permitido' })
        if (route === 'POST /api/reader') return send(res, 200, reader.save(await readJson(req)))
        const token = pathname.match(/^\/api\/reader\/([a-f0-9]{48})$/)?.[1]
        if (req.method === 'DELETE' && token) { reader.remove(token); return send(res, 200, { ok: true }) }
        return send(res, 404, { error: 'No existe' })
      }
      if (route === 'GET /api/health') return send(res, 200, { ok: true, file: store.file, appDir: APP_DIR })
      if (route === 'GET /api/db') {
        const { rev, db, file, error } = store.snapshot()
        return send(res, 200, { rev, db, file, error })
      }
      if (route === 'GET /api/rev') return send(res, 200, store.rev())
      if (route === 'PUT /api/db') {
        const body = await readJson(req)
        if (!body || !Number.isInteger(body.rev) || !body.db) return send(res, 400, { error: 'Se esperaba { rev, db }' })
        const r = store.put(body.rev, body.db)
        return r.conflict ? send(res, 409, { error: 'Los datos cambiaron en el servidor', rev: r.rev }) : send(res, 200, r)
      }
      // API para agentes de IA (ver docs/diseno-conexion.md)
      // «project» es el nombre anterior de «repository»: se sigue aceptando.
      const repository = searchParams.get('repository') ?? searchParams.get('project')
      if (route === 'GET /api/agent/context') return send(res, 200, context(store.snapshot().db, { repository }))
      if (route === 'GET /api/agent/decisions')
        return send(res, 200, queryDecisions(store.snapshot().db, { repository, front: searchParams.get('front'), state: searchParams.get('state') }))
      if (route === 'GET /api/agent/instructions')
        return send(res, 200, instructions(store.snapshot().db, { repository, base }), { 'Content-Type': 'text/markdown; charset=utf-8' })
      if (route === 'POST /api/agent/decisions') {
        const body = await readJson(req)
        const out = store.mutate((db) => registerDecision(db, body))
        return send(res, out.status, out.body)
      }
      if (route === 'POST /api/import') {
        const body = await readJson(req)
        return send(res, 200, store.import(body))
      }
      return send(res, 404, { error: 'No existe' })
    } catch (e) {
      send(res, e.status || 400, { error: e.message, ...(e.extra || {}) })
    }
  })
}

// Arranque directo: node server/index.mjs
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const port = Number(process.env.FARO_PORT) || 4317
  const dir = path.resolve(process.env.FARO_DATA_DIR || path.join(os.homedir(), '.faro'))
  fs.mkdirSync(dir, { recursive: true })
  let store
  try {
    store = createStore({ dir })
  } catch (e) {
    console.error(`\nFARO no pudo iniciar: ${e.message}\n`)
    process.exit(1)
  }
  const staticDir = path.resolve(here, '..', 'dist')
  const reader = createReader({ port: Number(process.env.FARO_READER_PORT) || port + 1 })
  const mobile = createApp({ reader, staticDir, readOnly: true })
  mobile.on('error', (e) => {
    reader.error = `No se pudo abrir el lector Wi-Fi en el puerto ${reader.port}: ${e.message}`
    console.error(reader.error)
  })
  mobile.listen(reader.port, '0.0.0.0', () => console.log(`Lector Wi-Fi en el puerto ${reader.port} (solo lectura)`))
  const server = createApp({ store, staticDir, reader })
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `\nEl puerto ${port} ya está en uso. ¿FARO ya está corriendo? (o define FARO_PORT)\n` : e)
    process.exit(1)
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(`FARO en http://localhost:${port}\nDatos: ${store.file}`)
  })
}
