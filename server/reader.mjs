import { randomBytes } from 'node:crypto'
import os from 'node:os'

export function createReader({ port = 4318 } = {}) {
  const documents = new Map()
  const lifetime = 24 * 60 * 60 * 1000
  const get = (token) => {
    const doc = documents.get(token)
    if (doc && doc.expiresAt <= Date.now()) { documents.delete(token); return undefined }
    return doc
  }
  return {
    port,
    error: null,
    get,
    remove: (token) => documents.delete(token),
    save(body) {
      if (!body || typeof body.text !== 'string' || !body.text.trim()) throw new Error('Pega un documento antes de compartirlo.')
      if (Buffer.byteLength(body.text, 'utf8') > 5_000_000) throw new Error('El documento supera los 5 MB.')
      for (const token of documents.keys()) get(token)
      if (body.token && !get(body.token)) throw new Error('El enlace venció o fue revocado. Genera otro enlace.')
      if (!body.token && documents.size >= 100) throw new Error('Hay demasiados documentos compartidos. Revoca un enlace antes de crear otro.')
      const token = body.token || randomBytes(24).toString('hex')
      const doc = { text: body.text, updatedAt: new Date().toISOString(), expiresAt: Date.now() + lifetime }
      documents.set(token, doc)
      return { token, updatedAt: doc.updatedAt, expiresAt: doc.expiresAt, urls: this.urls(token) }
    },
    urls(token) {
      return [...new Set(Object.values(os.networkInterfaces()).flat().filter((n) => n && !n.internal && n.family === 'IPv4').map((n) => n.address))]
        // Priorizar la LAN doméstica frente a adaptadores virtuales como WSL/Hyper-V.
        .sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')))
        .map((address) => `http://${address}:${this.port}/read/${token}`)
    },
  }
}
