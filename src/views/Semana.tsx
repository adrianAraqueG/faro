import { ClipboardCopy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useDialogs } from '@/lib/dialogs'
import { metrics, planIds, setWeekField, tasksOf, useFaro, weekReport, weekStart, type WeekField } from '@/lib/faro'
import { Callout, Empty, Field, PageHeader, Section } from '@/components/faro/bits'

export function Semana({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { db } = useFaro()
  const { copyText } = useDialogs()
  const m = metrics(date)
  const wk = weekStart(date)
  const w = db.weeks[wk] || {}
  const field = (k: WeekField) => ({ id: k, value: w[k] ?? '', onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setWeekField(date, k, e.target.value) })

  const stats: [number, string, 'ink' | 'danger' | 'ok' | 'tide'][] = [
    [m.verified, 'Verificados técnicos (total)', 'tide'],
    [m.accepted, 'Aceptados (total)', 'ok'],
    [m.high, 'Decisiones críticas abiertas', m.high ? 'danger' : 'ink'],
    [m.blocked, 'Tareas bloqueadas', m.blocked ? 'danger' : 'ink'],
  ]
  const risky = m.high || m.blocked || m.review

  return (
    <>
      <PageHeader
        eyebrow={`Semana del ${wk}`}
        title="Evidencias y revisión semanal"
        desc="No es una puntuación de rendimiento personal. Es un inventario de evidencias, trabajo pendiente y riesgo."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="weekDate" className="eyebrow">Semana de</label>
            <Input id="weekDate" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto font-mono text-[13px]" />
          </div>
        }
      />

      <dl className="mb-12 grid grid-cols-2 border-y-2 border-ink lg:grid-cols-4">
        {stats.map(([v, l, tone], i) => (
          <div key={l} className={cn('px-1 py-4 sm:px-5', i > 0 && 'lg:border-l lg:border-border', i % 2 === 1 && 'border-l border-border lg:border-l', i > 1 && 'border-t border-border lg:border-t-0')}>
            <dd className={cn('tnum font-display text-5xl font-semibold leading-none', tone === 'danger' && 'text-danger', tone === 'ok' && 'text-ok', tone === 'tide' && 'text-tide')}>{v}</dd>
            <dt className="eyebrow mt-2.5 leading-snug">{l}</dt>
          </div>
        ))}
      </dl>

      <div className="grid gap-x-16 gap-y-16 min-[1400px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Section title="Cierre de la semana">
          <div className="grid gap-3.5">
            <Field label="Lo concretado y su evidencia" htmlFor="weekDone"><Textarea {...field('weekDone')} className="min-h-24" /></Field>
            <Field label="Bloqueos y riesgos" htmlFor="weekRisks"><Textarea {...field('weekRisks')} className="min-h-24" /></Field>
            <Field label="Prioridad del lunes" htmlFor="weekNext"><Textarea {...field('weekNext')} /></Field>
            <div>
              <Button variant="beam" onClick={() => copyText(weekReport(date))}>
                <ClipboardCopy /> Copiar resumen semanal
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Lectura del lanzamiento">
          <div className="grid gap-4 text-[15px] leading-relaxed">
            <p>
              <b className="tnum font-display text-lg">{m.confirmed}</b> tareas verificables marcadas como alcance confirmado ·{' '}
              <b className="tnum font-display text-lg">{m.candidate}</b> candidatos pendientes de priorización.
            </p>
            <p>
              <b className="tnum font-display text-lg">{m.high}</b> decisiones abiertas de alto impacto ·{' '}
              <b className="tnum font-display text-lg">{m.blocked}</b> tareas bloqueadas.
            </p>
            {m.review > 0 && (
              <p>
                <b className="tnum font-display text-lg text-danger">{m.review}</b> tareas requieren revisión porque el PO cambió un supuesto.
              </p>
            )}
            <Callout tone={risky || m.confirmed === 0 ? 'warn' : 'tide'}>
              {m.confirmed === 0
                ? 'No hay alcance mínimo confirmado registrado. La fecha no puede evaluarse con rigor.'
                : risky
                  ? 'Existen dependencias o bloqueos que deben revisarse antes de asumir que el lanzamiento está encaminado.'
                  : 'Sin bloqueos críticos registrados; aún debes contrastar esfuerzo restante y capacidad disponible.'}
            </Callout>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <h3 className="font-display text-base font-semibold leading-snug">Sin alcance mínimo confirmado, no existe un porcentaje de avance confiable</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Como sustituto provisional, identifica candidatos, confirmaciones del PO, verificaciones técnicas y decisiones críticas. Luego estima el esfuerzo restante solo del alcance acordado.
            </p>
          </div>
        </Section>
      </div>

      <Section title="Historial de cierres diarios de la semana" className="mt-12">
        {m.days.length ? (
          <ol className="grid gap-0">
            {m.days.map(([k, d]) => (
              <li key={k} className="grid gap-x-5 gap-y-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)]">
                <time className="tnum font-mono text-[12.5px] font-medium">{k}</time>
                <div className="text-sm leading-snug">
                  <p className="text-muted-foreground"><span className="eyebrow mr-2">Plan</span>{tasksOf(planIds(d)).map((t) => t.title).join(' · ') || 'Sin plan'}</p>
                  <p className="mt-1"><span className="eyebrow mr-2">Logrado</span>{tasksOf(d.achieved).map((t) => t.title).join(' · ') || 'Sin cierre'}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>Todavía no hay cierres diarios registrados para esta semana.</Empty>
        )}
      </Section>
    </>
  )
}
