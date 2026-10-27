import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { mailSenden, mailsZu, type MailStand, type MailVerlauf } from "@/daten/gmail"
import { bump, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { ExternalLink, Loader2, Mail, RefreshCw, Reply, Send } from "lucide-react"

const nurName = (x: string) => (x.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] || x).trim()
function wannKurz(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso), heute = new Date()
  if (d.toDateString() === heute.toDateString()) return d.toTimeString().slice(0, 5)
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
}

/* E-Mails mit den Ansprechpartnern eines Leads, aus dem eigenen Gmail-Postfach */
export function LeadMails({ l }: { l: any }) {
  const ui = useUI()
  const gesperrt = (a: string) => M.SPERRLISTE.some((e: any) => e.email && e.email === M.mailNorm(a))
  const adressen: string[] = Array.from(new Set<string>(l.kontakte.map((k: any) => k.mail).filter(Boolean)))
  const frei = adressen.filter((a) => !gesperrt(a))
  const [stand, setStand] = React.useState<MailStand | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [laedt, setLaedt] = React.useState(false)
  const [entwurf, setEntwurf] = React.useState<null | { an: string; betreff: string; text: string; verlauf?: string }>(null)
  const [sendet, setSendet] = React.useState(false)

  const laden = React.useCallback(async (frisch = false) => {
    if (!adressen.length) return
    setLaedt(true); setFehler(null)
    try { setStand(await mailsZu(adressen, frisch)) } catch (e: any) { setFehler(e.message) } finally { setLaedt(false) }
  }, [adressen.join(",")])
  React.useEffect(() => { laden() }, [laden])

  const neu = (v?: MailVerlauf) => setEntwurf({
    an: v ? (frei.find((a) => (v.von + v.an).toLowerCase().includes(a.toLowerCase())) || frei[0]) : frei[0],
    betreff: v ? (/^re:/i.test(v.betreff) ? v.betreff : "Re: " + v.betreff) : "", text: "", verlauf: v?.id,
  })

  async function senden(e: React.FormEvent) {
    e.preventDefault()
    if (!entwurf) return
    setSendet(true)
    try {
      await mailSenden(entwurf)
      M.verlauf(l, ui.ich, "notiz", "E-Mail gesendet: " + entwurf.betreff, "an " + entwurf.an); bump()
      toast("E-Mail an " + entwurf.an + " gesendet")
      setEntwurf(null); laden(true)
    } catch (err: any) { toast(err.message) } finally { setSendet(false) }
  }

  if (!adressen.length) return <p className="text-sm text-muted-foreground">Trag beim Ansprechpartner eine E-Mail-Adresse ein, dann erscheinen hier eure E-Mails.</p>

  const nichtVerbunden = stand && !stand.verbunden
  return (
    <div className="space-y-3">
      {fehler && <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{fehler}</p>}
      {nichtVerbunden ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">Verbinde dein Google-Konto, dann siehst und schreibst du hier E-Mails.</span>
          <Button size="sm" variant="outline" onClick={() => { ui.oeffne(null); ui.geheZu("kalender") }}>Google verbinden</Button>
        </div>
      ) : (
        <>
          <div className="divide-y rounded-lg border">
            {laedt && !stand && <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />E-Mails werden geladen …</div>}
            {stand && stand.verlaeufe.length === 0 && <div className="p-3 text-sm text-muted-foreground">Noch keine E-Mails mit {adressen.length === 1 ? adressen[0] : "den Ansprechpartnern"}.</div>}
            {stand?.verlaeufe.map((v) => (
              <div key={v.id} className="flex items-start gap-3 p-3">
                <Mail className={cn("mt-0.5 size-4 shrink-0", v.ungelesen ? "text-cobalt" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", v.ungelesen && "font-semibold")}>{v.betreff}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular">{wannKurz(v.datum)}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{v.gesendet ? "Du an " + nurName(v.an) : nurName(v.von)}{v.anzahl > 1 ? " · " + v.anzahl + " Nachrichten" : ""}</div>
                  {v.auszug && <div className="line-clamp-2 text-xs text-muted-foreground">{v.auszug}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {frei.length > 0 && <Button variant="ghost" size="icon" className="size-7" onClick={() => neu(v)} aria-label={"Antworten: " + v.betreff}><Reply /></Button>}
                  <Button asChild variant="ghost" size="icon" className="size-7"><a href={v.link} target="_blank" rel="noreferrer" aria-label={"In Gmail öffnen: " + v.betreff}><ExternalLink /></a></Button>
                </div>
              </div>
            ))}
          </div>
          {stand?.demo && <p className="text-xs text-muted-foreground">Demo: Beispiel-E-Mails. In der echten App stehen hier deine E-Mails aus Gmail.</p>}
          {!entwurf ? (
            <div className="-ml-2 flex gap-1">
              {frei.length > 0 && <Button variant="ghost" size="sm" onClick={() => neu()}><Send />E-Mail schreiben</Button>}
              {stand && <Button variant="ghost" size="sm" onClick={() => laden(true)} disabled={laedt}><RefreshCw className={cn(laedt && "animate-spin")} />Aktualisieren</Button>}
            </div>
          ) : (
            <form onSubmit={senden} className="grid gap-3 rounded-lg border bg-muted/40 p-3">
              <div className="grid gap-1.5"><Label htmlFor="mailan" className="text-xs text-muted-foreground">An</Label>
                <NativeSelect id="mailan" value={entwurf.an} onChange={(e) => setEntwurf({ ...entwurf, an: e.target.value })}>
                  {frei.map((a) => <NativeSelectOption key={a} value={a}>{(l.kontakte.find((k: any) => k.mail === a)?.name || "") + " · " + a}</NativeSelectOption>)}
                </NativeSelect></div>
              <div className="grid gap-1.5"><Label htmlFor="mailbe" className="text-xs text-muted-foreground">Betreff</Label>
                <Input id="mailbe" value={entwurf.betreff} onChange={(e) => setEntwurf({ ...entwurf, betreff: e.target.value })} required /></div>
              <div className="grid gap-1.5"><Label htmlFor="mailtx" className="text-xs text-muted-foreground">Text</Label>
                <Textarea id="mailtx" value={entwurf.text} onChange={(e) => setEntwurf({ ...entwurf, text: e.target.value })} required className="min-h-32" /></div>
              {stand?.email && <p className="text-xs text-muted-foreground">Geht von {stand.email} raus und liegt danach auch in deinem Gmail unter „Gesendet“.</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={sendet || !entwurf.betreff.trim() || !entwurf.text.trim()}>{sendet ? <Loader2 className="animate-spin" /> : <Send />}Senden</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEntwurf(null)}>Abbrechen</Button>
              </div>
            </form>
          )}
          {adressen.length > frei.length && <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">{adressen.length - frei.length} Adresse gesperrt, wird nicht angeschrieben</Badge>}
        </>
      )}
    </div>
  )
}
