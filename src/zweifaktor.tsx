import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { zweifaktorStarten, zweifaktorBestaetigen, zweifaktorStand, andereFaktorenEntfernen } from "@/daten/echt"
import { toast } from "sonner"
import { Copy, ExternalLink, Loader2 } from "lucide-react"

/* Eingabefeld für den 6-stelligen Code */
function CodeFeld({ id, wert, setWert, autoFocus }: { id: string; wert: string; setWert: (s: string) => void; autoFocus?: boolean }) {
  return (
    <Input id={id} value={wert} onChange={(e) => setWert(e.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="123456" autoFocus={autoFocus}
      className="h-12 text-center font-mono text-2xl tracking-[0.4em]" aria-describedby={id + "-hilfe"} required />
  )
}

/* Einrichten: App laden, QR-Code scannen (oder Link am Handy), Code eingeben */
export function ZweifaktorEinrichten({ onFertig, ersetzen }: { onFertig: () => void; ersetzen?: boolean }) {
  const [neu, setNeu] = React.useState<{ id: string; qr: string; geheim: string; uri: string } | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [code, setCode] = React.useState("")
  const [laeuft, setLaeuft] = React.useState(false)
  React.useEffect(() => { zweifaktorStarten().then(setNeu).catch((e) => setFehler(e.message)) }, [])
  const geheimLesbar = (neu?.geheim || "").replace(/(.{4})/g, "$1 ").trim()

  return (
    <form className="grid gap-5" onSubmit={async (e) => {
      e.preventDefault(); if (!neu) return
      setLaeuft(true); setFehler(null)
      try {
        await zweifaktorBestaetigen(neu.id, code)
        if (ersetzen) await andereFaktorenEntfernen(neu.id)
        onFertig()
      } catch (x: any) { setFehler(x.message); setCode("") } finally { setLaeuft(false) }
    }}>
      <ol className="grid gap-4 text-sm">
        <li className="flex gap-3"><Schritt n={1} /><div><div className="font-medium">Authenticator-App aufs Handy laden</div>
          <div className="text-muted-foreground">Kostenlos: „Google Authenticator“ oder „Microsoft Authenticator“ aus dem App Store bzw. Play Store.</div></div></li>
        <li className="flex gap-3"><Schritt n={2} /><div className="min-w-0 flex-1"><div className="font-medium">LUMIO in der App hinzufügen</div>
          <div className="text-muted-foreground">Am Rechner: in der App auf „+“ und den QR-Code scannen. Am Handy: auf den Knopf tippen.</div>
          {!neu && !fehler && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>}
          {neu && (
            <div className="mt-3 grid gap-3">
              <div className="mx-auto rounded-lg bg-white p-2"><img src={neu.qr} alt="QR-Code für die Authenticator-App" className="size-44" /></div>
              <Button type="button" variant="outline" asChild><a href={neu.uri}><ExternalLink />In der Authenticator-App öffnen</a></Button>
              <div className="rounded-md border bg-muted/40 p-2 text-xs">
                <div className="text-muted-foreground">Oder diesen Schlüssel von Hand eintragen:</div>
                <div className="mt-1 flex items-center gap-2"><code className="flex-1 break-all font-mono">{geheimLesbar}</code>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Schlüssel kopieren"
                    onClick={async () => { try { await navigator.clipboard.writeText(neu.geheim); toast("Schlüssel kopiert") } catch (e) { toast("Kopieren ging nicht") } }}><Copy /></Button></div>
              </div>
            </div>
          )}
        </div></li>
        <li className="flex gap-3"><Schritt n={3} /><div className="flex-1"><Label htmlFor="zf-code" className="font-medium">Den 6-stelligen Code aus der App eingeben</Label>
          <div id="zf-code-hilfe" className="mb-2 text-muted-foreground">Der Code wechselt alle 30 Sekunden.</div>
          <CodeFeld id="zf-code" wert={code} setWert={setCode} /></div></li>
      </ol>
      {fehler && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
      <Button type="submit" disabled={laeuft || !neu || code.length !== 6}>{laeuft && <Loader2 className="animate-spin" />}Bestätigen</Button>
    </form>
  )
}
function Schritt({ n }: { n: number }) {
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
}

/* Beim Anmelden: Code abfragen */
export function ZweifaktorCode({ onFertig }: { onFertig: () => void }) {
  const [code, setCode] = React.useState("")
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [laeuft, setLaeuft] = React.useState(false)
  const senden = async (c: string) => {
    setLaeuft(true); setFehler(null)
    try {
      const s = await zweifaktorStand()
      const f = s.faktoren[0]
      if (!f) { onFertig(); return }
      await zweifaktorBestaetigen(f.id, c)
      onFertig()
    } catch (x: any) { setFehler(x.message); setCode("") } finally { setLaeuft(false) }
  }
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); senden(code) }}>
      <Label htmlFor="zf-login">Code aus deiner Authenticator-App</Label>
      <CodeFeld id="zf-login" wert={code} setWert={(c) => { setCode(c); if (c.length === 6 && !laeuft) senden(c) }} autoFocus />
      <p id="zf-login-hilfe" className="text-xs text-muted-foreground">Handy verloren oder neu? Kurz bei Ramtin oder Kevin melden, sie setzen die Zwei-Faktor-Anmeldung zurück.</p>
      {fehler && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
      <Button type="submit" disabled={laeuft || code.length !== 6}>{laeuft && <Loader2 className="animate-spin" />}Anmelden</Button>
    </form>
  )
}
