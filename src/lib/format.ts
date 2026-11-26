/** Formato de fechas y números. Usa el idioma del navegador (sin forzar uno), por eso `locale` va siempre `undefined`. */
const day = (d: string) => new Date(d + 'T12:00:00')

/** `2026-11-25` → «miércoles, 25 de noviembre» */
export const longDate = (d: string) => day(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/** `2026-11-25` → «mié, 25 nov 2026» */
export const shortDate = (d: string) => day(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Marca de tiempo ISO → fecha y hora cortas. */
export const dateTime = (at: string | number | Date) => new Date(at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

/** Marca de tiempo → fecha y hora completas. */
export const dateTimeFull = (at: string | number | Date) => new Date(at).toLocaleString()

export const timeOfDay = (at: Date) => at.toLocaleTimeString()

export const num = (n: number) => n.toLocaleString()
