import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { MAIN_MENU } from '@/lib/menu'
import { PageHeader, Section } from '@/components/faro/bits'

export function Configuracion({ hidden, setHidden }: { hidden: string[]; setHidden: (ids: string[]) => void }) {
  const shown = MAIN_MENU.length - hidden.length
  const toggle = (id: string, visible: boolean) => setHidden(visible ? hidden.filter((h) => h !== id) : [...hidden, id])

  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Configuración" desc="Cómo se ve FARO en este navegador." />
      <Section
        title="Menú"
        aside={<span className="eyebrow">{shown} de {MAIN_MENU.length} visibles</span>}
        hint="Oculta las opciones del menú principal que no uses. Solo cambia lo que se ve: no borra datos y puedes volver a mostrarlas aquí. La preferencia se guarda en este navegador."
        className="max-w-3xl"
      >
        <ul className="divide-y divide-border border-y border-border">
          {MAIN_MENU.map((m) => {
            const visible = !hidden.includes(m.id)
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 py-3.5">
                <label htmlFor={`menu-${m.id}`} className="flex-1 cursor-pointer text-body font-medium">{m.label}</label>
                <span className="eyebrow">{visible ? 'Visible' : 'Oculta'}</span>
                {/* Siempre debe quedar al menos una opción visible */}
                <Switch id={`menu-${m.id}`} checked={visible} disabled={visible && shown === 1} onCheckedChange={(v) => toggle(m.id, v)} />
              </li>
            )
          })}
        </ul>
        <div className="mt-5">
          <Button variant="outline" onClick={() => setHidden([])} disabled={!hidden.length}>
            <RotateCcw /> Mostrar todas
          </Button>
        </div>
      </Section>
    </>
  )
}
