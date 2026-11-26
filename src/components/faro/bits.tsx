import type { ReactNode } from 'react'
import { Ban, Circle, CircleCheck, CircleDot, CircleX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TaskStatus } from '@/lib/faro'

/** Encabezado de vista: ojo mono, título grande a la izquierda y acciones a la derecha. */
export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow: string; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <header className="mb-12 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-b border-border pb-9">
      <div className="max-w-2xl">
        <p className="eyebrow mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-block h-px w-6 bg-beam" />
          {eyebrow}
        </p>
        <h1 className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-[1.05]">{title}</h1>
        {desc && <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Sección sin caja: título con regla superior; contenido libre. */
export function Section({
  title, aside, hint, children, className,
}: { title: string; aside?: ReactNode; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border-t-2 border-ink pt-5', className)}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {aside}
      </div>
      {hint && <p className="-mt-3 mb-6 max-w-prose text-[15px] leading-relaxed text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold leading-snug">
        {label}
      </Label>
      {children}
    </div>
  )
}

const tones = {
  neutral: 'bg-secondary text-secondary-foreground',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  beam: 'bg-beam text-beam-ink',
  tide: 'bg-tide-soft text-tide',
}
export type Tone = keyof typeof tones

/** Etiqueta tipo "ticket": esquinas casi rectas, mono, mayúsculas pequeñas. */
export function Chip({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-[2px] px-1.5 py-[3px] font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.06em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Icono del estado de una tarea: círculo vacío, punto (en curso), marca (hecha), prohibido (bloqueada) o tachado (cancelada). */
export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const c = cn('size-[18px] shrink-0', className)
  if (status === 'hecha') return <CircleCheck className={cn(c, 'text-ok')} />
  if (status === 'curso') return <CircleDot className={cn(c, 'text-beam')} />
  if (status === 'bloqueada') return <Ban className={cn(c, 'text-danger')} />
  if (status === 'cancelada') return <CircleX className={cn(c, 'text-muted-foreground/70')} />
  return <Circle className={cn(c, 'text-muted-foreground/70')} />
}

/** Aviso lateral con barra de color a la izquierda. */
export function Callout({ tone = 'tide', children, className }: { tone?: 'tide' | 'warn' | 'ok' | 'danger'; children: ReactNode; className?: string }) {
  const t = {
    tide: 'border-tide bg-tide-soft text-ink',
    warn: 'border-beam bg-beam-soft text-beam-ink',
    ok: 'border-ok bg-ok-soft text-ok',
    danger: 'border-danger bg-danger-soft text-danger',
  }[tone]
  return <div className={cn('rounded-r-[3px] border-l-[3px] px-4 py-3 text-[15px] leading-relaxed', t, className)}>{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="hatch rounded-[3px] border border-dashed px-5 py-10 text-center text-[15px] text-muted-foreground">{children}</div>
}

/** Selector con opciones planas o agrupadas. `''` se mapea a un valor centinela (Radix no admite vacío). */
export type Opt = { value: string; label: string }
export type OptGroup = { label: string; options: Opt[] }
const NONE = '__none__'
export function Pick({
  value, onChange, options, groups, label, placeholder, className, id, triggerClassName,
}: {
  value: string
  onChange: (v: string) => void
  options?: Opt[]
  groups?: OptGroup[]
  label: string
  placeholder?: string
  className?: string
  triggerClassName?: string
  id?: string
}) {
  const enc = (v: string) => (v === '' ? NONE : v)
  return (
    <div className={className}>
      <Select value={value === '' && !options?.some((o) => o.value === '') ? undefined : enc(value)} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
        <SelectTrigger id={id} aria-label={label} className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options?.map((o) => (
            <SelectItem key={o.value} value={enc(o.value)}>
              {o.label}
            </SelectItem>
          ))}
          {groups?.map((g) => (
            <div key={g.label}>
              <div className="px-2 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{g.label}</div>
              {g.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
