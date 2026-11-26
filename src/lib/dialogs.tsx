import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Opts = {
  title: string
  text?: string
  field?: { value?: string; placeholder?: string; multiline?: boolean; readonly?: boolean }
  okText?: string
  hideCancel?: boolean
  danger?: boolean
}
type Result = { ok: boolean; value: string }

type Api = {
  /** Pide un texto; devuelve null si se cancela. */
  askText: (title: string, value?: string, placeholder?: string, multiline?: boolean) => Promise<string | null>
  confirm: (title: string, text?: string, danger?: boolean) => Promise<boolean>
  info: (title: string, text: string) => Promise<void>
  copyText: (text: string) => void
}

const Ctx = createContext<Api | null>(null)
export const useDialogs = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('DialogsProvider ausente')
  return c
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null)
  const [value, setValue] = useState('')
  const resolver = useRef<((r: Result) => void) | null>(null)
  const valueRef = useRef('')

  const open = useCallback(
    (o: Opts) =>
      new Promise<Result>((resolve) => {
        resolver.current = resolve
        valueRef.current = o.field?.value ?? ''
        setValue(valueRef.current)
        setOpts(o)
      }),
    [],
  )
  const close = (ok: boolean) => {
    resolver.current?.({ ok, value: valueRef.current })
    resolver.current = null
    setOpts(null)
  }

  const manualCopy = (t: string) =>
    open({ title: 'Copia este texto', field: { value: t, multiline: true, readonly: true }, okText: 'Cerrar', hideCancel: true })

  const api: Api = {
    askText: (title, v = '', placeholder = '', multiline = false) =>
      open({ title, field: { value: v, placeholder, multiline }, okText: 'Guardar' }).then((r) => (r.ok ? r.value : null)),
    confirm: (title, text = '', danger = false) =>
      open({ title, text, danger, okText: danger ? 'Eliminar' : 'Continuar' }).then((r) => r.ok),
    info: (title, text) => open({ title, text, okText: 'Cerrar', hideCancel: true }).then(() => undefined),
    copyText: (t) => {
      if (navigator.clipboard && window.isSecureContext)
        navigator.clipboard.writeText(t).then(() => toast.success('Copiado')).catch(() => void manualCopy(t))
      else void manualCopy(t)
    },
  }

  const f = opts?.field
  return (
    <Ctx.Provider value={api}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <DialogContent
          className="max-w-md"
          onOpenAutoFocus={(e) => {
            if (!f) return
            e.preventDefault()
            const el = (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>('[data-dialog-field]')
            el?.focus()
            if (f.readonly) el?.select()
          }}
        >
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              close(true)
            }}
          >
            <DialogHeader>
              <DialogTitle>{opts?.title}</DialogTitle>
              {opts?.text ? <DialogDescription>{opts.text}</DialogDescription> : <DialogDescription className="sr-only">{opts?.title}</DialogDescription>}
            </DialogHeader>
            {f &&
              (f.multiline ? (
                <Textarea
                  data-dialog-field
                  aria-label={opts?.title}
                  className="min-h-40 font-mono text-[13px]"
                  value={value}
                  readOnly={f.readonly}
                  placeholder={f.placeholder}
                  onChange={(e) => {
                    valueRef.current = e.target.value
                    setValue(e.target.value)
                  }}
                />
              ) : (
                <Input
                  data-dialog-field
                  aria-label={opts?.title}
                  value={value}
                  readOnly={f.readonly}
                  placeholder={f.placeholder}
                  onChange={(e) => {
                    valueRef.current = e.target.value
                    setValue(e.target.value)
                  }}
                />
              ))}
            <DialogFooter className="gap-2 sm:gap-2">
              {!opts?.hideCancel && (
                <Button type="button" variant="outline" onClick={() => close(false)}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" variant={opts?.danger ? 'destructive' : 'default'}>
                {opts?.okText ?? 'Aceptar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}
