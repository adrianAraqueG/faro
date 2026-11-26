import { useState } from 'react'
import { ArrowLeft, Eye, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Callout, Chip, PageHeader, Section, StatusIcon, type Tone } from '@/components/faro/bits'
import type { TaskStatus } from '@/lib/faro'
import { longDate } from '@/lib/format'

/*
 * DEMO — vista del «dueño» (ver docs/vista-dueno.md).
 * Todo el contenido es de ejemplo y vive en este archivo: no lee ni escribe `faro.json`, no usa el servidor
 * y no toca el resto de la aplicación. Se puede borrar junto con su pestaña en App.tsx sin dejar rastro.
 */

type DTask = { title: string; status: TaskStatus; done?: number; total?: number }
type DFront = { name: string; progress: number; tasks: DTask[] }
type DDay = { date: string; achieved: string[]; note?: string }
type Employee = {
  id: string
  name: string
  role: string
  photo?: string
  fronts: DFront[]
  today: { primary: DTask[]; secondary: DTask[] }
  history: DDay[]
  lastActive: string
}

const EMPLOYEES: Employee[] = [
  {
    id: 'mv',
    photo: '/demo/maria.jpg',
    name: 'María Valdés',
    role: 'Dirección comercial',
    lastActive: 'hace 12 min',
    fronts: [
      {
        name: 'Alianza con distribuidores',
        progress: 60,
        tasks: [
          { title: 'Propuesta de condiciones a Distrimax', status: 'curso', done: 3, total: 5 },
          { title: 'Reunión de cierre con Andina Retail', status: 'pendiente' },
          { title: 'Contrato marco revisado por legal', status: 'hecha' },
        ],
      },
      {
        name: 'Plan comercial 2027',
        progress: 25,
        tasks: [
          { title: 'Metas por zona', status: 'curso', done: 1, total: 4 },
          { title: 'Presupuesto de ferias', status: 'bloqueada' },
        ],
      },
    ],
    today: {
      primary: [
        { title: 'Propuesta de condiciones a Distrimax', status: 'curso', done: 3, total: 5 },
        { title: 'Reunión de cierre con Andina Retail', status: 'pendiente' },
      ],
      secondary: [{ title: 'Metas por zona', status: 'curso', done: 1, total: 4 }],
    },
    history: [
      { date: '2026-11-18', achieved: ['Contrato marco revisado por legal', 'Llamada de seguimiento a 3 clientes'], note: 'Falta la tabla de descuentos por volumen antes de enviar a Distrimax.' },
      { date: '2026-11-17', achieved: ['Borrador de condiciones comerciales'] },
      { date: '2026-11-14', achieved: ['Visita a Andina Retail', 'Lista de zonas priorizadas'], note: 'Presupuesto de ferias bloqueado: espero la cifra de finanzas.' },
    ],
  },
  {
    id: 'jr',
    photo: '/demo/julian.jpg',
    name: 'Julián Restrepo',
    role: 'Operaciones y logística',
    lastActive: 'hace 2 h',
    fronts: [
      {
        name: 'Nueva bodega norte',
        progress: 80,
        tasks: [
          { title: 'Traslado de inventario fase 2', status: 'curso', done: 4, total: 6 },
          { title: 'Instalación de estanterías', status: 'hecha' },
          { title: 'Permiso de bomberos', status: 'hecha' },
        ],
      },
      {
        name: 'Proveedores de transporte',
        progress: 40,
        tasks: [
          { title: 'Comparativo de tarifas', status: 'curso', done: 2, total: 3 },
          { title: 'Negociar contrato anual', status: 'pendiente' },
        ],
      },
      {
        name: 'General',
        progress: 0,
        tasks: [{ title: 'Renovar seguro de flota', status: 'pendiente' }],
      },
    ],
    today: {
      primary: [{ title: 'Traslado de inventario fase 2', status: 'curso', done: 4, total: 6 }],
      secondary: [
        { title: 'Comparativo de tarifas', status: 'curso', done: 2, total: 3 },
        { title: 'Renovar seguro de flota', status: 'pendiente' },
      ],
    },
    history: [
      { date: '2026-11-18', achieved: ['Traslado de inventario fase 2 (lote 1 y 2)'] },
      { date: '2026-11-17', achieved: ['Instalación de estanterías', 'Permiso de bomberos'], note: 'Mañana arranca el traslado; coordinar con el transportista a las 7:00.' },
    ],
  },
  {
    id: 'ls',
    photo: '/demo/laura.jpg',
    name: 'Laura Sánchez',
    role: 'Finanzas',
    lastActive: 'ayer',
    fronts: [
      {
        name: 'Cierre contable de noviembre',
        progress: 15,
        tasks: [
          { title: 'Conciliaciones bancarias', status: 'curso', done: 1, total: 5 },
          { title: 'Provisión de nómina', status: 'pendiente' },
        ],
      },
    ],
    today: { primary: [{ title: 'Conciliaciones bancarias', status: 'curso', done: 1, total: 5 }], secondary: [] },
    history: [{ date: '2026-11-18', achieved: ['Informe de cartera vencida'], note: 'Conciliar primero la cuenta de Bancolombia.' }],
  },
  {
    id: 'dp',
    photo: '/demo/diego.jpg',
    name: 'Diego Pardo',
    role: 'Talento humano',
    lastActive: 'hace 3 días',
    fronts: [],
    today: { primary: [], secondary: [] },
    history: [],
  },
]

const STATUS_LABEL: Record<TaskStatus, { label: string; tone: Tone }> = {
  pendiente: { label: 'Pendiente', tone: 'neutral' },
  curso: { label: 'En curso', tone: 'beam' },
  bloqueada: { label: 'Bloqueada', tone: 'danger' },
  hecha: { label: 'Hecha', tone: 'ok' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
}

const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('')

function Photo({ e, className }: { e: Employee; className?: string }) {
  return (
    <Avatar className={cn('size-14', className)}>
      {e.photo && <AvatarImage src={e.photo} alt="" />}
      <AvatarFallback className="bg-rail font-display text-lg font-semibold text-rail-foreground">{initials(e.name)}</AvatarFallback>
    </Avatar>
  )
}

function TaskRow({ t }: { t: DTask }) {
  const s = STATUS_LABEL[t.status]
  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
      <StatusIcon status={t.status} />
      <span className={cn('min-w-0 flex-1 text-body', t.status === 'hecha' && 'text-muted-foreground line-through')}>{t.title}</span>
      {t.total ? <span className="tnum font-mono text-micro text-muted-foreground">{t.done}/{t.total}</span> : null}
      <Chip tone={s.tone}>{s.label}</Chip>
    </li>
  )
}

function Lista({ tasks, empty }: { tasks: DTask[]; empty: string }) {
  return tasks.length ? <ul className="grid gap-2">{tasks.map((t) => <TaskRow key={t.title} t={t} />)}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>
}

const MAX_CHIPS = 3

function Tarjeta({ e, onOpen }: { e: Employee; onOpen: () => void }) {
  const shown = e.fronts.slice(0, MAX_CHIPS)
  const extra = e.fronts.length - shown.length
  return (
    <button
      onClick={onOpen}
      className="group flex h-[17rem] w-full flex-col gap-5 overflow-hidden rounded-md border border-border bg-card p-6 text-left transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-center gap-5">
        <Photo e={e} className="size-24" />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-semibold leading-tight">{e.name}</p>
          <p className="truncate text-sm text-muted-foreground">{e.role}</p>
        </div>
      </div>
      <div className="min-h-0">
        <p className="eyebrow mb-2">Frentes activos · {e.fronts.length}</p>
        {e.fronts.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((f) => <li key={f.name} className="max-w-full"><Chip tone="tide" className="max-w-full truncate">{f.name}</Chip></li>)}
            {extra > 0 && <li><Chip>+{extra}</Chip></li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin frentes activos.</p>
        )}
      </div>
    </button>
  )
}

const TABS = [
  { id: 'dia', label: 'Plan del día' },
  { id: 'frentes', label: 'Frentes y tareas' },
  { id: 'historial', label: 'Historial diario' },
] as const
type TabId = (typeof TABS)[number]['id']

function Detalle({ e, onBack }: { e: Employee; onBack: () => void }) {
  const [tab, setTab] = useState<TabId>('dia')
  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-6 -ml-3">
        <ArrowLeft /> Equipo
      </Button>
      <header className="mb-10 flex flex-wrap items-center gap-5 border-b border-border pb-8">
        <Photo e={e} className="size-20" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-[1.05]">{e.name}</h1>
          <p className="mt-1 text-muted-foreground">{e.role} · activo {e.lastActive}</p>
        </div>
        <Chip><Lock className="size-3" /> Solo lectura</Chip>
      </header>

      <div role="tablist" aria-label="Secciones del empleado" className="mb-10 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-body font-medium transition-colors',
              tab === t.id ? 'border-beam text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dia' && (
        <div className="grid gap-12">
          <Section title="Principal" aside={<span className="eyebrow">{e.today.primary.length} tareas</span>}>
            <Lista tasks={e.today.primary} empty="No planeó nada principal para hoy." />
          </Section>
          <Section title="Secundario" aside={<span className="eyebrow">{e.today.secondary.length} tareas</span>}>
            <Lista tasks={e.today.secondary} empty="Sin tareas secundarias." />
          </Section>
        </div>
      )}

      {tab === 'frentes' && (
        <div className="grid gap-12">
          {e.fronts.length ? (
            e.fronts.map((f) => (
              <Section key={f.name} title={f.name} aside={<span className="tnum eyebrow">{f.progress}% completado</span>}>
                <div className="mb-5 h-1.5 rounded-full bg-secondary" aria-hidden>
                  <div className="h-full rounded-full bg-beam" style={{ width: `${f.progress}%` }} />
                </div>
                <Lista tasks={f.tasks} empty="Sin tareas." />
              </Section>
            ))
          ) : (
            <p className="text-muted-foreground">No tiene frentes activos.</p>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="grid gap-10">
          {e.history.length ? (
            e.history.map((d) => (
              <Section key={d.date} title={longDate(d.date)} aside={<span className="eyebrow">{d.achieved.length} logros</span>}>
                <ul className="grid gap-2">
                  {d.achieved.map((a) => (
                    <li key={a} className="flex items-center gap-3 text-body"><StatusIcon status="hecha" /> {a}</li>
                  ))}
                </ul>
                {d.note && <Callout tone="warn" className="mt-4"><p className="eyebrow mb-1">Nota para el siguiente día</p>{d.note}</Callout>}
              </Section>
            ))
          ) : (
            <p className="text-muted-foreground">Aún no hay días registrados.</p>
          )}
        </div>
      )}
    </>
  )
}

export function Equipo() {
  const [openId, setOpenId] = useState<string | null>(null)
  const e = EMPLOYEES.find((x) => x.id === openId)
  return (
    <>
      <Callout tone="warn" className="mb-8">
        <p className="eyebrow mb-1 flex items-center gap-1.5"><Eye className="size-3.5" /> Demo</p>
        Vista del dueño con datos de ejemplo. No está conectada a FARO: nada de lo que ves aquí existe en tus datos.
      </Callout>
      {e ? (
        <Detalle e={e} onBack={() => setOpenId(null)} />
      ) : (
        <>
          <PageHeader
            eyebrow="Vista del dueño"
            title="Mi equipo"
            desc="Qué está haciendo cada persona y cómo avanzan sus frentes. Solo puedes mirar: lo que cada quien planea y hace lo gestiona cada quien."
          />
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {EMPLOYEES.map((x) => <li key={x.id}><Tarjeta e={x} onOpen={() => setOpenId(x.id)} /></li>)}
          </ul>
        </>
      )}
    </>
  )
}
