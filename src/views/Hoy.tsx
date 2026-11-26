import { ClipboardCopy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDialogs } from '@/lib/dialogs'
import {
  PLAN_GROUPS, PLAN_LABELS, addToAchieved, addToPlan, carryNote, dayReport, doneOn, flatTasks, isCancelled, planIds, removeFromAchieved,
  removeFromPlan, moveInAchieved, moveInPlan, setExtras, setTomorrow, tasksOf, useFaro,
} from '@/lib/faro'
import { Callout, Empty, Field, PageHeader, Section } from '@/components/faro/bits'
import { longDate } from '@/lib/format'
import { DayList, DayTask } from '@/components/faro/DayTask'
import { TaskPicker } from '@/components/faro/TaskPicker'


export function Hoy({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { db } = useFaro()
  const { copyText } = useDialogs()
  const d = db.days[date] || {}
  const note = carryNote(date)
  const closed = doneOn(date)
  const achieved = tasksOf(d.achieved)
  // Todo lo que está en curso ahora mismo, por frente y en orden de árbol.
  const running = db.fronts.flatMap((f) => flatTasks(f.id)).map((x) => x.task).filter((t) => t.status === 'curso' && !isCancelled(t))

  return (
    <>
      <PageHeader
        eyebrow={longDate(date)}
        title="Mi día"
        desc="Qué vamos a hacer, qué logramos y lo que está en curso. Todo sale de las tareas de «Frentes»."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="dayDate" className="eyebrow">Fecha</label>
            <Input id="dayDate" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto font-mono text-small" />
          </div>
        }
      />

      {note && (
        <Callout tone="warn" className="mb-12">
          <p className="eyebrow mb-1.5">Nota que te dejaste · {longDate(note.date)}</p>
          <p className="whitespace-pre-wrap">{note.text}</p>
        </Callout>
      )}

      <div className="grid gap-x-16 gap-y-16 min-[1400px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* En curso: lo que haces ahora, primero en móvil */}
        <div className="grid content-start gap-16 min-[1400px]:order-2">
          <Section title="En curso" aside={<span className="eyebrow">{running.length} ahora</span>}>
            {running.length ? (
              <ul className="grid gap-2.5">
                {running.map((t) => (
                  <DayTask key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <Empty>Nada en curso. Marca una tarea como «en curso» con un clic en su círculo.</Empty>
            )}
          </Section>
        </div>

        <div className="grid content-start gap-16 min-[1400px]:order-1">
          <Section title="Qué vamos a hacer" aside={<span className="eyebrow">{planIds(d).length} tareas</span>}>
            <div className="grid gap-8">
              {PLAN_GROUPS.map((g) => {
                const list = tasksOf(d.plan?.[g])
                return (
                  <div key={g} className="grid gap-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-base font-semibold">{PLAN_LABELS[g]}</h3>
                      <TaskPicker label="Añadir" exclude={planIds(d)} onPick={(id) => addToPlan(date, g, id)} />
                    </div>
                    {list.length ? (
                      <DayList tasks={list} onRemove={(id) => removeFromPlan(date, id)} onMove={(id, to) => moveInPlan(date, g, id, to)} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin tareas.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Qué logramos" aside={<span className="eyebrow">cierre</span>}>
            <div className="grid gap-5">
              <div className="grid gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <TaskPicker label="Añadir tarea" includeDone exclude={d.achieved ?? []} onPick={(id) => addToAchieved(date, [id])} />
                  {closed.length > 0 && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => addToAchieved(date, closed.map((t) => t.id))}>
                      Añadir las {closed.length} que cerré este día
                    </Button>
                  )}
                </div>
                {achieved.length ? (
                  <DayList tasks={achieved} onRemove={(id) => removeFromAchieved(date, id)} onMove={(id, to) => moveInAchieved(date, id, to)} />
                ) : (
                  <p className="text-sm text-muted-foreground">Sin tareas en el cierre.</p>
                )}
              </div>
              <Field label="Otros trabajos del día (lo que hiciste sin que fuera una tarea propia, pero que te llevó tiempo)" htmlFor="extras">
                <Textarea id="extras" value={d.extras ?? ''} onChange={(e) => setExtras(date, e.target.value)} placeholder="Ej.: apoyé a soporte con un cliente, resolví un correo urgente, reinicié el servidor de pruebas…" />
              </Field>
              <Field label="Nota para el próximo día de trabajo (dónde quedamos, primer paso)" htmlFor="tomorrow">
                <Textarea id="tomorrow" value={d.tomorrow ?? ''} onChange={(e) => setTomorrow(date, e.target.value)} />
              </Field>
              <div>
                <Button variant="beam" onClick={() => copyText(dayReport(date))}>
                  <ClipboardCopy /> Copiar reporte del día
                </Button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}
