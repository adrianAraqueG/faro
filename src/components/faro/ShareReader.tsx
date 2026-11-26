import { useState } from 'react'
import QRCode from 'qrcode'
import { Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { publishReader, revokeReader } from '@/lib/api'
import { useDialogs } from '@/lib/dialogs'

type Share = { token: string; urls: string[]; expiresAt: number }

export function ShareReader({ text }: { text: string }) {
  const { copyText } = useDialogs()
  const [open, setOpen] = useState(false)
  const [share, setShare] = useState<Share | null>(null)
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function selectUrl(value: string) {
    setUrl(value)
    setQr('')
    if (value) setQr(await QRCode.toDataURL(value, { width: 280, margin: 4, errorCorrectionLevel: 'M' }))
  }
  async function publish() {
    setBusy(true); setError('')
    try {
      const { ok, body: data } = await publishReader(text, share?.token)
      if (!ok) throw new Error(data.error)
      setShare(data)
      await selectUrl(data.urls.includes(url) ? url : data.urls[0] || '')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo compartir el documento.') }
    finally { setBusy(false) }
  }
  async function revoke() {
    if (!share) return
    setBusy(true); setError('')
    try {
      const { ok } = await revokeReader(share.token)
      if (!ok) throw new Error('No se pudo revocar el enlace.')
      setShare(null); setUrl(''); setQr('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo revocar.') }
    finally { setBusy(false) }
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => { setOpen(true); if (!share) void publish() }}><Smartphone /> Leer en el teléfono</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Leer en el teléfono</DialogTitle><DialogDescription>Conecta el teléfono a la misma Wi-Fi que este computador y escanea el QR. Mantén FARO encendido.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {busy && <p className="text-sm">Preparando…</p>}
      {share && <>
        {share.urls.length > 1 && <label className="grid gap-1 text-sm">Dirección de red<select className="w-full rounded border bg-card p-2" value={url} onChange={(e) => void selectUrl(e.target.value)}>{share.urls.map((u) => <option key={u} value={u}>{new URL(u).hostname}</option>)}</select></label>}
        {!url && <p className="text-sm">No se encontró una dirección de red. Conecta el computador a la Wi-Fi y vuelve a actualizar el enlace.</p>}
        {qr && <img src={qr} alt="Código QR para abrir el documento en el teléfono" className="mx-auto w-[280px] max-w-full" />}
        {url && <><input aria-label="Enlace de lectura" readOnly value={url} onFocus={(e) => e.target.select()} className="w-full rounded border bg-transparent p-2 text-sm" /><Button onClick={() => copyText(url)}>Copiar enlace</Button></>}
        <p className="text-xs text-muted-foreground">El enlace vence en 24 horas desde la última actualización o al reiniciar FARO. Solo comparte este texto; los cambios posteriores se envían al pulsar «Actualizar texto compartido».</p>
        <p className="text-xs text-muted-foreground">Si no abre, revisa que la red permita conectar ambos dispositivos y que el firewall permita Node.js en redes privadas. Si aparecen varias direcciones, prueba la de tu Wi-Fi.</p>
      </>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void publish()}>{share ? 'Actualizar texto compartido' : 'Generar enlace'}</Button>
        {share && <Button variant="outline" disabled={busy} onClick={() => void revoke()}>Revocar enlace</Button>}</div>
    </DialogContent></Dialog>
  </>
}
