import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { PersonAvatar } from "@/bits"
import { bump, useDaten, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import * as D from "@/model/d2d.js"
import * as K from "@/model/karte.js"
import { toast } from "sonner"
import { Ban, Clock, DoorClosed, FileSignature, Home, Navigation, Plus, ThumbsDown, UserCheck, AlertTriangle } from "lucide-react"

export function TuerBadge({ s, w }: { s: string; w?: any }) {
  const t = D.tuer(s)
  return <Badge variant="outline" className="border-transparent font-normal" style={{ background: t.farbe + "22", color: t.farbe }}>{t.kurz}{s === "nicht" && w?.versuche ? " " + w.versuche + "×" : ""}</Badge>
}

/* Ein Haus mit seinen Wohnungen. Pro Tür ein Tipp. */
export function ObjektSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  useDaten()
  const o = id ? D.objekt(id) : null
  return (
    <Sheet open={!!o} onOpenChange={(x) => !x && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">{o && <Inhalt key={o.id} o={o} />}</SheetContent>
    </Sheet>
  )
}

function Inhalt({ o }: { o: any }) {
  const ui = useUI()
  const m = M.mandat(o.mandat)
  const ich = M.person(ui.ich)
  const freigabe = ui.istGF || D.istFreigegeben(ich, o.mandat)
  const [offen, setOffen] = React.useState<string | null>(o.wohnungen.length === 1 ? o.wohnungen[0].id : null)
  const ab = D.abdeckung([o])
  const auftraege = D.AUFTRAEGE.filter((a: any) => a.objekt === o.id)
  return (
    <>
      <SheetHeader className="gap-1.5 border-b pb-4">
        <div className="flex flex-wrap gap-1.5 pr-8">
          <Badge variant="outline" className="border-transparent bg-chart-5/15">{m?.name}</Badge>
          <Badge variant="secondary" className="font-normal">{o.typ === "efh" ? "Einfamilienhaus" : o.typ === "gewerbe" ? "Gewerbe" : "Mehrfamilienhaus · " + o.wohnungen.length + " Wohnungen"}</Badge>
        </div>
        <SheetTitle className="text-xl">{o.strasse} {o.hausnr}</SheetTitle>
        <SheetDescription>{[o.plz, o.ort].filter(Boolean).join(" ")}{o.unit ? " · " + K.unit(o.unit)?.name : ""}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground"><span>{ab.besucht} von {ab.gesamt} Türen besucht</span><span>{ab.kunden} Kunden</span></div>
            <Progress value={ab.gesamt ? ab.besucht / ab.gesamt * 100 : 0} />
          </div>
          <PersonAvatar id={o.betreuer} />
        </div>
        <div className="flex flex-wrap gap-2">
          {o.geo && <Button asChild variant="outline" size="sm"><a href={K.routeLink(o.geo)} target="_blank" rel="noreferrer"><Navigation />Route</a></Button>}
          <Button variant="outline" size="sm" onClick={() => { D.wohnungDazu(o); bump() }}><Plus />Wohnung</Button>
        </div>
        {!freigabe && (
          <div className="flex items-start gap-2 rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Du bist für {m?.name} noch nicht freigegeben (Ausweis und Schulung). Türen kannst du notieren, Aufträge erst nach der Freigabe.</span>
          </div>
        )}

        <div className="divide-y rounded-lg border">
          {o.wohnungen.map((w: any) => (
            <div key={w.id}>
              <button type="button" onClick={() => setOffen(offen === w.id ? null : w.id)} disabled={w.status === "sperre"}
                className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 disabled:opacity-60", offen === w.id && "bg-muted/50")}>
                <DoorClosed className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{w.name}</span>
                  {w.wiederAm && w.status === "wieder" && <span className="block text-xs text-cobalt">wieder {M.wann({ datum: w.wiederAm.slice(0, 10), zeit: new Date(w.wiederAm).toTimeString().slice(0, 5) })}</span>}
                  {w.notiz && <span className="block truncate text-xs text-muted-foreground">{w.notiz}</span>}
                </span>
                <TuerBadge s={w.status} w={w} />
              </button>
              {offen === w.id && <Tuer o={o} w={w} freigabe={freigabe} onFertig={() => setOffen(null)} />}
            </div>
          ))}
        </div>

        {auftraege.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aufträge in diesem Haus</h3>
            <div className="divide-y rounded-lg border">
              {auftraege.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{a.kunde?.name || "Kunde"} · {a.produkt}</span><span className="block text-xs text-muted-foreground">{M.dKurz(a.datum)} · {o.wohnungen.find((w: any) => w.id === a.wohnung)?.name}</span></span>
                  <AuftragBadge a={a} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}

export function AuftragBadge({ a }: { a: any }) {
  const s = D.statusVon(a.status)
  const cls = a.status === "geschaltet" ? "bg-ok/15 text-ok" : s.ende ? "bg-destructive/10 text-destructive" : "bg-cobalt/10 text-cobalt"
  return <Badge variant="outline" className={"border-transparent font-normal " + cls}>{s.name}</Badge>
}

function Tuer({ o, w, freigabe, onFertig }: { o: any; w: any; freigabe: boolean; onFertig: () => void }) {
  const ui = useUI()
  const [modus, setModus] = React.useState<null | "wieder" | "auftrag">(null)
  const morgen = new Date(); morgen.setHours(18, 0, 0, 0); if (new Date().getHours() >= 17) morgen.setDate(morgen.getDate() + 1)
  const [wann, setWann] = React.useState(M.iso(morgen) + "T18:00")
  const tun = (erg: string, x?: any) => { toast(D.tuerErgebnis(o, w, ui.ich, erg, x)); bump(); setModus(null); onFertig() }
  const knopf = "h-11 flex-col gap-0.5 text-xs"
  return (
    <div className="space-y-3 border-t bg-muted/30 p-3">
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className={knopf} onClick={() => tun("nicht")}><DoorClosed />Nicht da</Button>
        <Button variant="outline" className={knopf} onClick={() => tun("kein")}><ThumbsDown />Kein Interesse</Button>
        <Button variant={modus === "wieder" ? "secondary" : "outline"} className={knopf} onClick={() => setModus(modus === "wieder" ? null : "wieder")}><Clock />Wiederkommen</Button>
        <Button variant="outline" className={knopf} onClick={() => tun("kunde")}><UserCheck />Schon Kunde</Button>
        <Button variant={modus === "auftrag" ? "secondary" : "default"} className={knopf} onClick={() => setModus(modus === "auftrag" ? null : "auftrag")} disabled={!freigabe}><FileSignature />Auftrag</Button>
        <Button variant="outline" className={knopf + " text-destructive"} onClick={() => tun("sperre")}><Ban />Keine Vertreter</Button>
      </div>
      {modus === "wieder" && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); tun("wieder", { wiederAm: new Date(wann).toISOString() }) }}>
          <div className="grid gap-1"><Label htmlFor={"wa" + w.id} className="text-xs text-muted-foreground">Wann</Label><Input id={"wa" + w.id} type="datetime-local" value={wann} onChange={(e) => setWann(e.target.value)} className="h-9" required /></div>
          <Button type="submit" size="sm" className="h-9">Eintragen</Button>
        </form>
      )}
      {modus === "auftrag" && <AuftragFormular o={o} w={w} onFertig={() => { setModus(null); onFertig() }} />}
    </div>
  )
}

function AuftragFormular({ o, w, onFertig }: { o: any; w: any; onFertig: () => void }) {
  const ui = useUI()
  const m = M.mandat(o.mandat)
  const produkte: string[] = m?.k?.produkte || []
  const [d, setD] = React.useState<any>({ produkt: produkte[0] || "", name: "", tel: "", mail: "", felder: {}, belehrt: false })
  const set = (k: string, v: any) => setD((x: any) => ({ ...x, [k]: v }))
  return (
    <form className="space-y-3 rounded-lg border bg-background p-3" onSubmit={(e) => {
      e.preventDefault()
      const a = D.auftragAnlegen(o, w, ui.ich, { mandat: o.mandat, produkt: d.produkt, name: d.name, tel: d.tel, mail: d.mail, felder: d.felder })
      bump(); toast(`Auftrag erfasst: ${a.kunde.name || "Kunde"}`, { description: "Widerruf möglich bis " + M.dKurz(D.widerrufBis(a)) + " Nächster Schritt: Bestätigungsanruf." }); onFertig()
    }}>
      <div className="text-sm font-medium">Auftrag für {w.name}</div>
      {produkte.length > 0 ? (
        <div className="grid gap-1.5"><Label htmlFor={"ap" + w.id} className="text-xs text-muted-foreground">Produkt</Label>
          <NativeSelect id={"ap" + w.id} value={d.produkt} onChange={(e) => set("produkt", e.target.value)}>{produkte.map((p) => <NativeSelectOption key={p} value={p}>{p}</NativeSelectOption>)}</NativeSelect></div>
      ) : (
        <div className="grid gap-1.5"><Label htmlFor={"ap" + w.id} className="text-xs text-muted-foreground">Produkt</Label><Input id={"ap" + w.id} value={d.produkt} onChange={(e) => set("produkt", e.target.value)} required /></div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 grid gap-1.5"><Label htmlFor={"an" + w.id} className="text-xs text-muted-foreground">Name Kunde</Label><Input id={"an" + w.id} value={d.name} onChange={(e) => set("name", e.target.value)} required /></div>
        <div className="grid gap-1.5"><Label htmlFor={"at" + w.id} className="text-xs text-muted-foreground">Telefon (für den Bestätigungsanruf)</Label><Input id={"at" + w.id} type="tel" value={d.tel} onChange={(e) => set("tel", e.target.value)} required /></div>
        <div className="grid gap-1.5"><Label htmlFor={"am" + w.id} className="text-xs text-muted-foreground">E-Mail</Label><Input id={"am" + w.id} type="email" value={d.mail} onChange={(e) => set("mail", e.target.value)} /></div>
        {(m?.felder || []).map((f: any) => (
          <div key={f.key} className="grid gap-1.5"><Label htmlFor={"af" + f.key + w.id} className="text-xs text-muted-foreground">{f.label}</Label>
            <Input id={"af" + f.key + w.id} type={f.typ === "zahl" ? "number" : "text"} value={d.felder[f.key] || ""} onChange={(e) => set("felder", { ...d.felder, [f.key]: e.target.value })} /></div>
        ))}
      </div>
      <label className="flex items-start gap-2 text-xs">
        <Checkbox checked={d.belehrt} onCheckedChange={(v) => set("belehrt", !!v)} className="mt-0.5" />
        <span>Kunde hat die Vertragsunterlagen und die Widerrufsbelehrung (14 Tage) bekommen. Kein Druck, keine falschen Versprechen.</span>
      </label>
      <Button type="submit" size="sm" disabled={!d.belehrt}><FileSignature />Auftrag speichern</Button>
    </form>
  )
}

export { Home }
