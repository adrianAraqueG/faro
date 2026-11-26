import { useEffect, useRef, useState } from 'react'
import { Markdown } from '@/components/faro/Markdown'
import { Button } from '@/components/ui/button'

export function MobileReader() {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')
  const doc = useRef<HTMLDivElement>(null)
  const [headings, setHeadings] = useState<{ id: string; text: string }[]>([])
  async function refresh() {
    setBusy(true)
    setError('')
    try {
      const token = window.location.pathname.split('/')[2]
      const response = await fetch(`/api/reader/${token}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setText(data.text)
      setUpdatedAt(data.updatedAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar. Comprueba la conexión Wi-Fi y que FARO siga encendido.')
    } finally { setBusy(false) }
  }
  useEffect(() => {
    const frame = requestAnimationFrame(() => { void refresh() })
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    const nodes = Array.from(doc.current?.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]') ?? [])
    const frame = requestAnimationFrame(() => setHeadings(nodes.map((h) => ({ id: h.id, text: h.textContent || '' }))))
    document.title = `${nodes[0]?.textContent || 'Lectura móvil'} · FARO`
    return () => cancelAnimationFrame(frame)
  }, [text])
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div><p className="font-display text-xl font-semibold">FARO · Lectura móvil</p>
          <p className="text-xs text-muted-foreground">{updatedAt ? `Actualizado: ${new Date(updatedAt).toLocaleString('es-CO')}` : 'Documento compartido por Wi-Fi'}</p></div>
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>{busy ? 'Cargando…' : 'Actualizar contenido'}</Button>
      </header>
      {error && <p role="alert" className="mb-5 rounded border p-4 text-sm">{error}{text && ' Puedes seguir leyendo el contenido que ya cargaste.'}</p>}
      {headings.length > 1 && <details className="mb-6 rounded border p-3"><summary className="cursor-pointer font-semibold">Contenido</summary>
        <nav className="mt-3 grid gap-2">{headings.map((h) => <a className="text-sm underline" key={h.id} href={`#${h.id}`}>{h.text}</a>)}</nav>
      </details>}
      <article ref={doc} className="min-w-0 rounded border bg-card px-4 py-6 sm:p-10"><Markdown variant="reader">{text}</Markdown></article>
    </main>
  )
}
