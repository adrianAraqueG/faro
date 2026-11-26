import { useEffect, useRef, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useDialogs } from '@/lib/dialogs'
import { addMeeting, deleteMeeting, iso, updateMeeting, useFaro, type Meeting } from '@/lib/faro'
import { Empty, Field, PageHeader } from '@/components/faro/bits'

const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)
const isBlank = (m: Meeting) => !m.title.trim() && !m.text.trim()

export function Reuniones() {
  const { db } = useFaro()
  const { confirm } = useDialogs()
  const [selected, setSelected] = useState<string | null>(() => db.meetings[0]?.id ?? null)
  const notes = useRef<HTMLTextAreaElement>(null)
  const meetings = db.meetings
  const current = meetings.find((m) => m.id === selected) ?? null

  // Una reunión que se abrió y se dejó vacía no queda en el historial.
  const leave = () => {
    const m = meetings.find((x) => x.id === selected)
    if (m && isBlank(m)) deleteMeeting(m.id)
  }
  const open = (id: string | null) => {
    if (id === selected) return
    leave()
    setSelected(id)
  }
  const create = () => {
    if (current && isBlank(current)) return notes.current?.focus()
    leave()
    setSelected(addMeeting(iso()))
  }
  useEffect(() => {
    if (current && isBlank(current)) notes.current?.focus()
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(m: Meeting) {
    if (!(await confirm('Eliminar la reunión', `«${m.title.trim() || 'Reunión sin título'}» se borrará del historial. Esto no se puede deshacer.`, true))) return
    const next = meetings.find((x) => x.id !== m.id)
    deleteMeeting(m.id)
    setSelected(next?.id ?? null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Utilidad"
        title="Reuniones"
        desc="Escribe lo que se va diciendo mientras estás en la reunión. Cada reunión se guarda en el historial; después podrás pasar las tareas a tus frentes."
        actions={
          <Button variant="beam" onClick={create}>
            <Plus /> Nueva reunión
          </Button>
        }
      />

      {!meetings.length ? (
        <Empty>Aún no hay reuniones. Pulsa «Nueva reunión» y empieza a escribir.</Empty>
      ) : (
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Historial de reuniones" className="lg:sticky lg:top-8 lg:self-start">
            <p className="eyebrow mb-3 border-t-2 border-ink pt-4">Historial · {meetings.length}</p>
            <ul className="grid max-h-72 gap-2 overflow-y-auto lg:max-h-[calc(100dvh-8rem)]">
              {meetings.map((m) => {
                const on = m.id === selected
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => open(m.id)}
                      aria-current={on ? 'true' : undefined}
                      className={cn(
                        'relative w-full rounded-[3px] border px-4 py-3 text-left transition-colors',
                        on ? 'border-ink bg-card' : 'border-border bg-card/60 hover:border-ink/50 hover:bg-card',
                      )}
                    >
                      <span aria-hidden className={cn('absolute inset-y-1.5 left-0 w-[3px] rounded-r-[2px]', on ? 'bg-beam' : 'bg-transparent')} />
                      <span className="block truncate font-display text-base font-semibold leading-snug">{m.title.trim() || 'Reunión sin título'}</span>
                      <span className="tnum mt-0.5 block font-mono text-[11px] text-muted-foreground">
                        {shortDate(m.date)} · {wordCount(m.text)} palabras
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {current && (
            <section key={current.id} aria-label="Reunión" className="grid min-w-0 content-start gap-5 border-t-2 border-ink pt-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field label="Título" htmlFor="meetingTitle">
                  <Input id="meetingTitle" value={current.title} onChange={(e) => updateMeeting(current.id, { title: e.target.value })} placeholder="Ej.: Revisión semanal con el PO" />
                </Field>
                <Field label="Fecha" htmlFor="meetingDate">
                  <Input id="meetingDate" type="date" value={current.date} onChange={(e) => e.target.value && updateMeeting(current.id, { date: e.target.value })} className="w-auto font-mono text-[13px]" />
                </Field>
              </div>

              <Field label="Notas de la reunión" htmlFor="meetingText">
                <Textarea
                  id="meetingText"
                  ref={notes}
                  value={current.text}
                  onChange={(e) => updateMeeting(current.id, { text: e.target.value })}
                  placeholder="Escribe libremente: acuerdos, pendientes, quién hace qué…"
                  className="min-h-[26rem] leading-relaxed"
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="beam"
                    onClick={() => toast.info('Aún no está desarrollado', { description: 'Pasar las tareas a tus frentes con ayuda de la IA llegará más adelante.' })}
                  >
                    <Sparkles /> Pasar tareas a frentes
                  </Button>
                  <Button variant="danger" onClick={() => void remove(current)}>
                    <Trash2 /> Eliminar
                  </Button>
                </div>
                <p className="tnum font-mono text-[11px] text-muted-foreground">
                  {wordCount(current.text).toLocaleString('es-CO')} palabras · editada {new Date(current.updated).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}
