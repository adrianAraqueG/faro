/** Opciones del menú principal que se pueden ocultar (Configuración → Menú). Lo que no está aquí no se puede ocultar. */
export const MAIN_MENU = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'frentes', label: 'Frentes' },
  { id: 'decisiones', label: 'Dudas y decisiones' },
  { id: 'repositorios', label: 'Repositorios' },
  { id: 'semana', label: 'Evidencias y semana' },
  { id: 'equipo', label: 'Mi equipo (demo)' },
] as const

const KEY = 'faro:menu-oculto'
// Preferencia de este navegador: es de interfaz, no va a la base de FARO ni a los respaldos.
export function loadHidden(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((id) => MAIN_MENU.some((m) => m.id === id)) : []
  } catch {
    return []
  }
}
export function storeHidden(ids: string[]) {
  try {
    if (ids.length) window.localStorage.setItem(KEY, JSON.stringify(ids))
    else window.localStorage.removeItem(KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}
