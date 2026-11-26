import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { BookOpen, BookOpenText, CalendarCheck, ChevronDown, Download, Eye, FolderGit2, Layers, Loader2, Scale, ServerOff, Settings, Sunrise, TriangleAlert, UsersRound, Upload, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { DialogsProvider, useDialogs } from '@/lib/dialogs'
import { timeOfDay } from '@/lib/format'
import { exportData, importBackup, iso, isCancelled, isOpenDecision, loadFaro, readBackup, startSync, useFaro } from '@/lib/faro'
import { Hoy } from '@/views/Hoy'
import { Frentes } from '@/views/Frentes'
import { Decisiones } from '@/views/Decisiones'
import { Repositorios } from '@/views/Repositorios'
import { Guia } from '@/views/Guia'
import { Introduccion } from '@/views/Introduccion'
import { Semana } from '@/views/Semana'
import { Lector } from '@/views/Lector'
import { Equipo } from '@/views/Equipo'
import { Reuniones } from '@/views/Reuniones'
import { Configuracion } from '@/views/Configuracion'
import { MAIN_MENU, loadHidden, storeHidden } from '@/lib/menu'

const TABS = ['hoy', 'frentes', 'repositorios', 'decisiones', 'semana', 'equipo', 'lector', 'reuniones', 'introduccion', 'guia', 'configuracion'] as const
type Tab = (typeof TABS)[number]
const fromHash = (): Tab => {
  const raw = window.location.hash.slice(1)
  const h = (raw === 'proyectos' ? 'repositorios' : raw) as Tab // «Proyectos» se llamaba así antes
  return TABS.includes(h) ? h : 'hoy'
}

/** Menús desplegables de la barra lateral y las pestañas que contienen. «guia» es «Conectar repos» (el nombre se conserva por los enlaces). */
const GROUPS = [
  { id: 'utilidades', label: 'Utilidades', icon: <Wrench />, tabs: ['lector', 'reuniones'] },
  { id: 'guia', label: 'Guía de inicio', icon: <BookOpen />, tabs: ['introduccion', 'guia'] },
] as const
const groupOf = (t: string) => GROUPS.find((g) => (g.tabs as readonly string[]).includes(t))?.id

/** Marca: torre + haz. */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M0 11.5 13.6 14.4v3.2L0 20.5z" fill="hsl(var(--beam))" opacity=".5" />
      <path d="M18.4 14.4 32 11.5v9l-13.6-2.9z" fill="hsl(var(--beam))" opacity=".5" />
      <path d="M16 3.5l2.2 4.2h-4.4z" fill="hsl(var(--beam))" />
      <path d="M13.6 8.4h4.8l2.6 21.6H11z" fill="currentColor" />
      <rect x="12.4" y="13.6" width="7.2" height="4.4" fill="hsl(var(--beam))" />
    </svg>
  )
}

function Shell() {
  const { db, save, online, file } = useFaro()
  const { confirm, info } = useDialogs()
  const [hidden, setHiddenState] = useState(loadHidden)
  const setHidden = (ids: string[]) => {
    setHiddenState(ids)
    storeHidden(ids)
  }
  // Sin enlace directo, se abre la primera opción del menú que siga visible.
  const [tab, setTab] = useState<Tab>(() => {
    const t = fromHash()
    if (window.location.hash.slice(1)) return t
    return (MAIN_MENU.find((m) => !hidden.includes(m.id))?.id ?? 'hoy') as Tab
  })
  const [day, setDay] = useState(iso())
  const [week, setWeek] = useState(iso())
  const importer = useRef<HTMLInputElement>(null)
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const g = groupOf(fromHash())
    return g ? [g] : []
  })
  const reveal = (t: Tab) => {
    const g = groupOf(t)
    if (g) setOpenGroups((o) => (o.includes(g) ? o : [...o, g]))
  }

  useEffect(() => {
    const on = () => {
      const t = fromHash()
      setTab(t)
      reveal(t)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (t: Tab) => {
    setTab(t)
    reveal(t)
    try {
      window.history.replaceState(null, '', '#' + t)
    } catch {
      /* iframes sin acceso al historial */
    }
    window.scrollTo({ top: 0 })
  }

  // en Frentes: cuántas tareas hay en curso, y alerta si alguna requiere revisión
  const openTasks = db.tasks.filter((t) => t.status === 'curso' && !isCancelled(t)).length
  const reviewCount = db.tasks.filter((t) => t.needsReview && !isCancelled(t)).length
  const pendingDec = db.decisions.filter(isOpenDecision).length
  const highDec = db.decisions.filter((d) => isOpenDecision(d) && d.impact === 'alto').length

  const nav: { id: Tab; label: string; short: string; icon: ReactNode; count?: number; alert?: boolean; mobile?: boolean; group?: 'utilidades' | 'guia' }[] = [
    { id: 'hoy', label: 'Hoy', short: 'Hoy', icon: <Sunrise /> },
    { id: 'frentes', label: 'Frentes', short: 'Frentes', icon: <Layers />, count: openTasks, alert: reviewCount > 0 },
    { id: 'decisiones', label: 'Dudas y decisiones', short: 'Decisiones', icon: <Scale />, count: pendingDec, alert: highDec > 0 },
    { id: 'repositorios', label: 'Repositorios', short: 'Repos', icon: <FolderGit2 /> },
    { id: 'semana', label: 'Evidencias y semana', short: 'Semana', icon: <CalendarCheck /> },
    { id: 'equipo', label: 'Mi equipo (demo)', short: 'Equipo', icon: <Eye />, mobile: false },
    { id: 'lector', label: 'Lector de markdown', short: 'Lector', icon: <BookOpenText />, mobile: false, group: 'utilidades' },
    { id: 'reuniones', label: 'Reuniones', short: 'Reuniones', icon: <UsersRound />, mobile: false, group: 'utilidades' },
    { id: 'introduccion', label: 'Introducción', short: 'Intro', icon: <BookOpenText />, mobile: false, group: 'guia' },
    { id: 'guia', label: 'Conectar repos', short: 'Conectar', icon: <FolderGit2 />, mobile: false, group: 'guia' },
    { id: 'configuracion', label: 'Configuración', short: 'Ajustes', icon: <Settings />, mobile: false },
  ]

  const menu = nav.filter((n) => !hidden.includes(n.id))

  const navButton = (n: (typeof nav)[number]) => {
    const on = tab === n.id
    return (
      <button
        onClick={() => go(n.id)}
        aria-current={on ? 'page' : undefined}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-md px-3.5 py-3 text-left text-body transition-colors [&_svg]:size-[18px] [&_svg]:shrink-0',
          on ? 'bg-rail-line text-rail-foreground' : 'text-rail-muted hover:bg-rail-line/60 hover:text-rail-foreground',
        )}
      >
        <span aria-hidden className={cn('absolute inset-y-1.5 left-0 w-[3px] rounded-r-sm transition-colors', on ? 'bg-beam' : 'bg-transparent')} />
        {n.icon}
        <span className="flex-1 font-medium">{n.label}</span>
        {n.count ? (
          <span className={cn('tnum rounded-sm px-1.5 py-0.5 font-mono text-micro leading-none', n.alert ? 'bg-danger text-white' : 'bg-rail-line text-rail-foreground')}>
            {n.count}
          </span>
        ) : null}
      </button>
    )
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = await readBackup(file)
      if (!(await confirm('Reemplazar los datos actuales', 'Esto sustituirá todo lo que hay ahora en FARO. Antes se guarda una copia automática.'))) return
      await importBackup(data)
      toast.success('Copia importada')
    } catch (err) {
      void info('No se pudo importar', err instanceof Error ? err.message : 'Formato no válido')
    }
  }

  const status =
    save.kind === 'error'
      ? 'No se pudo guardar: reintentando…'
      : save.kind === 'saving'
        ? 'Guardando…'
        : save.at
          ? `Guardado · ${timeOfDay(save.at)}`
          : 'Datos cargados del servidor'

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[18.5rem_minmax(0,1fr)]">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-rail text-rail-foreground lg:flex">
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <Mark className="size-9 text-rail-foreground" />
          <div className="leading-none">
            <p className="font-display text-[28px] font-semibold lowercase tracking-[-0.03em]">faro</p>
            <p className="mt-1.5 font-mono text-micro uppercase tracking-[0.14em] text-rail-muted">v3.0 · ejecución personal</p>
          </div>
        </div>

        <nav aria-label="Secciones" className="flex-1 px-3">
          <ul className="grid gap-1">
            {menu.filter((n) => !n.group).map((n) => (
              <Fragment key={n.id}>
                {n.id === 'configuracion' && (
                  <li className="mt-4 border-t border-rail-line pt-4">
                    <ul className="grid gap-1">
                      {GROUPS.map((g) => {
                        const items = menu.filter((x) => x.group === g.id)
                        const isOpen = openGroups.includes(g.id)
                        return (
                          <li key={g.id}>
                            <button
                              onClick={() => setOpenGroups((o) => (o.includes(g.id) ? o.filter((x) => x !== g.id) : [...o, g.id]))}
                              aria-expanded={isOpen}
                              aria-controls={`menu-${g.id}`}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md px-3.5 py-3 text-left text-body transition-colors hover:bg-rail-line/60 hover:text-rail-foreground [&_svg]:size-[18px] [&_svg]:shrink-0',
                                groupOf(tab) === g.id && !isOpen ? 'text-rail-foreground' : 'text-rail-muted',
                              )}
                            >
                              {g.icon}
                              <span className="flex-1 font-medium">{g.label}</span>
                              <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} />
                            </button>
                            {isOpen && (
                              <ul id={`menu-${g.id}`} className="ml-5 mt-1 grid gap-1 border-l border-rail-line pl-2">
                                {items.map((x) => (
                                  <li key={x.id}>{navButton(x)}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )}
                <li>{navButton(n)}</li>
              </Fragment>
            ))}
          </ul>
        </nav>

        <div className="border-t border-rail-line px-5 py-4">
          <div role="status" title={file} className="mb-3 flex items-start gap-2 text-caption leading-snug text-rail-muted">
            {save.kind !== 'error' ? (
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-ok-soft" />
            ) : (
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-beam" />
            )}
            {status}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportData} className="flex items-center justify-center gap-1.5 rounded-md border border-rail-line px-2 py-2 text-caption text-rail-foreground transition-colors hover:bg-rail-line">
              <Download className="size-3.5" /> Exportar
            </button>
            <button onClick={() => importer.current?.click()} className="flex items-center justify-center gap-1.5 rounded-md border border-rail-line px-2 py-2 text-caption text-rail-foreground transition-colors hover:bg-rail-line">
              <Upload className="size-3.5" /> Importar
            </button>
          </div>
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-rail px-4 py-3 text-rail-foreground lg:hidden">
        <div className="flex items-center gap-2.5">
          <Mark className="size-7" />
          <span className="font-display text-2xl font-semibold lowercase leading-none tracking-[-0.03em]">faro</span>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => go('lector')} aria-label="Lector de markdown" className="rounded-md border border-rail-line p-2 hover:bg-rail-line"><BookOpenText className="size-4" /></button>
          <button onClick={() => go('configuracion')} aria-label="Configuración" className="rounded-md border border-rail-line p-2 hover:bg-rail-line"><Settings className="size-4" /></button>
          <button onClick={() => go('introduccion')} aria-label="Guía de inicio" className="rounded-md border border-rail-line p-2 hover:bg-rail-line"><BookOpen className="size-4" /></button>
          <button onClick={exportData} aria-label="Exportar copia JSON" className="rounded-md border border-rail-line p-2 hover:bg-rail-line"><Download className="size-4" /></button>
          <button onClick={() => importer.current?.click()} aria-label="Importar copia" className="rounded-md border border-rail-line p-2 hover:bg-rail-line"><Upload className="size-4" /></button>
        </div>
      </div>
      <input ref={importer} hidden type="file" accept="application/json" onChange={(e) => void onImport(e)} />

      {!online && (
        <div role="alert" className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-danger px-4 py-2 text-center text-sm font-medium text-white lg:left-[18.5rem]">
          <ServerOff className="size-4 shrink-0" />
          FARO perdió la conexión con su servidor local: tus cambios no se están guardando. Reintentando…
        </div>
      )}
      <main className="min-w-0 px-5 pb-32 pt-10 sm:px-10 lg:px-16 lg:pb-28 lg:pt-16">
        <div className={cn('mx-auto', tab === 'equipo' ? 'max-w-[1560px]' : 'max-w-[1120px]')} key={tab}>
          <div className="animate-rise">
            {tab === 'hoy' && <Hoy date={day} setDate={setDay} />}
            {tab === 'frentes' && <Frentes day={day} />}
            {tab === 'repositorios' && <Repositorios go={(t) => go(t as Tab)} />}
            {tab === 'introduccion' && <Introduccion go={(t) => go(t as Tab)} />}
            {tab === 'guia' && <Guia go={(t) => go(t as Tab)} />}
            {tab === 'decisiones' && <Decisiones />}
            {tab === 'lector' && <Lector />}
            {tab === 'equipo' && <Equipo />}
            {tab === 'reuniones' && <Reuniones />}
            {tab === 'configuracion' && <Configuracion hidden={hidden} setHidden={setHidden} />}
            {tab === 'semana' && <Semana date={week} setDate={setWeek} />}
          </div>
          <p className="mt-16 border-t border-border pt-4 font-mono text-micro text-muted-foreground lg:hidden" role="status">{status}</p>
        </div>
      </main>

      {/* Navegación inferior (móvil) */}
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 grid border-t border-rail-line bg-rail text-rail-foreground lg:hidden" style={{ gridTemplateColumns: `repeat(${menu.filter((n) => n.mobile !== false).length}, minmax(0, 1fr))` }}>
        {menu.filter((n) => n.mobile !== false).map((n) => {
          const on = tab === n.id
          return (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              aria-current={on ? 'page' : undefined}
              className={cn('relative flex flex-col items-center gap-1 px-1 pb-3 pt-2.5 text-micro font-medium [&_svg]:size-5', on ? 'text-rail-foreground' : 'text-rail-muted')}
            >
              <span aria-hidden className={cn('absolute inset-x-5 top-0 h-[3px] rounded-b-sm', on ? 'bg-beam' : 'bg-transparent')} />
              {n.icon}
              {n.short}
              {n.count ? <span className={cn('tnum absolute right-[18%] top-1.5 rounded-sm px-1 py-px font-mono text-micro leading-none', n.alert ? 'bg-danger text-white' : 'bg-rail-line')}>{n.count}</span> : null}
            </button>
          )
        })}
      </nav>
      <Toaster position="bottom-right" />
    </div>
  )
}

/** Pantalla completa para los estados previos a tener datos. */
function Gate({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-rail px-6 text-rail-foreground">
      <div className="max-w-md">
        <Mark className="mb-6 size-12" />
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const { status } = useFaro()
  useEffect(() => {
    void loadFaro()
    return startSync()
  }, [])

  if (status === 'loading')
    return (
      <Gate>
        <p className="flex items-center gap-3 font-display text-2xl font-semibold">
          <Loader2 className="size-5 animate-spin text-beam" /> Conectando con FARO…
        </p>
      </Gate>
    )
  if (status === 'outdated')
    return (
      <Gate>
        <h1 className="font-display text-3xl font-semibold leading-tight">FARO se actualizó</h1>
        <p className="mt-3 leading-relaxed text-rail-muted">
          Esta pestaña tiene una versión anterior de la interfaz y los datos ya cambiaron de formato. Recárgala para continuar; no se perdió nada.
        </p>
        <button onClick={() => window.location.reload()} className="mt-6 rounded-md bg-beam px-5 py-2.5 font-semibold text-beam-ink hover:bg-beam/85">
          Recargar
        </button>
      </Gate>
    )
  if (status === 'offline')
    return (
      <Gate>
        <h1 className="font-display text-3xl font-semibold leading-tight">FARO no está encendido</h1>
        <p className="mt-3 leading-relaxed text-rail-muted">
          La interfaz no pudo conectar con el servidor local, que es quien guarda tus datos. Inícialo y reintenta:
        </p>
        <pre className="mt-4 rounded-md border border-rail-line bg-black/30 px-4 py-3 font-mono text-sm">pnpm start</pre>
        <button onClick={() => void loadFaro()} className="mt-6 rounded-md bg-beam px-5 py-2.5 font-semibold text-beam-ink hover:bg-beam/85">
          Reintentar
        </button>
      </Gate>
    )
  return (
    <DialogsProvider>
      <Shell />
    </DialogsProvider>
  )
}
