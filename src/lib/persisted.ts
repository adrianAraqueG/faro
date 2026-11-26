import { useCallback, useState } from 'react'

function read(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    const arr: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Conjunto de ids guardado en localStorage (preferencia de interfaz por navegador). */
export function usePersistedSet(key: string): [Set<string>, (id: string, on: boolean) => void] {
  const [set, setSet] = useState<Set<string>>(() => read(key))
  const toggle = useCallback(
    (id: string, on: boolean) =>
      setSet((prev) => {
        const next = new Set(prev)
        if (on) next.add(id)
        else next.delete(id)
        try {
          localStorage.setItem(key, JSON.stringify([...next]))
        } catch {
          /* almacenamiento no disponible: se mantiene solo en memoria */
        }
        return next
      }),
    [key],
  )
  return [set, toggle]
}
