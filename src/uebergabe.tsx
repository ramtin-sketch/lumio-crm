import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PersonAvatar } from "@/bits"
import { bump, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { ArrowRight, CalendarCheck2, CalendarDays, CalendarX2, Loader2, UserCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { belegtAm, freieZeiten, terminEintragen } from "@/daten/kalender"

/* Formular beim Termin: Briefing für den Closer, an wen es geht, und Eintrag in dessen Google-Kalender */
export function UebergabeFormular({ l, onFertig, onAbbrechen }: { l: any; onFertig: () => void; onAbbrechen: () => void }) {
  const ui = useUI()
  const ich = M.person(ui.ich)
  const [datum, setDatum] = React.useState(M.tag(1))
  const [zeit, setZeit] = React.useState("10:00")
  const [dauer, setDauer] = React.useState("30")
  const [closer, setCloser] = React.useState(ich.rolle === "gf" ? ui.ich : M.closerVorschlag())
  const [entscheider, setEntscheider] = React.useState("ja")
  const [budget, setBudget] = React.useState("unklar")
  const [bedarf, setBedarf] = React.useState("")
  const [einwaende, setEinwaende] = React.useState<string[]>([])
  const [notiz, setNotiz] = React.useState("")
  const kontakt = (l.kontakte || [])[0] || {}
  const [kal, setKal] = React.useState<{ laedt: boolean; verbunden: boolean | null; belegt: { start: string; end: string }[]; fehler?: string }>({ laedt: false, verbunden: null, belegt: [] })
  const [eintragen, setEintragen] = React.useState(true)
  const [meet, setMeet] = React.useState(true)
  const [einladen, setEinladen] = React.useState(false)
  const [kundeMail, setKundeMail] = React.useState(kontakt.mail || "")
  const [laeuft, setLaeuft] = React.useState(false)
  const id = (s: string) => s + l.id

  // Freie Zeiten des Closers an diesem Tag aus Google holen
  React.useEffect(() => {
    if (!ui.echt || !closer || !datum) return
    let weg = false
    setKal((k) => ({ ...k, laedt: true, fehler: undefined }))
    belegtAm(closer, datum).then((r) => { if (!weg) setKal({ laedt: false, verbunden: r.verbunden, belegt: r.belegt }) })
      .catch((e) => { if (!weg) setKal({ laedt: false, verbunden: null, belegt: [], fehler: e.message }) })
    return () => { weg = true }
  }, [ui.echt, closer, datum])
  const frei = kal.verbunden ? freieZeiten(datum, kal.belegt, Number(dauer)) : []
  const a = new Date(`${datum}T${zeit}:00`).getTime(), e = a + Number(dauer) * 60000
  const kollision = kal.verbunden && kal.belegt.some((b) => a < Date.parse(b.end) && e > Date.parse(b.start))
  const inKalender = ui.echt && kal.verbunden === true && eintragen

  function beschreibung() {
    const m = M.mandat(l.mandat)
    const lbl = (liste: any[], v: string) => (liste.find((x: any) => x[0] === v) || [, v])[1]
    if (einladen) return `Gespräch mit LUMIO GROUP.\n\nWir freuen uns auf den Austausch.\n\nLUMIO GROUP · Lumio Connect UG (haftungsbeschränkt) · Hamburg`
    return [
      `Closing-Termin, gesetzt über die LUMIO-Vertriebszentrale`,
      ``,
      `Firma: ${l.name}${m ? " (" + m.name + ")" : ""}`,
      kontakt.name ? `Ansprechpartner: ${kontakt.name}${kontakt.funktion ? ", " + kontakt.funktion : ""}` : null,
      kontakt.tel ? `Telefon: ${kontakt.tel}` : null,
      kontakt.mail ? `E-Mail: ${kontakt.mail}` : null,
      l.adresse || l.ort ? `Adresse: ${l.adresse || l.ort}` : null,
      ``,
      bedarf ? `Bedarf: ${bedarf}` : null,
      `Entscheider erreicht: ${lbl(M.ENTSCHEIDER, entscheider)}`,
      `Budget: ${lbl(M.BUDGETS, budget)}`,
      einwaende.length ? `Einwände: ${einwaende.join(", ")}` : null,
      notiz ? `Hinweis: ${notiz}` : null,
      ``,
      `Gesetzt von ${ich.voll}`,
    ].filter((z) => z !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim()
  }

  async function absenden(ev: React.FormEvent) {
    ev.preventDefault()
    setLaeuft(true)
    try {
      toast(M.protokoll(l, ui.ich, "termin", { datum, zeit, closer, entscheider, budget, bedarf, einwaende, notiz }))
      const t = [...M.TERMINE].reverse().find((x: any) => x.lead === l.id && x.datum === datum && x.status === "geplant")
      if (inKalender) {
        try {
          const r = await terminEintragen({
            closer, datum, zeit, dauer: Number(dauer), meet, einladen: einladen && !!kundeMail, kunde_email: kundeMail || undefined,
            titel: einladen ? `${l.name} × LUMIO GROUP` : `Closing: ${l.name}`, beschreibung: beschreibung(),
            ort: meet ? undefined : (l.adresse || l.ort || undefined), termin_id: t?.id ? String(t.id) : undefined,
          })
          if (t) { t.googleEvent = r.id; t.googleLink = r.link }
          toast(`Im Kalender von ${M.person(closer).name} eingetragen${r.meet ? " (mit Meet-Link)" : ""}${einladen && kundeMail ? ", Einladung an " + kundeMail + " ist raus" : ""}.`)
        } catch (x: any) {
          toast(`Termin ist im CRM, aber nicht im Kalender: ${x.message}`)
        }
      }
      bump(); onFertig()
    } finally { setLaeuft(false) }
  }

  return (
    <form className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-3" onSubmit={absenden}>
      <div className="flex items-center gap-2 text-sm font-medium"><UserCheck className="size-4" />Termin vereinbaren und übergeben</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 grid gap-1.5 sm:col-span-2"><Label htmlFor={id("uc")} className="text-xs text-muted-foreground">Closer</Label>
          <NativeSelect id={id("uc")} value={closer} onChange={(e) => setCloser(e.target.value)}>
            {M.PERSONEN.filter((p: any) => p.rolle === "gf").map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.id === ui.ich ? p.voll + " (ich selbst)" : p.voll}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5"><Label htmlFor={id("ud")} className="text-xs text-muted-foreground">Datum</Label><Input id={id("ud")} type="date" value={datum} min={M.HEUTE} onChange={(e) => setDatum(e.target.value)} required /></div>
        <div className="grid gap-1.5"><Label htmlFor={id("uz")} className="text-xs text-muted-foreground">Uhrzeit</Label><Input id={id("uz")} type="time" step={900} value={zeit} onChange={(e) => setZeit(e.target.value)} required /></div>
      </div>
      {ui.echt && (
        <div className="grid gap-1.5 rounded-md border bg-background p-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {kal.laedt ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" />Kalender von {M.person(closer).name} wird geladen …</span>
              : kal.fehler ? <span>{kal.fehler}</span>
              : kal.verbunden === false ? <span>{M.person(closer).name} hat den Google-Kalender noch nicht verbunden. Der Termin landet nur im CRM.</span>
              : kal.verbunden ? <span>Frei bei {M.person(closer).name} am {M.dKurz(datum)}{frei.length ? "" : ": nichts mehr frei zwischen 8 und 19 Uhr"}</span> : null}
            {kal.verbunden && (
              <NativeSelect aria-label="Dauer" value={dauer} onChange={(e) => setDauer(e.target.value)} size="sm" className="ml-auto w-24">
                {["30", "45", "60", "90"].map((d) => <NativeSelectOption key={d} value={d}>{d} Min.</NativeSelectOption>)}
              </NativeSelect>
            )}
          </div>
          {kal.verbunden && frei.length > 0 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Freie Zeiten">
              {frei.map((f) => <Button key={f} type="button" size="xs" variant={f === zeit ? "default" : "outline"} className="font-mono tabular" onClick={() => setZeit(f)}>{f}</Button>)}
            </div>
          )}
          {kollision && <p className="text-xs text-destructive" role="alert">Achtung: {M.person(closer).name} hat um {zeit} schon etwas im Kalender.</p>}
          {kal.verbunden && (
            <div className="grid gap-1.5 pt-1 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={eintragen} onCheckedChange={(v) => setEintragen(!!v)} />In den Kalender von {M.person(closer).name} eintragen</label>
              {eintragen && <>
                <label className="flex items-center gap-2"><Checkbox checked={meet} onCheckedChange={(v) => setMeet(!!v)} />Google-Meet-Link anlegen</label>
                <label className="flex items-center gap-2"><Checkbox checked={einladen} onCheckedChange={(v) => setEinladen(!!v)} />Kunden per Kalender einladen</label>
                {einladen && <Input aria-label="E-Mail des Kunden" type="email" placeholder="E-Mail des Kunden" value={kundeMail} onChange={(e) => setKundeMail(e.target.value)} required className="h-8" />}
                {einladen && <p className="text-xs text-muted-foreground">Der Kunde bekommt eine Einladung von Google. Er sieht nur „Gespräch mit LUMIO GROUP“, nicht dein Briefing.</p>}
              </>}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label htmlFor={id("ue")} className="text-xs text-muted-foreground">Entscheider erreicht?</Label>
          <NativeSelect id={id("ue")} value={entscheider} onChange={(e) => setEntscheider(e.target.value)}>{M.ENTSCHEIDER.map((x: any) => <NativeSelectOption key={x[0]} value={x[0]}>{x[1]}</NativeSelectOption>)}</NativeSelect>
        </div>
        <div className="grid gap-1.5"><Label htmlFor={id("ub")} className="text-xs text-muted-foreground">Budget</Label>
          <NativeSelect id={id("ub")} value={budget} onChange={(e) => setBudget(e.target.value)}>{M.BUDGETS.map((x: any) => <NativeSelectOption key={x[0]} value={x[0]}>{x[1]}</NativeSelectOption>)}</NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5"><Label htmlFor={id("un")} className="text-xs text-muted-foreground">Bedarf in einem Satz</Label><Input id={id("un")} value={bedarf} onChange={(e) => setBedarf(e.target.value)} placeholder="Was will der Kunde erreichen?" /></div>
      <div className="grid gap-1.5">
        <span className="text-xs text-muted-foreground">Einwände, die schon kamen</span>
        <ToggleGroup type="multiple" variant="outline" size="sm" value={einwaende} onValueChange={setEinwaende} className="flex flex-wrap">
          {M.EINWAENDE.map((e: string) => <ToggleGroupItem key={e} value={e} className="h-7 flex-none rounded-md! border px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{e}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      <div className="grid gap-1.5"><Label htmlFor={id("ut")} className="text-xs text-muted-foreground">Hinweis für den Closer</Label><Textarea id={id("ut")} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Was muss der Closer wissen?" className="min-h-16" /></div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={laeuft}>{laeuft ? <Loader2 className="animate-spin" /> : <ArrowRight />}{closer === ui.ich ? "Termin eintragen" : "An " + M.person(closer).name + " übergeben"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onAbbrechen}>Abbrechen</Button>
      </div>
    </form>
  )
}

/* Karte im Lead: was der Setter mitgibt, und nach dem Termin die zwei Knöpfe für den Closer */
export function UebergabeKarte({ l }: { l: any }) {
  const ui = useUI()
  const u = l.uebergabe
  if (!u) return null
  const budget = M.BUDGETS.find((b: any) => b[0] === u.budget)?.[1]
  const ent = M.ENTSCHEIDER.find((b: any) => b[0] === u.entscheider)?.[1]
  const darfErgebnis = l.stufe === "termin" && (ui.ich === u.an || ui.istGF)
  const faellig = u.termin.datum <= M.HEUTE
  const selbst = u.von === u.an
  return (
    <Card className={cn("gap-3 py-4", l.stufe === "termin" && "border-cobalt/40 bg-cobalt/[0.03]")}>
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PersonAvatar id={u.von} />{!selbst && <><ArrowRight className="size-3.5 text-muted-foreground" /><PersonAvatar id={u.an} /></>}
          <span>{selbst ? "Selbst gesetzt von " + M.person(u.von).name : "Übergabe von " + M.person(u.von).name + " an " + M.person(u.an).name}</span>
        </CardTitle>
        <CardDescription>Termin {M.dKurz(u.termin.datum)}{u.termin.zeit ? " um " + u.termin.zeit : ""} · gesetzt am {M.dKurz(u.datum)}</CardDescription>
        {l.terminStatus === "noshow" && <CardAction><Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">No-Show</Badge></CardAction>}
        {l.terminStatus === "gelaufen" && <CardAction><Badge variant="outline" className="border-transparent bg-ok/15 text-ok">gelaufen</Badge></CardAction>}
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Entscheider</dt><dd className={cn(u.entscheider !== "ja" && "text-warn")}>{ent}</dd>
          <dt className="text-muted-foreground">Budget</dt><dd>{budget}</dd>
          {u.bedarf && <><dt className="text-muted-foreground">Bedarf</dt><dd>{u.bedarf}</dd></>}
          {u.einwaende?.length > 0 && <><dt className="text-muted-foreground">Einwände</dt><dd className="flex flex-wrap gap-1">{u.einwaende.map((e: string) => <Badge key={e} variant="secondary" className="font-normal">{e}</Badge>)}</dd></>}
          {u.notiz && <><dt className="text-muted-foreground">Hinweis</dt><dd>{u.notiz}</dd></>}
        </dl>
        {darfErgebnis && (
          <div className="space-y-2">
            {!faellig && <p className="text-xs text-muted-foreground">Nach dem Termin hier eintragen, wie er gelaufen ist.</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => { toast(M.terminErgebnis(l, ui.ich, "gelaufen")); bump() }}><CalendarCheck2 />Termin gelaufen</Button>
              <Button size="sm" variant="outline" onClick={() => { toast(M.terminErgebnis(l, ui.ich, "noshow")); bump() }}><CalendarX2 />Nicht erschienen</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
