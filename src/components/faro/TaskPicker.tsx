import { useState } from 'react'
import { CornerDownRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { flatTasks, isCancelled, useFaro } from '@/lib/faro'

/** Busca una tarea (principal o subtarea) de cualquier frente. Las canceladas nunca salen; las hechas solo con `includeDone`. */
export function TaskPicker({
  label, onPick, exclude = [], includeDone = false,
}: { label: string; onPick: (taskId: string) => void; exclude?: string[]; includeDone?: boolean }) {
  const { db } = useFaro()
  const [open, setOpen] = useState(false)
  const groups = open
    ? db.fronts
        .map((f) => ({
          front: f,
          items: flatTasks(f.id).filter(({ task: t }) => !exclude.includes(t.id) && !isCancelled(t) && (includeDone || t.status !== 'hecha')),
        }))
        .filter((g) => g.items.length)
    : []
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,92vw)] p-0">
        <Command>
          <CommandInput placeholder="Buscar tarea en todos los frentes…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No hay tareas que coincidan.</CommandEmpty>
            {groups.map(({ front, items }) => (
              <CommandGroup key={front.id} heading={front.name}>
                {items.map(({ task: t, label: path, depth }) => (
                  <CommandItem key={t.id} value={`${front.name} ${path} ${t.id}`} onSelect={() => onPick(t.id)} style={{ paddingLeft: 8 + depth * 14 }}>
                    {depth > 0 && <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate">{t.title || '(sin título)'}</span>
                    <span className="eyebrow shrink-0">{depth === 0 ? 'principal' : 'subtarea'}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
