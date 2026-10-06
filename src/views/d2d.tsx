import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kpi, PersonAvatar, Seitenkopf } from "@/bits"
import { GebietsKarte } from "@/gebiets-karte"
import { ObjektSheet, AuftragBadge } from "@/objekt-sheet"
import { bump, useDaten, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import * as D from "@/model/d2d.js"
import * as K from "@/model/karte.js"
import { toast } from "sonner"
import { Building, Clock, FileUp, Loader2, LocateFixed, MoreHorizontal, ShieldCheck } from "lucide-react"

const heute = () => M.HEUTE
const farbeObjekt = (o: any) => {
  const w = o.wohnungen
  if (o.gesperrt || (w.length && w.every((x: any) => x.status === "sperre"))) return "#e03131"
  if (w.some((x: any) => x.status === "auftrag" || x.status === "kunde")) return "#2f9e44"
  if (w.some((x: any) => x.status !== "offen")) return "#3b5bdb"
  return "#94a3b8"
}

export function D2D() {
  const version = useDaten()
  const ui = useUI()
  const gf = ui.istGF
  const ich = M.person(ui.ich)
  const [partner, setPartner] = React.useState("alle")
  const [objektId, setObjektId] = React.useState<string | null>(null)
  const [neuHaus, setNeuHaus] = React.useState(false)
  const mandate = D.mandateD2D()
  const sichtbar = D.OBJEKTE.filter((o: any) => (gf || o.betreuer === ui.ich) && (partner === "alle" || o.mandat === partner))
  const stadt = ui.kartenStadt
  const inStadt = sichtbar.filter((o: any) => o.stadt === stadt && o.geo)
  const meineBesuche = (b: any) => (gf || b.wer === ui.ich) && (partner === "alle" || D.objekt(b.objekt)?.mandat === partner)
  const k = D.kennzahlen((b: any) => meineBesuche(b) && b.zeit.slice(0, 10) === heute())
  const k7 = D.kennzahlen((b: any) => meineBesuche(b) && M.tageZwischen(b.zeit.slice(0, 10), heute()) < 7)
  const ab = D.abdeckung(sichtbar)
  const auftraege = D.AUFTRAEGE.filter((a: any) => (gf || a.wer === ui.ich) && (partner === "alle" || a.mandat === partner))
  const imMonat = auftraege.filter((a: any) => a.status === "geschaltet" && M.ym(a.statusDatum) === M.MONAT)
  const prov = imMonat.reduce((s: number, a: any) => s + D.provisionVon(a).hv, 0)
  const rueckhalt = auftraege.filter((a: any) => a.status === "geschaltet").reduce((s: number, a: any) => s + D.provisionVon(a).rueckhalt, 0)
  const sq = D.stornoQuote(gf ? null : ui.ich)

  return (
    <>
      <Seitenkopf titel="Door-to-Door" text={gf ? "Haustür-Vertrieb für PŸUR und TNG: Häuser, Türen, Aufträge bis zur Provision." : "Deine Häuser und Türen. Pro Tür ein Tipp."}>
        <NativeSelect size="sm" value={partner} onChange={(e) => setPartner(e.target.value)} aria-label="Partner" className="w-auto min-w-32">
          <NativeSelectOption value="alle">Alle Partner</NativeSelectOption>
          {mandate.map((m: any) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}
        </NativeSelect>
        <Button size="sm" onClick={() => setNeuHaus(true)}><LocateFixed />Haus erfassen</Button>
      </Seitenkopf>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi titel="Türen heute" wert={k.tueren} zusatz={`${k7.tueren} in 7 Tagen · ${k7.proStunde.toLocaleString("de-DE", { maximumFractionDigits: 0 })} pro Stunde`} />
        <Kpi titel="Gespräche heute" wert={k.gespraeche} zusatz={k.tueren ? Math.round(k.gespraeche / k.tueren * 100) + " % der Türen" : "noch keine Türen"} />
        <Kpi titel="Aufträge heute" wert={k.auftraege} zusatz={`${k7.pro100.toLocaleString("de-DE", { maximumFractionDigits: 1 })} je 100 Türen (7 Tage)`} />
        {gf
          ? <Kpi titel="Abdeckung" wert={ab.gesamt ? Math.round(ab.besucht / ab.gesamt * 100) + " %" : "—"} zusatz={`${ab.besucht} von ${ab.gesamt} Wohnungen besucht · Storno ${M.quote(sq)}`} />
          : <Kpi titel={"Provision im " + M.MONATSNAMEN[M.T0.getMonth()]} wert={M.eur(prov)} zusatz={`${M.eur(rueckhalt)} im Rückhalt · Storno ${M.quote(sq)}`} />}
      </div>

      <Tabs defaultValue="karte" className="gap-4">
        <TabsList>
          <TabsTrigger value="karte">Häuser</TabsTrigger>
          <TabsTrigger value="auftraege">Aufträge <Badge variant="secondary" className="ml-1 tabular">{auftraege.filter((a: any) => !D.statusVon(a.status).ende && a.status !== "geschaltet").length}</Badge></TabsTrigger>
          {gf && <TabsTrigger value="team">Team</TabsTrigger>}
        </TabsList>

        <TabsContent value="karte" className="space-y-4">
          <ToggleGroup type="single" variant="outline" size="sm" value={stadt} onValueChange={(v) => v && ui.setKartenStadt(v)} aria-label="Stadt" className="w-fit">
            {K.STAEDTE.map((s: any) => <ToggleGroupItem key={s.id} value={s.id} className="px-3">{s.name}</ToggleGroupItem>)}
          </ToggleGroup>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="gap-0 overflow-hidden p-0">
              <GebietsKarte stadt={stadt} leads={[]} version={version} hervorheben={gf ? null : ui.ich}
                objekte={inStadt.map((o: any) => ({ id: o.id, geo: o.geo, farbe: farbeObjekt(o), titel: `<b>${o.strasse} ${o.hausnr}</b><br>${D.abdeckung([o]).besucht}/${o.wohnungen.length} Türen`, radius: 5 + Math.min(5, Math.sqrt(o.wohnungen.length)) }))}
                onObjekt={(id) => setObjektId(id)} className="h-[52svh] min-h-[340px] w-full lg:h-[calc(100svh-22rem)] lg:min-h-[460px]" />
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
                {[["#94a3b8", "noch nicht besucht"], ["#3b5bdb", "angefangen"], ["#2f9e44", "mit Kunden"], ["#e03131", "keine Vertreter"]].map(([f, t]) => <span key={t} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: f }} />{t}</span>)}
              </div>
            </Card>
            <div className="flex min-w-0 flex-col gap-4">
              <Wiederkommen objekte={sichtbar} oeffnen={setObjektId} />
              <Haeuser objekte={sichtbar.filter((o: any) => o.stadt === stadt || !o.geo)} oeffnen={setObjektId} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="auftraege"><Auftraege liste={auftraege} oeffnen={setObjektId} /></TabsContent>
        {gf && <TabsContent value="team"><Team /></TabsContent>}
      </Tabs>

      <ObjektSheet id={objektId} onClose={() => setObjektId(null)} />
      <NeuesHaus offen={neuHaus} onClose={() => setNeuHaus(false)} onFertig={(id) => { setNeuHaus(false); setObjektId(id) }} mandatVorschlag={partner !== "alle" ? partner : (ich?.d2d?.freigaben || [])[0] || mandate[0]?.id} />
    </>
  )
}

function Wiederkommen({ objekte, oeffnen }: { objekte: any[]; oeffnen: (id: string) => void }) {
  const ende = new Date(); ende.setHours(23, 59, 59)
  const liste = objekte.flatMap((o: any) => o.wohnungen.filter((w: any) => w.status === "wieder" && w.wiederAm && new Date(w.wiederAm) <= ende).map((w: any) => ({ o, w })))
    .sort((a: any, b: any) => a.w.wiederAm.localeCompare(b.w.wiederAm))
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4"><CardTitle className="flex items-center gap-2"><Clock className="size-4" />Heute wiederkommen</CardTitle><CardDescription>Abends trifft man die meisten an</CardDescription></CardHeader>
      <CardContent className="px-2">
        {liste.length ? liste.slice(0, 8).map(({ o, w }: any) => (
          <button key={w.id} onClick={() => oeffnen(o.id)} className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/60">
            <span className={cn("w-12 shrink-0 pt-px font-mono text-xs tabular", new Date(w.wiederAm) < new Date() ? "text-destructive" : "text-muted-foreground")}>{new Date(w.wiederAm).toTimeString().slice(0, 5)}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{o.strasse} {o.hausnr}</span><span className="block truncate text-xs text-muted-foreground">{w.name}</span></span>
          </button>
        )) : <p className="px-2 py-3 text-sm text-muted-foreground">Für heute steht nichts an.</p>}
      </CardContent>
    </Card>
  )
}

function Haeuser({ objekte, oeffnen }: { objekte: any[]; oeffnen: (id: string) => void }) {
  const [q, setQ] = React.useState("")
  const liste = objekte.filter((o: any) => !q || (o.strasse + " " + o.hausnr + " " + o.ort).toLowerCase().includes(q.toLowerCase()))
    .map((o: any) => ({ o, ab: D.abdeckung([o]) })).sort((a: any, b: any) => a.ab.besucht / a.ab.gesamt - b.ab.besucht / b.ab.gesamt)
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4"><CardTitle className="flex items-center gap-2"><Building className="size-4" />Häuser</CardTitle><CardDescription>{M.plural(objekte.length, "Haus", "Häuser")}, am wenigsten besuchte zuerst</CardDescription></CardHeader>
      <CardContent className="space-y-2 px-2">
        <div className="px-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Straße suchen" aria-label="Häuser durchsuchen" className="h-8" /></div>
        <div className="max-h-80 overflow-y-auto">
          {liste.slice(0, 60).map(({ o, ab }: any) => (
            <button key={o.id} onClick={() => oeffnen(o.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/60">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: farbeObjekt(o) }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{o.strasse} {o.hausnr}</span>
                <Progress value={ab.gesamt ? ab.besucht / ab.gesamt * 100 : 0} className="mt-1 h-1" /></span>
              <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">{ab.besucht}/{ab.gesamt}</span>
            </button>
          ))}
          {!liste.length && <p className="px-2 py-3 text-sm text-muted-foreground">Noch keine Häuser. Über „Haus erfassen“ oder den Import (Bereich Door-to-Door) anlegen.</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function Auftraege({ liste, oeffnen }: { liste: any[]; oeffnen: (id: string) => void }) {
  const ui = useUI()
  const gf = ui.istGF
  const [filter, setFilter] = React.useState("offen")
  const [nrFuer, setNrFuer] = React.useState<any>(null)
  const [nr, setNr] = React.useState("")
  const [importAuf, setImportAuf] = React.useState(false)
  const gezeigt = liste.filter((a: any) => filter === "alle" ? true : filter === "offen" ? !D.statusVon(a.status).ende && a.status !== "geschaltet" : filter === "geschaltet" ? a.status === "geschaltet" : D.statusVon(a.status).ende)
    .sort((a: any, b: any) => b.datum.localeCompare(a.datum))
  const setze = (a: any, s: string, x?: any) => { toast(D.auftragStatus(a, s, x)); bump() }
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1.5"><CardTitle>Aufträge</CardTitle><CardDescription>Erfasst → Bestätigungsanruf → beim Partner → geschaltet. Provision wird mit der Schaltung fällig, Widerruf geht 14 Tage.</CardDescription></div>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v)}>
            <ToggleGroupItem value="offen" className="px-3">In Arbeit</ToggleGroupItem><ToggleGroupItem value="geschaltet" className="px-3">Geschaltet</ToggleGroupItem>
            <ToggleGroupItem value="storno" className="px-3">Storno</ToggleGroupItem><ToggleGroupItem value="alle" className="px-3">Alle</ToggleGroupItem>
          </ToggleGroup>
          {gf && <Button size="sm" variant="outline" onClick={() => setImportAuf(true)}><FileUp />Partner-Liste einlesen</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Kunde</TableHead><TableHead className="hidden md:table-cell">Partner / Produkt</TableHead><TableHead className="hidden sm:table-cell">Vertriebler</TableHead><TableHead>Status</TableHead><TableHead className="hidden text-right lg:table-cell">Provision</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
          <TableBody>
            {gezeigt.slice(0, 200).map((a: any) => {
              const o = D.objekt(a.objekt), p = D.provisionVon(a)
              const widerrufOffen = D.widerrufBis(a) >= M.HEUTE && !D.statusVon(a.status).ende
              return (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap tabular text-xs">{M.dKurz(a.datum)}{widerrufOffen && <div className="text-muted-foreground">Widerruf bis {M.dKurz(D.widerrufBis(a))}</div>}</TableCell>
                  <TableCell><button className="text-left" onClick={() => o && oeffnen(o.id)}><div className="font-medium">{a.kunde?.name || "Kunde"}</div><div className="text-xs text-muted-foreground">{o ? o.strasse + " " + o.hausnr : ""}{a.partnerNr ? " · " + a.partnerNr : ""}</div></button></TableCell>
                  <TableCell className="hidden md:table-cell"><div>{M.mandat(a.mandat)?.name}</div><div className="text-xs text-muted-foreground">{a.produkt}</div></TableCell>
                  <TableCell className="hidden sm:table-cell"><PersonAvatar id={a.wer} /></TableCell>
                  <TableCell><AuftragBadge a={a} /></TableCell>
                  <TableCell className="hidden text-right tabular lg:table-cell">{gf ? M.eur(p.lumio) : M.eur(p.hv)}{a.status === "geschaltet" && p.rueckhalt > 0 && <div className="text-xs text-muted-foreground">{M.eur(p.rueckhalt)} Rückhalt</div>}</TableCell>
                  <TableCell>
                    {(gf || a.wer === ui.ich) && !D.statusVon(a.status).ende && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="Status ändern"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {gf && a.status === "erfasst" && <DropdownMenuItem onClick={() => setze(a, "bestaetigt")}>Bestätigungsanruf: Kunde bestätigt</DropdownMenuItem>}
                          {gf && ["erfasst", "bestaetigt"].includes(a.status) && <DropdownMenuItem onClick={() => { setNr(a.partnerNr || ""); setNrFuer(a) }}>Beim Partner eingereicht …</DropdownMenuItem>}
                          {gf && a.status === "eingereicht" && <DropdownMenuItem onClick={() => setze(a, "geschaltet")}>Geschaltet</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setze(a, "widerrufen")} className="text-destructive">Kunde hat widerrufen</DropdownMenuItem>
                          {gf && <DropdownMenuItem onClick={() => setze(a, "storniert")} className="text-destructive">Storniert</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {!gezeigt.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Keine Aufträge.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!nrFuer} onOpenChange={(o) => !o && setNrFuer(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Beim Partner eingereicht</DialogTitle><DialogDescription>Auftragsnummer vom Partner, damit spätere Listen automatisch zugeordnet werden.</DialogDescription></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setze(nrFuer, "eingereicht", { partnerNr: nr.trim() }); setNrFuer(null) }} className="grid gap-3">
            <Input value={nr} onChange={(e) => setNr(e.target.value)} placeholder="z. B. PY-123456" aria-label="Auftragsnummer" autoFocus />
            <DialogFooter><Button type="submit">Speichern</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <PartnerListe offen={importAuf} onClose={() => setImportAuf(false)} />
    </Card>
  )
}

/* Monatsliste des Partners: Auftragsnummer und Status. Ordnet sich über die Auftragsnummer zu. */
function PartnerListe({ offen, onClose }: { offen: boolean; onClose: () => void }) {
  const [text, setText] = React.useState("")
  const zeilen = text.split(/\r?\n/).map((z) => z.split(/[;\t,]/).map((x) => x.trim())).filter((z) => z[0])
  const deuten = (s: string) => /storn|kündig|abgelehnt/i.test(s) ? "storniert" : /widerruf/i.test(s) ? "widerrufen" : /geschaltet|aktiv|installiert|provision/i.test(s) ? "geschaltet" : null
  const treffer = zeilen.map((z) => ({ nr: z[0], status: deuten(z.slice(1).join(" ")), a: D.AUFTRAEGE.find((a: any) => a.partnerNr && a.partnerNr.toLowerCase() === z[0].toLowerCase()) }))
  const anwendbar = treffer.filter((t) => t.a && t.status && t.a.status !== t.status)
  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Partner-Liste einlesen</DialogTitle><DialogDescription>Aus der Abrechnung oder Statusliste von PŸUR oder TNG: je Zeile Auftragsnummer und Status, z. B. „PY-123456; geschaltet“.</DialogDescription></DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-32 font-mono text-xs" placeholder={"PY-123456;geschaltet\nPY-654321;storniert"} aria-label="Partner-Liste" />
        {zeilen.length > 0 && <p className="text-sm text-muted-foreground">{zeilen.length} Zeilen · {treffer.filter((t) => t.a).length} Aufträge gefunden · {anwendbar.length} Änderungen · {treffer.filter((t) => !t.a).length} unbekannte Nummern</p>}
        <DialogFooter><Button disabled={!anwendbar.length} onClick={() => { anwendbar.forEach((t) => D.auftragStatus(t.a, t.status!)); bump(); toast(M.plural(anwendbar.length, "Auftrag", "Aufträge") + " aktualisiert"); setText(""); onClose() }}>{M.plural(anwendbar.length, "Änderung", "Änderungen")} übernehmen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Team() {
  const [bearbeiten, setBearbeiten] = React.useState<any>(null)
  const leute = M.PERSONEN.filter((p: any) => p.rolle === "hv")
  const mandate = D.mandateD2D()
  return (
    <Card>
      <CardHeader><CardTitle>Vertriebler an der Haustür</CardTitle><CardDescription>Letzte 7 Tage. Ohne Freigabe (Ausweis, Schulung, Partner) kann niemand Aufträge anlegen.</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Person</TableHead><TableHead className="text-right">Türen</TableHead><TableHead className="hidden text-right sm:table-cell">Gespräche</TableHead><TableHead className="text-right">Aufträge</TableHead><TableHead className="hidden text-right md:table-cell">je 100 Türen</TableHead><TableHead className="text-right">Storno</TableHead><TableHead>Freigabe</TableHead></TableRow></TableHeader>
          <TableBody>
            {leute.map((p: any) => {
              const k = D.kennzahlen((b: any) => b.wer === p.id && M.tageZwischen(b.zeit.slice(0, 10), M.HEUTE) < 7)
              const sq = D.stornoQuote(p.id)
              const fr = (p.d2d?.freigaben || []).map((id: string) => M.mandat(id)?.name).filter(Boolean)
              return (
                <TableRow key={p.id}>
                  <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} /><span className="font-medium">{p.voll}</span></div></TableCell>
                  <TableCell className="text-right tabular">{k.tueren}</TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{k.gespraeche}</TableCell>
                  <TableCell className="text-right tabular">{k.auftraege}</TableCell>
                  <TableCell className="hidden text-right tabular md:table-cell">{k.tueren ? k.pro100.toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "—"}</TableCell>
                  <TableCell className={cn("text-right tabular", sq !== null && sq > 0.25 && "text-destructive")}>{M.quote(sq)}</TableCell>
                  <TableCell><button onClick={() => setBearbeiten(p)} className="flex flex-wrap gap-1 text-left">
                    {fr.length ? fr.map((n: string) => <Badge key={n} variant="outline" className="border-transparent bg-ok/15 font-normal text-ok">{n}</Badge>) : <Badge variant="outline" className="font-normal text-muted-foreground">keine</Badge>}
                  </button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
      <FreigabeDialog p={bearbeiten} mandate={mandate} onClose={() => setBearbeiten(null)} />
    </Card>
  )
}

function FreigabeDialog({ p, mandate, onClose }: { p: any; mandate: any[]; onClose: () => void }) {
  const [w, setW] = React.useState<any>({ ausweis: "", schulung: "", freigaben: [] })
  React.useEffect(() => { if (p) setW({ ausweis: p.d2d?.ausweis || "", schulung: p.d2d?.schulung || "", freigaben: [...(p.d2d?.freigaben || [])] }) }, [p?.id])
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Freigabe für {p?.voll}</DialogTitle><DialogDescription>Haustürkodex: Ausweis mit Foto, Schulung vor dem ersten Einsatz, Freigabe je Partner.</DialogDescription></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); p.d2d = { ...(p.d2d || {}), ...w }; bump(); toast("Freigabe gespeichert"); onClose() }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="fa" className="text-xs text-muted-foreground">Ausweis-Nr.</Label><Input id="fa" value={w.ausweis} onChange={(e) => setW({ ...w, ausweis: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="fs" className="text-xs text-muted-foreground">Schulung am</Label><Input id="fs" type="date" value={w.schulung} onChange={(e) => setW({ ...w, schulung: e.target.value })} /></div>
          </div>
          <div className="grid gap-2"><span className="text-xs text-muted-foreground">Darf Aufträge schreiben für</span>
            {mandate.map((m: any) => (
              <label key={m.id} className="flex items-center gap-2 text-sm"><Checkbox checked={w.freigaben.includes(m.id)} onCheckedChange={(v) => setW({ ...w, freigaben: v ? [...w.freigaben, m.id] : w.freigaben.filter((x: string) => x !== m.id) })} />{m.name}</label>
            ))}
          </div>
          {w.freigaben.length > 0 && (!w.ausweis || !w.schulung) && <p className="text-sm text-warn">Ohne Ausweis und Schulung bitte nicht freigeben.</p>}
          <DialogFooter><Button type="submit"><ShieldCheck />Speichern</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NeuesHaus({ offen, onClose, onFertig, mandatVorschlag }: { offen: boolean; onClose: () => void; onFertig: (id: string) => void; mandatVorschlag?: string }) {
  const ui = useUI()
  const mandate = D.mandateD2D()
  const [w, setW] = React.useState<any>({})
  const [geo, setGeo] = React.useState<any>(null)
  const [suche, setSuche] = React.useState(false)
  const [hinweis, setHinweis] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!offen) return
    setW({ mandat: mandatVorschlag || mandate[0]?.id || "", strasse: "", hausnr: "", plz: "", ort: "", we: 1, betreuer: ui.istGF ? (M.PERSONEN.find((p: any) => p.rolle === "hv")?.id || "") : ui.ich })
    setGeo(null); setHinweis(null); orten()
  }, [offen])
  function orten() {
    setSuche(true)
    const zurueck = () => { const b = K.beispielPunkt(ui.kartenStadt, null); setGeo({ lat: b.lat + 0.002, lng: b.lng + 0.002 }); setHinweis("GPS ist hier gesperrt. In der Vorschau nehme ich einen Beispielpunkt, in der App steht hier dein Standort."); setSuche(false) }
    if (!("geolocation" in navigator)) return zurueck()
    navigator.geolocation.getCurrentPosition(async (p) => {
      const g = { lat: p.coords.latitude, lng: p.coords.longitude }
      setGeo(g); setSuche(false)
      const a = await K.adresseZu(g)
      if (a?.adresse) {
        const m = a.adresse.match(/^(.*?)\s+(\d+\w*)?,\s*(\d{5})?\s*(.*)$/)
        if (m) setW((x: any) => ({ ...x, strasse: m[1] || x.strasse, hausnr: m[2] || x.hausnr, plz: m[3] || x.plz, ort: m[4] || x.ort }))
      }
    }, zurueck, { enableHighAccuracy: true, timeout: 8000 })
  }
  const set = (k: string, v: any) => setW((x: any) => ({ ...x, [k]: v }))
  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Haus erfassen</DialogTitle><DialogDescription>Vor dem Haus antippen. Danach jede Tür einzeln notieren.</DialogDescription></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => {
          e.preventDefault()
          const o = D.objektAnlegen({ ...w, geo }, ui.ich)
          bump(); toast(`${o.strasse} ${o.hausnr} angelegt`); onFertig(o.id)
        }}>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">{suche ? <><Loader2 className="size-3.5 animate-spin" />Standort wird gesucht …</> : geo ? <>📍 {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</> : "Ohne Standort"}</p>
          {hinweis && <p className="rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">{hinweis}</p>}
          <div className="grid gap-1.5"><Label htmlFor="hm" className="text-xs text-muted-foreground">Partner</Label>
            <NativeSelect id="hm" value={w.mandat || ""} onChange={(e) => set("mandat", e.target.value)} required>{mandate.map((m: any) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}</NativeSelect></div>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="grid gap-1.5"><Label htmlFor="hs" className="text-xs text-muted-foreground">Straße</Label><Input id="hs" value={w.strasse || ""} onChange={(e) => set("strasse", e.target.value)} required /></div>
            <div className="grid gap-1.5"><Label htmlFor="hn" className="text-xs text-muted-foreground">Nr.</Label><Input id="hn" value={w.hausnr || ""} onChange={(e) => set("hausnr", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-[6rem_1fr_7rem] gap-3">
            <div className="grid gap-1.5"><Label htmlFor="hp" className="text-xs text-muted-foreground">PLZ</Label><Input id="hp" value={w.plz || ""} onChange={(e) => set("plz", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="ho" className="text-xs text-muted-foreground">Ort</Label><Input id="ho" value={w.ort || ""} onChange={(e) => set("ort", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="hw" className="text-xs text-muted-foreground">Wohnungen</Label><Input id="hw" type="number" min={1} max={300} value={w.we || 1} onChange={(e) => set("we", e.target.value)} /></div>
          </div>
          {ui.istGF && <div className="grid gap-1.5"><Label htmlFor="hb" className="text-xs text-muted-foreground">Vertriebler</Label>
            <NativeSelect id="hb" value={w.betreuer || ""} onChange={(e) => set("betreuer", e.target.value)} required>{M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}</NativeSelect></div>}
          <DialogFooter><Button type="submit" disabled={!w.mandat}>Haus anlegen</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
