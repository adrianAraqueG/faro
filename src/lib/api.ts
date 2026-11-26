/** Único punto de contacto con el servidor de FARO (`server/index.mjs`). Las vistas y componentes no llaman a `fetch` directamente. */
export type ApiResult<T> = { ok: boolean; status: number; body: T }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = (await r.json().catch(() => ({}))) as T
  return { ok: r.ok, status: r.status, body }
}

const withParam = (path: string, key: string, value?: string) => (value ? `${path}?${key}=${encodeURIComponent(value)}` : path)

export const getHealth = () => api<{ appDir?: string }>('/api/health')

/** Markdown con el bloque de FARO para pegar en el AGENTS.md de un repositorio. Lanza si el servidor no responde bien. */
export async function getAgentInstructions(project?: string): Promise<string> {
  const r = await fetch(withParam('/api/agent/instructions', 'project', project))
  if (!r.ok) throw new Error('No se pudieron obtener las instrucciones')
  return r.text()
}

export const getAgentContext = (repository?: string) => api(withParam('/api/agent/context', 'repository', repository))

export const postAgentDecision = (data: Record<string, unknown>) => api('/api/agent/decisions', { method: 'POST', body: JSON.stringify(data) })

export const publishReader = (text: string, token?: string) => api('/api/reader', { method: 'POST', body: JSON.stringify({ text, token }) })
export const revokeReader = (token: string) => api(`/api/reader/${token}`, { method: 'DELETE' })
export const getReader = (token: string) => api(`/api/reader/${token}`, { cache: 'no-store' })
