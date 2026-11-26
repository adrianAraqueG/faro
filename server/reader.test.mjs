import test from 'node:test'
import assert from 'node:assert/strict'
import { createReader } from './reader.mjs'
import { createApp } from './index.mjs'

test('lectura móvil: compartir, actualizar, aislamiento de API, revocar y caducar', async () => {
  const reader = createReader()
  const local = createApp({ reader, staticDir: null })
  const mobile = createApp({ reader, readOnly: true, staticDir: null })
  await Promise.all([local, mobile].map((s) => new Promise((resolve) => s.listen(0, '127.0.0.1', resolve))))
  const request = (server, route, options) => fetch(`http://127.0.0.1:${server.address().port}${route}`, options)
  try {
    const publish = async (text, token) => {
      const response = await request(local, '/api/reader', { method: 'POST', body: JSON.stringify({ text, token }) })
      assert.equal(response.status, 200)
      return response.json()
    }
    const shared = await publish('# Café\n\nInformación privada del documento.')
    assert.match(shared.token, /^[a-f0-9]{48}$/)
    const read = () => request(mobile, `/api/reader/${shared.token}`)
    assert.equal((await (await read()).json()).text, '# Café\n\nInformación privada del documento.')
    const updated = await publish('# Nueva versión', shared.token)
    assert.equal(updated.token, shared.token)
    assert.equal((await (await read()).json()).text, '# Nueva versión')
    for (const route of ['/api/db', '/api/health', '/api/agent/context', '/', '/other']) {
      assert.equal((await request(mobile, route)).status, 404)
    }
    for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await request(mobile, '/api/reader', { method })).status, 405)
    assert.equal((await request(local, '/api/reader', { method: 'POST', headers: { origin: 'http://untrusted.example' }, body: '{}' })).status, 403)
    assert.equal((await request(local, `/api/reader/${shared.token}`, { method: 'DELETE' })).status, 200)
    assert.equal((await read()).status, 404)
    const expired = await publish('# Temporal')
    reader.get(expired.token).expiresAt = Date.now() - 1
    assert.equal((await request(mobile, `/api/reader/${expired.token}`)).status, 404)
    assert.equal((await request(local, '/api/reader', { method: 'POST', body: JSON.stringify({ text: ' ' }) })).status, 400)
    assert.throws(() => reader.save({ text: 'x'.repeat(5_000_001) }), /5 MB/)
  } finally {
    await Promise.all([local, mobile].map((s) => new Promise((resolve) => s.close(resolve))))
  }
})
