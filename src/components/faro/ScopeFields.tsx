import { Checkbox } from '@/components/ui/checkbox'
import { flatTasks, useFaro } from '@/lib/faro'
import { Field, Pick } from './bits'

/** Alcance de una decisión: su frente, una tarea de ese frente (opcional) y los repositorios afectados; el primero es el principal. */
export type ScopeValue = { frontId: string; taskId: string; projectIds: string[] }

export function ScopeFields({ value, onChange }: { value: ScopeValue; onChange: (v: ScopeValue) => void }) {
  const { db } = useFaro()
  const primary = value.projectIds[0] ?? ''
  const others = value.projectIds.slice(1)
  const front = db.fronts.find((f) => f.id === value.frontId)
  const tasks = flatTasks(value.frontId)

  // El vínculo repositorio × frente se crea solo al guardar; avisamos cuando va a nacer uno nuevo.
  const newLinks = front
    ? value.projectIds
        .map((id) => db.projects.find((p) => p.id === id))
        .filter((p) => p && !db.links.some((l) => l.projectId === p.id && l.frontId === front.id))
    : []

  return (
    <div className="grid gap-4">
      <Field label="Frente">
        <Pick
          label="Frente"
          value={value.frontId}
          onChange={(frontId) => onChange({ ...value, frontId, taskId: db.tasks.some((t) => t.id === value.taskId && t.frontId === frontId) ? value.taskId : '' })}
          options={db.fronts.map((f) => ({ value: f.id, label: f.name }))}
        />
      </Field>
      <Field label="Tarea o subtarea (opcional)">
        <Pick
          label="Tarea"
          value={value.taskId}
          onChange={(taskId) => onChange({ ...value, taskId })}
          options={[{ value: '', label: tasks.length ? 'Sin tarea concreta' : 'Este frente aún no tiene tareas' }, ...tasks.map((t) => ({ value: t.task.id, label: t.label }))]}
        />
      </Field>
      <Field label="Repositorio principal">
        <Pick
          label="Repositorio principal"
          value={primary}
          onChange={(p) => onChange({ ...value, projectIds: p ? [p, ...others.filter((x) => x !== p)] : [] })}
          options={[{ value: '', label: db.projects.length ? 'Ninguno' : 'Aún no hay repositorios' }, ...db.projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
      </Field>
      {primary && db.projects.length > 1 && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">También afecta a</legend>
          {db.projects
            .filter((p) => p.id !== primary)
            .map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={others.includes(p.id)}
                  onCheckedChange={(on) => onChange({ ...value, projectIds: [primary, ...(on === true ? [...others, p.id] : others.filter((x) => x !== p.id))] })}
                />
                {p.name}
              </label>
            ))}
        </fieldset>
      )}
      {newLinks.length > 0 && front && (
        <p className="font-mono text-[11.5px] leading-snug text-muted-foreground">
          Se vinculará el frente «{front.name}» con {newLinks.map((p) => `«${p!.name}»`).join(', ')}.
        </p>
      )}
    </div>
  )
}
