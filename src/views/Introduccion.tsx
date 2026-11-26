import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, Section } from '@/components/faro/bits'

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-body leading-relaxed text-muted-foreground">{children}</p>
    </div>
  )
}

export function Introduccion({ go }: { go: (tab: string) => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Guía de inicio"
        title="Introducción"
        desc="FARO es tu sistema personal de ejecución: ordena en qué trabajas, qué harás cada día y qué lograste, todo en un solo lugar que vive en tu computador."
      />

      <div className="grid max-w-3xl gap-14">
        <Section title="La idea en corto" hint="Tres niveles, de mayor a menor.">
          <ul className="grid gap-3 text-body leading-relaxed">
            <li><strong>Frente:</strong> una gran área de trabajo (Contabilidad, ERP en Efactura…).</li>
            <li><strong>Tarea:</strong> un trabajo dentro de un frente. Puede tener subtareas con la profundidad que necesites.</li>
            <li><strong>Día:</strong> cada mañana eliges tareas de tus frentes para hoy, y al cerrar registras lo que lograste.</li>
          </ul>
        </Section>

        <Section title="Hoy" aside={<Button variant="outline" size="sm" onClick={() => go('hoy')}>Abrir Hoy <ArrowRight /></Button>}>
          <div className="grid gap-6">
            <Item title="Qué vamos a hacer">Planeas el día con tareas que ya existen en «Frentes», separadas en principal y secundario. No se escribe texto aparte: lo que planeas es lo mismo que gestionas.</Item>
            <Item title="En curso">Muestra todo lo que tienes empezado ahora mismo, sin importar el frente.</Item>
            <Item title="Qué logramos">Al cerrar el día añades las tareas que terminaste (con un botón puedes traer las que cerraste ese día) y dejas una nota para tu próximo día de trabajo: dónde quedaste y el primer paso.</Item>
            <Item title="Reporte del día">Con un clic copias un resumen del plan y los logros, listo para pegar donde lo necesites.</Item>
          </div>
        </Section>

        <Section title="Frentes" aside={<Button variant="outline" size="sm" onClick={() => go('frentes')}>Abrir Frentes <ArrowRight /></Button>}>
          <div className="grid gap-6">
            <Item title="Un esquema por frente">Cada frente es un esquema de tareas, como un bloc de notas. Puedes añadir frentes y tareas a mano o pegar un texto con sangrías y usar «Importar texto» para crear varias de una vez.</Item>
            <Item title="Estados">Cada tarea está pendiente, en curso, bloqueada, hecha o cancelada. Se cambia con un clic sobre su círculo, y el avance del frente se calcula solo.</Item>
            <Item title="General">Es el frente de las tareas sueltas: pendientes que no pertenecen a un frente en particular. Siempre existe.</Item>
          </div>
        </Section>

        <Section title="Utilidades">
          <div className="grid gap-6">
            <Item title="Lector de markdown">Pega el markdown que te dio una IA (o abre un archivo .md) y léelo con formato y un índice. También puedes compartir una copia temporal para leerla en el teléfono por Wi-Fi. Solo guarda un borrador: al pegar otro texto reemplaza el anterior.</Item>
            <Item title="Reuniones">Escribe libremente mientras estás en una reunión. A diferencia del lector, cada reunión se guarda en un historial que puedes volver a abrir. Pasar sus tareas a los frentes con ayuda de la IA aún no está desarrollado.</Item>
          </div>
        </Section>

        <p className="text-body text-muted-foreground">
          ¿Trabajas con agentes de IA en tus repositorios?{' '}
          <button onClick={() => go('guia')} className="font-semibold text-foreground underline underline-offset-4 hover:text-tide">
            Aprende a conectarlos con FARO
          </button>
          .
        </p>
      </div>
    </>
  )
}
