import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Seitenkopf } from "@/bits"
import { mailSenden, nurAdresse, nurName, postfach, verlaufLesen, type MailVerlauf, type MailVoll, type PostfachStand } from "@/daten/gmail"
import { bump, useDaten, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { ArrowLeft, ExternalLink, Inbox, Loader2, Mail, Paperclip, PenSquare, RefreshCw, Reply, Search, Send } from "lucide-react"

type Ordner = "eingang" | "gesendet" | "alle"

/* Welcher Lead gehört zu einer Adresse? Über die E-Mail der Ansprechpartner. */
function leadZu(adressen: string[] = []) {
  const set = new Set(adressen.map((a) => M.mailNorm(a)))
  return M.LEADS.find((l: any) => l.name !== "[gelöscht]" && l.kontakte.some((k: any) => k.mail && set.has(M.mailNorm(k.mail)))) || null
}
const gesperrt = (a: string) => M.SPERRLISTE.some((e: any) => e.email && e.email === M.mailNorm(a))
function wann(iso: string | null, lang = false) {
  if (!iso) return ""
  const d = new Date(iso), heute = new Date()
  if (d.toDateString() === heute.toDateString()) return d.toTimeString().slice(0, 5)
  return lang ? d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
}

export function Postfach() {
  useDaten()
  const ui = useUI()
  const [ordner, setOrdner] = React.useState<Ordner>("eingang")
  const [suche, setSuche] = React.useState("")
  const [aktiveSuche, setAktiveSuche] = React.useState("")
  const [stand, setStand] = React.useState<PostfachStand | null>(null)
  const [laedt, setLaedt] = React.useState(false)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [offen, setOffen] = React.useState<string | null>(null)
  const [neuAuf, setNeuAuf] = React.useState(false)

  const laden = React.useCallback(async (mehr = false) => {
    setLaedt(true); setFehler(null)
    try {
      const r = await postfach({ ordner, suche: aktiveSuche, seite: mehr ? stand?.weiter : null })
      setStand((alt) => mehr && alt ? { ...r, verlaeufe: alt.verlaeufe.concat(r.verlaeufe) } : r)
    } catch (e: any) { setFehler(e.message) } finally { setLaedt(false) }
  }, [ordner, aktiveSuche, stand?.weiter])
  React.useEffect(() => { laden() }, [ordner, aktiveSuche])

  if (stand && !stand.verbunden) return (
    <>
      <Seitenkopf titel="Postfach" text="Dein Gmail-Postfach im CRM." />
      <Card><CardHeader><CardTitle>Google noch nicht verbunden</CardTitle>
        <CardDescription>Einmal unter „Kalender“ Google verbinden, dann stehen hier deine E-Mails.</CardDescription>
        <CardAction><Button size="sm" onClick={() => ui.geheZu("kalender")}>Google verbinden</Button></CardAction>
      </CardHeader></Card>
    </>
  )

  return (
    <>
      <Seitenkopf titel="Postfach" text={stand?.email ? "Dein Gmail-Postfach · " + stand.email : "Dein Gmail-Postfach im CRM."}>
        <Button size="sm" onClick={() => setNeuAuf(true)}><PenSquare />Neue E-Mail</Button>
      </Seitenkopf>

      {fehler && <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{fehler}</p>}
      {stand?.demo && <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Demo: Beispiel-E-Mails. In der echten App steht hier dein Gmail-Postfach.</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className={cn("min-w-0 space-y-3", offen && "hidden lg:block")}>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={ordner} onValueChange={(v) => { setOrdner(v as Ordner); setOffen(null) }}>
              <TabsList>
                <TabsTrigger value="eingang"><Inbox />Eingang{stand?.ungelesen ? <Badge className="ml-1 h-4 px-1.5 text-[10px]">{stand.ungelesen}</Badge> : null}</TabsTrigger>
                <TabsTrigger value="gesendet"><Send />Gesendet</TabsTrigger>
                <TabsTrigger value="alle">Alle</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="icon" className="ml-auto size-8" onClick={() => laden()} disabled={laedt} aria-label="Aktualisieren"><RefreshCw className={cn(laedt && "animate-spin")} /></Button>
          </div>
          <form className="relative" onSubmit={(e) => { e.preventDefault(); setAktiveSuche(suche.trim()); setOffen(null) }}>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="In E-Mails suchen" className="pl-8" aria-label="In E-Mails suchen" />
          </form>
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {!stand && laedt && Array.from({ length: 5 }).map((_, i) => <div key={i} className="space-y-2 p-3"><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /></div>)}
            {stand && stand.verlaeufe.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">{aktiveSuche ? "Nichts gefunden." : "Keine E-Mails."}</div>}
            {stand?.verlaeufe.map((v) => <Zeile key={v.id} v={v} aktiv={offen === v.id} onClick={() => setOffen(v.id)} />)}
          </div>
          {stand?.weiter && <Button variant="outline" size="sm" className="w-full" onClick={() => laden(true)} disabled={laedt}>{laedt && <Loader2 className="animate-spin" />}Ältere laden</Button>}
        </div>

        <div className={cn("min-w-0", !offen && "hidden lg:block")}>
          {offen ? <Unterhaltung key={offen} id={offen} onZurueck={() => setOffen(null)} onGeschickt={() => laden()} />
            : <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"><Mail className="size-6" />E-Mail links auswählen</div>}
        </div>
      </div>

      <NeueMail offen={neuAuf} onOffen={setNeuAuf} onGeschickt={() => laden()} />
    </>
  )
}

function Zeile({ v, aktiv, onClick }: { v: MailVerlauf; aktiv: boolean; onClick: () => void }) {
  const l = leadZu(v.adressen)
  const wer = v.gesendet ? "An " + nurName(v.an) : nurName(v.von)
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50", aktiv && "bg-muted")}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", v.ungelesen ? "bg-cobalt" : "bg-transparent")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", v.ungelesen && "font-semibold")}>{wer}{v.anzahl > 1 && <span className="ml-1 text-xs font-normal text-muted-foreground">{v.anzahl}</span>}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular">{wann(v.datum)}</span>
        </span>
        <span className={cn("block truncate text-sm", v.ungelesen ? "font-medium" : "text-foreground/90")}>{v.betreff}</span>
        <span className="block truncate text-xs text-muted-foreground">{v.auszug}</span>
        {l && <Badge variant="outline" className="mt-1 border-transparent bg-chart-2/15 font-normal text-chart-2">{l.name}</Badge>}
      </span>
    </button>
  )
}

function Unterhaltung({ id, onZurueck, onGeschickt }: { id: string; onZurueck: () => void; onGeschickt: () => void }) {
  const ui = useUI()
  const [v, setV] = React.useState<MailVoll | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [antwort, setAntwort] = React.useState("")
  const [sendet, setSendet] = React.useState(false)
  const ende = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { let ok = true; verlaufLesen(id).then((x) => ok && setV(x)).catch((e) => ok && setFehler(e.message)); return () => { ok = false } }, [id])

  if (fehler) return <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{fehler}</p>
  if (!v) return <div className="flex min-h-64 items-center justify-center rounded-xl border"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  const l = leadZu(v.adressen)
  const letzte = v.nachrichten[v.nachrichten.length - 1]
  const fremde = v.nachrichten.filter((n) => !n.gesendet)
  const an = nurAdresse(fremde.length ? fremde[fremde.length - 1].von : (letzte?.an || "").split(",")[0] || "")
  const darf = !!an && !gesperrt(an)

  async function senden(e: React.FormEvent) {
    e.preventDefault()
    if (!v || !antwort.trim()) return
    setSendet(true)
    try {
      const betreff = /^re:/i.test(v.betreff) ? v.betreff : "Re: " + v.betreff
      await mailSenden({ an, betreff, text: antwort, verlauf: v.id, antwortAuf: letzte?.kennung || undefined })
      if (l) { M.verlauf(l, ui.ich, "notiz", "E-Mail gesendet: " + betreff, "an " + an); bump() }
      toast("Antwort an " + an + " gesendet"); setAntwort("")
      setV(await verlaufLesen(v.id)); onGeschickt()
    } catch (err: any) { toast(err.message) } finally { setSendet(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={onZurueck} aria-label="Zurück zur Liste"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug">{v.betreff}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {l ? <Button variant="outline" size="xs" onClick={() => ui.oeffne(l.id)}>Lead: {l.name}</Button>
              : <span className="text-xs text-muted-foreground">Keinem Lead zugeordnet</span>}
            <Button asChild variant="ghost" size="xs"><a href={v.link} target="_blank" rel="noreferrer"><ExternalLink />In Gmail</a></Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {v.nachrichten.map((n) => (
          <article key={n.id} className={cn("rounded-xl border bg-card p-4", n.gesendet && "border-cobalt/20 bg-cobalt/[0.03]")}>
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{n.gesendet ? "Du" : nurName(n.von)} <span className="font-normal text-muted-foreground">{nurAdresse(n.von)}</span></div>
                <div className="truncate text-xs text-muted-foreground">an {n.an}{n.cc ? " · cc " + n.cc : ""}</div>
              </div>
              <span className="font-mono text-xs text-muted-foreground tabular">{wann(n.datum, true)}</span>
            </header>
            <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">{n.text}</div>
            {n.anhaenge.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{n.anhaenge.map((a, i) => <Badge key={i} variant="secondary" className="font-normal"><Paperclip />{a}</Badge>)}</div>}
          </article>
        ))}
        <div ref={ende} />
      </div>

      {darf ? (
        <form onSubmit={senden} className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <Label htmlFor="pantw" className="flex items-center gap-1.5 text-xs text-muted-foreground"><Reply className="size-3.5" />Antwort an {an}</Label>
          <Textarea id="pantw" value={antwort} onChange={(e) => setAntwort(e.target.value)} placeholder="Deine Antwort …" className="min-h-28 bg-background" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Geht aus deinem Gmail raus{l ? " und steht im Verlauf des Leads" : ""}.</span>
            <Button type="submit" size="sm" disabled={sendet || !antwort.trim()}>{sendet ? <Loader2 className="animate-spin" /> : <Send />}Senden</Button>
          </div>
        </form>
      ) : an && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{an} steht auf der Sperrliste. Bitte nicht anschreiben.</p>}
    </div>
  )
}

function NeueMail({ offen, onOffen, onGeschickt }: { offen: boolean; onOffen: (o: boolean) => void; onGeschickt: () => void }) {
  const ui = useUI()
  const [an, setAn] = React.useState("")
  const [betreff, setBetreff] = React.useState("")
  const [text, setText] = React.useState("")
  const [sendet, setSendet] = React.useState(false)
  React.useEffect(() => { if (offen) { setAn(""); setBetreff(""); setText("") } }, [offen])
  const vorschlaege = React.useMemo(() => {
    const m = new Map<string, string>()
    M.LEADS.forEach((l: any) => l.name !== "[gelöscht]" && l.kontakte.forEach((k: any) => k.mail && !gesperrt(k.mail) && m.set(k.mail, `${k.name} · ${l.name}`)))
    return [...m.entries()].slice(0, 300)
  }, [offen])
  const l = an ? leadZu([an]) : null
  const sperre = an && gesperrt(an)

  async function senden(e: React.FormEvent) {
    e.preventDefault()
    setSendet(true)
    try {
      await mailSenden({ an: an.trim(), betreff, text })
      if (l) { M.verlauf(l, ui.ich, "notiz", "E-Mail gesendet: " + betreff, "an " + an.trim()); bump() }
      toast("E-Mail an " + an.trim() + " gesendet"); onOffen(false); onGeschickt()
    } catch (err: any) { toast(err.message) } finally { setSendet(false) }
  }

  return (
    <Dialog open={offen} onOpenChange={onOffen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Neue E-Mail</DialogTitle><DialogDescription>Geht aus deinem Gmail-Postfach raus.</DialogDescription></DialogHeader>
        <form onSubmit={senden} className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="nan" className="text-xs text-muted-foreground">An</Label>
            <Input id="nan" type="email" list="nan-liste" value={an} onChange={(e) => setAn(e.target.value)} placeholder="name@firma.de" required />
            <datalist id="nan-liste">{vorschlaege.map(([mail, wer]) => <option key={mail} value={mail}>{wer}</option>)}</datalist>
            {l && <span className="text-xs text-muted-foreground">Gehört zu <b>{l.name}</b>, landet im Verlauf des Leads.</span>}
            {sperre && <span className="text-xs text-destructive">Diese Adresse steht auf der Sperrliste.</span>}
          </div>
          <div className="grid gap-1.5"><Label htmlFor="nbe" className="text-xs text-muted-foreground">Betreff</Label><Input id="nbe" value={betreff} onChange={(e) => setBetreff(e.target.value)} required /></div>
          <div className="grid gap-1.5"><Label htmlFor="ntx" className="text-xs text-muted-foreground">Text</Label><Textarea id="ntx" value={text} onChange={(e) => setText(e.target.value)} required className="min-h-40" /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOffen(false)}>Abbrechen</Button>
            <Button type="submit" size="sm" disabled={sendet || !!sperre || !an.trim() || !betreff.trim() || !text.trim()}>{sendet ? <Loader2 className="animate-spin" /> : <Send />}Senden</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
