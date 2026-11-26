import { useEffect, useState, type ReactNode } from 'react'
import { Circle, CircleCheck, ClipboardCopy, FileText, FlaskConical, Plug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import * as T from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'
import { getAgentContext, getAgentInstructions, getHealth, postAgentDecision } from '@/lib/api'
import { useDialogs } from '@/lib/dialogs'
import { useFaro } from '@/lib/faro'
import { Callout, Chip, Pick, PageHeader } from '@/components/faro/bits'
import { Markdown } from '@/components/faro/Markdown'
import convenciones from '../../docs/convenciones.md?raw'
import problemas from '../../docs/solucion-problemas.md?raw'

// Los archivos reales del repositorio de FARO son la única fuente: lo que ves aquí es lo que copias.
// (Vite exige las opciones escritas literalmente en cada llamada.)
const templates = import.meta.glob('../../templates/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const examples = import.meta.glob('../../examples/erp-api/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const tpl = (name: string) => templates[`../../templates/${name}`] ?? ''

const EXAMPLE_ORDER = ['AGENTS.md', 'CLAUDE.md', 'docs/erp-en-efactura/index.md', 'docs/erp-en-efactura/plan.md', 'docs/erp-en-efactura/progreso.md']
const exampleFiles = EXAMPLE_ORDER.map((p) => ({ path: p, content: examples[`../../examples/erp-api/${p}`] ?? '' }))

const SELECT_NONE = ''

export function Guia({ go }: { go: (tab: string) => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Conectar un repositorio a FARO"
        desc="Todo lo necesario para que un repositorio y sus agentes de IA trabajen con FARO: pasos con tu estado real, el ejemplo de un repositorio ya configurado y las convenciones."
      />
      <T.Root defaultValue="setup">
        <T.List className="tabs-line">
          {[
            ['setup', 'Setup'],
            ['ejemplo', 'Ejemplo de repositorio'],
            ['convenciones', 'Convenciones'],
            ['fallas', 'Si algo falla'],
          ].map(([v, l]) => (
            <T.Trigger key={v} value={v} className="tab-line">
              {l}
            </T.Trigger>
          ))}
        </T.List>
        <T.Content value="setup">
          <Setup go={go} />
        </T.Content>
        <T.Content value="ejemplo">
          <Ejemplo />
        </T.Content>
        <T.Content value="convenciones">
          <Markdown>{convenciones}</Markdown>
        </T.Content>
        <T.Content value="fallas">
          <Markdown>{problemas}</Markdown>
        </T.Content>
      </T.Root>
    </>
  )
}

/* ---------- Piezas ---------- */
function CodeBlock({ text, label }: { text: string; label?: string }) {
  const { copyText } = useDialogs()
  return (
    <div className="relative">
      <pre className="max-h-[28rem] overflow-auto rounded-md bg-rail p-4 pr-14 font-mono text-caption leading-relaxed text-rail-foreground">{text}</pre>
      <Button
        size="icon"
        variant="ghost"
        aria-label={label ?? 'Copiar'}
        title={label ?? 'Copiar'}
        className="absolute right-2 top-2 size-8 text-rail-muted hover:bg-rail-line hover:text-rail-foreground"
        onClick={() => copyText(text)}
      >
        <ClipboardCopy className="!size-4" />
      </Button>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-6 gap-y-4 border-t-2 border-ink pt-5 md:grid-cols-[3.5rem_minmax(0,1fr)]">
      <p className="tnum font-display text-5xl font-semibold leading-none text-beam">{n}</p>
      <div className="grid min-w-0 content-start gap-4">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  )
}
const P = ({ children }: { children: ReactNode }) => <p className="max-w-3xl text-body leading-relaxed">{children}</p>
const Code = ({ children }: { children: ReactNode }) => <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>

/* ---------- Setup ---------- */
function Setup({ go }: { go: (tab: string) => void }) {
  const { db } = useFaro()
  const { copyText } = useDialogs()
  const [selected, setSelected] = useState('')
  const [appDir, setAppDir] = useState('')
  const [agentsBlock, setAgentsBlock] = useState('')

  const project = db.projects.find((p) => p.id === selected) ?? db.projects[0]
  const linked = project ? db.links.filter((l) => l.projectId === project.id).map((l) => db.fronts.find((f) => f.id === l.frontId)).filter((f) => !!f) : []
  const slugs = linked.length ? linked.map((f) => f!.slug) : ['<slug-del-frente>']
  // frente con el que se hace la decisión de prueba: el primero vinculado, o «General»
  const testFront = linked[0]?.slug ?? 'general'
  const agentDecisions = project ? db.decisions.filter((d) => d.origin && d.projectIds.includes(project.id)) : []
  const base = typeof window === 'undefined' ? 'http://localhost:4317' : window.location.origin

  useEffect(() => {
    getHealth()
      .then(({ body }) => setAppDir(body.appDir ?? ''))
      .catch(() => setAppDir(''))
  }, [])

  // El bloque de FARO lo genera el servidor (con el repositorio y sus frentes); se vuelve a pedir si cambian los vínculos.
  const linkKey = linked.map((f) => f!.slug).join(',')
  useEffect(() => {
    let alive = true
    getAgentInstructions(project?.name)
      .then((t) => alive && setAgentsBlock(t))
      .catch(() => alive && setAgentsBlock(''))
    return () => {
      alive = false
    }
  }, [project?.name, linkKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const agentsTemplate = tpl('AGENTS.md')
  const head = agentsTemplate.slice(0, Math.max(0, agentsTemplate.indexOf('<!-- faro:inicio'))).replace('# <NOMBRE DEL REPOSITORIO>', `# ${project?.name ?? '<NOMBRE DEL REPOSITORIO>'}`)
  const agentsFile = head + agentsBlock

  const checks: { label: string; detail: string; done: boolean; action?: [string, string] }[] = [
    { label: 'FARO responde', detail: 'Estás viendo esta pantalla, así que el servidor local está encendido.', done: true },
    {
      label: 'El repositorio existe y tiene su ruta',
      detail: project ? (project.path ? `«${project.name}» en ${project.path}` : `«${project.name}» no tiene ruta todavía.`) : 'Crea el repositorio con el nombre que usarán los agentes.',
      done: !!project && !!project.path,
      action: ['Ir a Repositorios', 'repositorios'],
    },
    {
      label: 'El repositorio está vinculado a un frente',
      detail: linked.length ? `Vinculado a: ${linked.map((f) => f!.name).join(', ')}` : 'Usa «Vincular un frente» en la tarjeta del repositorio.',
      done: linked.length > 0,
      action: ['Ir a Repositorios', 'repositorios'],
    },
    {
      label: 'Un agente ya registró una decisión',
      detail: agentDecisions.length ? `${agentDecisions.length} registrada(s) por: ${[...new Set(agentDecisions.map((d) => d.origin))].join(', ')}` : 'Se completa solo al usar un agente (o con la decisión de prueba del paso 4).',
      done: agentDecisions.length > 0,
    },
  ]
  const doneCount = checks.filter((c) => c.done).length

  return (
    <div className="grid gap-14">
      {/* Estado */}
      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Tu configuración</p>
            <h2 className="font-display text-2xl font-semibold">
              <span className="tnum">{doneCount}</span> de {checks.length} listo
            </h2>
          </div>
          {db.projects.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="eyebrow">Repositorio</span>
              <Pick
                label="Repositorio que estás configurando"
                value={project?.id ?? SELECT_NONE}
                onChange={setSelected}
                className="w-56"
                triggerClassName="h-9 text-sm"
                options={db.projects.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          )}
        </div>
        <ul className="grid gap-px overflow-hidden rounded-md border bg-border">
          {checks.map((c) => (
            <li key={c.label} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-5 py-3.5">
              {c.done ? <CircleCheck className="size-5 shrink-0 text-ok" /> : <Circle className="size-5 shrink-0 text-muted-foreground/60" />}
              <div className="min-w-0 flex-1">
                <p className={cn('text-body font-semibold leading-snug', c.done && 'text-ok')}>{c.label}</p>
                <p className="text-sm leading-snug text-muted-foreground">{c.detail}</p>
              </div>
              {!c.done && c.action && (
                <Button size="sm" variant="outline" onClick={() => go(c.action![1])}>
                  {c.action[0]}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Step n={1} title="Crea el repositorio y vincúlalo a su frente">
        <P>
          Tus <b className="font-semibold">frentes</b> (<Code>General</Code>, <Code>Contabilidad</Code>, <Code>ERP en Efactura</Code>…) viven en la pestaña <b className="font-semibold">Frentes</b>; si necesitas otro, usa <i>Añadir</i> › <i>Frente</i>. Junto a cada frente verás su <b className="font-semibold">slug</b> (<Code>erp-en-efactura</Code>): es el nombre de su carpeta <Code>docs/</Code> en el repo y no cambia aunque renombres el frente.
        </P>
        <P>
          En <b className="font-semibold">Repositorios</b> › <i>Nuevo repositorio</i> pon el nombre que usarán los agentes (<Code>erp-api</Code>) y la ruta del repo. Después, en su tarjeta, <b className="font-semibold">vincula el frente</b>: así las instrucciones salen con el slug correcto.
        </P>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => go('frentes')}>Ir a Frentes</Button>
          <Button variant="outline" size="sm" onClick={() => go('repositorios')}>Ir a Repositorios</Button>
        </div>
        <Callout className="max-w-3xl text-sm">Un repositorio puede tener varios frentes y un frente puede estar en varios repositorios: repite el vínculo las veces que haga falta.</Callout>
      </Step>

      <Step n={2} title="Pon AGENTS.md en el repositorio">
        <P>
          Es el único archivo que lee cualquier agente. {project ? <>Este es el de <Code>{project.name}</Code></> : 'Este es un ejemplo con el nombre sin rellenar'}: la cabecera sale de <Code>templates/AGENTS.md</Code> (rellena qué es el repositorio, los comandos y las convenciones) y el bloque de FARO lo genera el servidor con tu repositorio.
        </P>
        <CodeBlock text={agentsFile} label="Copiar AGENTS.md completo" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => copyText(agentsFile)} variant="beam">
            <ClipboardCopy /> Copiar AGENTS.md completo
          </Button>
          <Button onClick={() => copyText(agentsBlock)} variant="outline" disabled={!agentsBlock}>
            Copiar solo el bloque de FARO
          </Button>
        </div>
        <P>
          El bloque va entre <Code>{'<!-- faro:inicio -->'}</Code> y <Code>{'<!-- faro:fin -->'}</Code>. Si cambian las instrucciones (o el puerto), vuelve a copiarlo y <b className="font-semibold">reemplaza el bloque entero</b>.
        </P>
        <P>
          <b className="font-semibold">Claude Code:</b> crea además un <Code>CLAUDE.md</Code> con una sola línea. Codex y otros agentes leen <Code>AGENTS.md</Code> directamente; si alguno lee otro nombre, haz lo mismo.
        </P>
        <CodeBlock text="@AGENTS.md" label="Copiar contenido de CLAUDE.md" />
      </Step>

      <Step n={3} title={`Crea la carpeta docs/${slugs.length === 1 ? slugs[0] : '<frente>'}/ del frente`}>
        <P>
          Cada frente en el que trabaja el repositorio tiene su carpeta <Code>docs/&lt;slug&gt;/</Code> con tres archivos. Cópialos desde las plantillas de FARO (PowerShell, desde la raíz del repo):
        </P>
        <CodeBlock
          text={[
            project?.path ? `cd "${project.path}"` : 'cd "C:\\ruta\\al\\repo"',
            'New-Item -ItemType Directory docs -Force | Out-Null',
            ...slugs.map((s) => `Copy-Item "${appDir || 'C:\\ruta\\a\\faro-app'}\\templates\\docs\\_frente" "docs\\${s}" -Recurse`),
          ].join('\n')}
          label="Copiar comandos"
        />
        <P>
          Rellena <Code>index.md</Code> (qué es el frente aquí, sus tareas, dónde está el código). <Code>plan.md</Code> y <Code>progreso.md</Code> se van llenando con el trabajo; el agente puede mantenerlos. Estas son las plantillas:
        </P>
        <T.Root defaultValue="index">
          <T.List className="tabs-pills">
            {['index', 'plan', 'progreso'].map((f) => (
              <T.Trigger key={f} value={f} className="tab-pill">
                {f}.md
              </T.Trigger>
            ))}
          </T.List>
          {['index', 'plan', 'progreso'].map((f) => (
            <T.Content key={f} value={f} className="mt-0">
              <CodeBlock text={tpl(`docs/_frente/${f}.md`)} label={`Copiar ${f}.md`} />
            </T.Content>
          ))}
        </T.Root>
        <P>Haz commit de <Code>AGENTS.md</Code>, <Code>CLAUDE.md</Code> y <Code>docs/</Code>.</P>
      </Step>

      <Step n={4} title="Comprueba la conexión">
        <ConnectionTest project={project?.name} front={testFront} base={base} />
      </Step>

      <Step n={5} title="Haz tu primer trabajo con un agente">
        <P>Abre el repo con tu agente y dale una tarea normal; el <Code>AGENTS.md</Code> hace el resto. Por ejemplo:</P>
        <CodeBlock
          text={`Trabaja en el frente ${slugs[0]}: implementa el siguiente verificable de docs/${slugs[0]}/plan.md. Sigue las instrucciones de AGENTS.md.`}
          label="Copiar prompt"
        />
        <ol className="grid max-w-3xl list-decimal gap-2 pl-5 text-body leading-relaxed marker:font-mono">
          <li>El agente consulta las decisiones vigentes del repositorio y lee <Code>progreso.md</Code> («Retomar aquí»).</li>
          <li>Si le falta una regla de negocio y avanza con un supuesto, lo <b className="font-semibold">registra en FARO</b>; en el código solo deja el código <Code>DEC-000x</Code>.</li>
          <li>Al terminar reescribe «Retomar aquí» y añade una entrada a la bitácora.</li>
        </ol>
        <Callout tone="ok" className="max-w-3xl text-sm">
          Tú lo ves en <b className="font-semibold">Dudas y decisiones</b>: la decisión aparece sola, «en supuesto», con el chip del agente que la registró. Cuando hables con el PO, la resuelves ahí.
        </Callout>
        <div>
          <Button variant="outline" size="sm" onClick={() => go('decisiones')}>Ir a Dudas y decisiones</Button>
        </div>
      </Step>
    </div>
  )
}

/* ---------- Prueba de conexión ---------- */
function ConnectionTest({ project, front, base }: { project?: string; front: string; base: string }) {
  const [out, setOut] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const q = project ? `?repository=${encodeURIComponent(project)}` : ''

  async function probe() {
    setBusy(true)
    try {
      const { ok, body: j } = await getAgentContext(project)
      if (!ok) throw Object.assign(new Error(j.error), { options: j.options })
      const fr = j.repository?.fronts?.length ? j.repository.fronts.join(', ') : 'ninguno todavía'
      setOut({ tone: 'ok', text: project ? `FARO responde y reconoce el repositorio «${project}». Frentes vinculados: ${fr}.` : `FARO responde. Frentes: ${j.fronts.map((f: { slug: string }) => f.slug).join(', ') || 'ninguno'}.` })
    } catch (e) {
      const err = e as Error & { options?: string[] }
      setOut({ tone: 'danger', text: err.message || 'No hay respuesta del servidor.' + (err.options ? ` Opciones: ${err.options.join(', ')}` : '') })
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    if (!project) return void toast.error('Primero crea un repositorio')
    setBusy(true)
    try {
      const { ok, body: j } = await postAgentDecision({ repository: project, front, question: 'Prueba de conexión: puedes borrar esta decisión', assumption: 'Ninguno', impact: 'bajo', origin: 'prueba', key: 'prueba-conexion' })
      if (ok) toast.success(`${j.code} ${j.duplicate ? 'ya existía' : 'registrada'}`, { description: 'Bórrala en Dudas y decisiones cuando quieras.' })
      setOut(
        ok
          ? { tone: 'ok', text: `El registro funciona: ${j.code}${j.duplicate ? ' (ya existía)' : ''}. Bórrala en «Dudas y decisiones» > Eliminar.` }
          : { tone: 'danger', text: `${j.error}${j.options ? ` Opciones: ${j.options.map((o: { frontSlug?: string } | string) => (typeof o === 'string' ? o : o.frontSlug)).join(', ')}.` : ''}` },
      )
    } catch {
      setOut({ tone: 'danger', text: 'No hay respuesta del servidor.' })
    } finally {
      setBusy(false)
    }
  }

  const cmd = `curl.exe "${base}/api/agent/context${q}"`
  return (
    <>
      <P>Desde esta pantalla (sin terminal), o con los comandos de abajo:</P>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void probe()} disabled={busy}>
          <Plug /> Probar conexión
        </Button>
        <Button variant="outline" onClick={() => void sendTest()} disabled={busy || !project}>
          <FlaskConical /> Registrar decisión de prueba
        </Button>
      </div>
      {out && (
        <Callout tone={out.tone === 'ok' ? 'ok' : 'danger'} className="max-w-3xl text-sm">
          {out.text}
        </Callout>
      )}
      <P>
        La decisión de prueba pasa por el mismo camino que un agente (repositorio, frente, registro). Se crea con el origen <Code>prueba</Code> y la borras después.
      </P>
      <CodeBlock text={cmd} label="Copiar comando" />
      <P>En Windows usa <Code>curl.exe</Code> (en PowerShell, <Code>curl</Code> es otro comando). Para registrar con curl guarda el JSON en un archivo UTF-8 y envíalo con <Code>--data-binary "@decision.json"</Code>.</P>
    </>
  )
}

/* ---------- Ejemplo ---------- */
function Ejemplo() {
  const [file, setFile] = useState(exampleFiles[0].path)
  const current = exampleFiles.find((f) => f.path === file) ?? exampleFiles[0]
  const { copyText } = useDialogs()

  const tree = [
    { depth: 0, label: 'erp-api/', dir: true },
    { depth: 1, label: 'AGENTS.md', path: 'AGENTS.md' },
    { depth: 1, label: 'CLAUDE.md', path: 'CLAUDE.md' },
    { depth: 1, label: 'src/ …', dir: true, dim: true },
    { depth: 1, label: 'docs/', dir: true },
    { depth: 2, label: 'erp-en-efactura/', dir: true },
    { depth: 3, label: 'index.md', path: 'docs/erp-en-efactura/index.md' },
    { depth: 3, label: 'plan.md', path: 'docs/erp-en-efactura/plan.md' },
    { depth: 3, label: 'progreso.md', path: 'docs/erp-en-efactura/progreso.md' },
  ]

  return (
    <div className="grid gap-14">
      <section>
        <P>
          Así queda el source de un repositorio al que ya se le configuró la conexión con FARO. Es el repositorio <Code>erp-api</Code>, ligado al frente <Code>ERP en Efactura</Code> (tarea <Code>Cartera por pagar</Code>). El contenido es <b className="font-semibold">ficticio</b> pero tiene la forma real: haz clic en un archivo para verlo.
        </P>
        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Archivos del ejemplo" className="self-start rounded-md border bg-card py-2 font-mono text-small">
            <ul>
              {tree.map((t) => (
                <li key={t.label + t.depth}>
                  {t.path ? (
                    <button
                      onClick={() => setFile(t.path!)}
                      aria-current={file === t.path ? 'true' : undefined}
                      style={{ paddingLeft: `${t.depth * 14 + 14}px` }}
                      className={cn('flex w-full items-center gap-2 py-1.5 pr-3 text-left transition-colors hover:bg-accent', file === t.path && 'bg-beam-soft font-semibold')}
                    >
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      {t.label}
                    </button>
                  ) : (
                    <p style={{ paddingLeft: `${t.depth * 14 + 14}px` }} className={cn('py-1.5 pr-3 text-muted-foreground', !t.dim && 'font-semibold text-foreground')}>
                      {t.label}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Chip>{current.path}</Chip>
              <Button size="xs" variant="outline" onClick={() => copyText(current.content)}>
                <ClipboardCopy /> Copiar
              </Button>
            </div>
            <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-md border bg-card p-5 font-mono text-caption leading-relaxed">{current.content}</pre>
          </div>
        </div>
        <Callout className="mt-6 max-w-3xl text-sm">
          Fíjate en dos cosas: las decisiones aparecen solo por su código (<Code>DEC-0001</Code>), y <Code>progreso.md</Code> cuenta qué se hizo sin afirmar que algo está verificado: eso solo se dice en FARO.
        </Callout>
      </section>

      <section className="border-t-2 border-ink pt-5">
        <h2 className="mb-3 font-display text-2xl font-semibold">Un repositorio con varios frentes</h2>
        <P>
          Si <Code>contabilidad</Code> trabaja en dos frentes a la vez, cada uno tiene su carpeta y se vincula por separado en FARO. Al registrar una decisión, el agente indica el frente; si es ambiguo, FARO responde con las opciones.
        </P>
        <div className="mt-4">
          <CodeBlock
            text={`contabilidad/
├── AGENTS.md
├── CLAUDE.md
└── docs/
    ├── cartera/                  ← frente «Cartera»
    │   ├── index.md
    │   ├── plan.md
    │   └── progreso.md
    └── informacion-exogena/      ← frente «Información exógena»
        ├── index.md
        ├── plan.md
        └── progreso.md`}
            label="Copiar estructura"
          />
        </div>
      </section>
    </div>
  )
}
