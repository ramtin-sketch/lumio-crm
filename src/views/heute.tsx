import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Kpi, PersonAvatar, Seitenkopf, ZielBar } from "@/bits"
import { LeadZeile, kontext } from "@/lead-zeile"
import { useDaten, useUI } from "@/store"
import * as M from "@/model/model.js"
import { Button } from "@/components/ui/button"
import { CalendarClock, ListTodo, LocateFixed } from "lucide-react"
import * as A from "@/model/akte.js"
import { oeffneAkte } from "@/mandat-akte"

function Leer({ titel, text }: { titel: string; text?: string }) {
  return <Empty className="py-8"><EmptyHeader><EmptyTitle className="text-sm">{titel}</EmptyTitle>{text && <EmptyDescription>{text}</EmptyDescription>}</EmptyHeader></Empty>
}

export function Heute() {
  useDaten()
  const ui = useUI()
  const ich = M.person(ui.ich)
  const mine = M.LEADS.filter((l: any) => l.betreuer === ui.ich && M.istOffen(l))
  const termine = mine.filter((l: any) => l.next && l.next.datum === M.HEUTE && l.next.zeit).sort((a: any, b: any) => a.next.zeit.localeCompare(b.next.zeit))
  const todo = mine.filter((l: any) => l.next && l.next.datum <= M.HEUTE && !(l.next.datum === M.HEUTE && l.next.zeit)).sort((a: any, b: any) => a.next.datum.localeCompare(b.next.datum))
  const ueber = todo.filter(M.ueberfaellig).length
  const bald = mine.filter((l: any) => l.next && l.next.datum > M.HEUTE && M.tageZwischen(M.HEUTE, l.next.datum) <= 3)
    .sort((a: any, b: any) => (a.next.datum + (a.next.zeit || "")).localeCompare(b.next.datum + (b.next.zeit || "")))
  const tagText = `${M.WOCHENTAGE[M.T0.getDay()]}, ${M.T0.getDate()}. ${M.MONATSNAMEN[M.T0.getMonth()]}`

  const anruf = M.anrufTag(ui.ich, M.HEUTE)
  const setter = ich.rolle === "setter"
  const sc = M.setterCloser(ui.ich, "sechs")
  const prov = M.LEADS.filter((l: any) => l.betreuer === ui.ich && l.abschluss && M.ym(l.abschluss.datum) === M.MONAT).reduce((s: number, l: any) => s + M.hvAnteil(l), 0)

  return (
    <>
      <Seitenkopf titel={tagText} text={`Hallo ${ich.name}. Das steht heute an.`}>
        {ich.rolle === "hv" && <Button onClick={() => ui.setErfassen(true)}><LocateFixed />Standort hier erfassen</Button>}
      </Seitenkopf>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titel="Termine heute" wert={termine.length} zusatz={termine.length ? "nächster um " + termine[0].next.zeit : "keine festen Termine"} />
        <Kpi titel="Zu erledigen" wert={todo.length} zusatz="Rückrufe und Aufgaben" />
        <Kpi titel="Überfällig" wert={ueber} kritisch={ueber > 0} zusatz={ueber ? "bitte zuerst" : "alles im Plan"} />
        {setter
          ? <Kpi titel="Show-Rate" wert={M.quote(sc.showRate)} kritisch={sc.showRate !== null && sc.showRate < 0.75} zusatz={`${anruf.wahl} Anrufe heute · ${M.plural(anruf.termine, "Termin", "Termine")}`} />
          : ui.istGF
          ? <Kpi titel="Anrufe heute" wert={anruf.wahl} zusatz={`${anruf.erreicht} erreicht · ${M.plural(anruf.termine, "Termin", "Termine")}`} />
          : <Kpi titel={"Provision im " + M.MONATSNAMEN[M.T0.getMonth()]} wert={M.eur(prov)} zusatz={<ZielBar betrag={prov} prognose={M.hochrechnungBetrag(prov)} className="mt-1.5" />} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Termine heute</CardTitle><CardDescription>Mit fester Uhrzeit</CardDescription></CardHeader>
          <CardContent className="px-4">
            {termine.length ? termine.map((l: any) => <LeadZeile key={l.id} l={l} wann={l.next.zeit} unter={kontext(l, l.next.text)} />) : <Leer titel="Heute keine festen Termine" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Zu erledigen</CardTitle><CardDescription>Fällig heute und überfällig</CardDescription></CardHeader>
          <CardContent className="px-4">
            {todo.length ? todo.map((l: any) => <LeadZeile key={l.id} l={l} wann={M.ueberfaellig(l) ? M.wann(l.next) : "Heute"} rot={M.ueberfaellig(l)} unter={kontext(l, l.next.text)} />)
              : <Leer titel="Nichts offen" text="Gut." />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Nächste drei Tage</CardTitle></CardHeader>
          <CardContent className="px-4">
            {bald.length ? bald.map((l: any) => <LeadZeile key={l.id} l={l} wann={M.wann(l.next)} unter={kontext(l, l.next.text)} />) : <Leer titel="Noch nichts geplant" />}
          </CardContent>
        </Card>
        {ui.istGF ? <UebergabenKarte /> : setter ? <GesetztKarte /> : <EingereichtKarte />}
      </div>
      {ui.istGF && <MandatSchritteKarte />}
      {ui.istGF && <AussendienstKarte />}
    </>
  )
}

function MandatSchritteKarte() {
  const liste = A.offen().filter((t: any) => M.tageZwischen(M.HEUTE, t.datum) <= 7).slice(0, 8)
  const name = (mid: string) => (M.MANDATE as any[]).find((m) => m.id === mid)?.name || "Mandat"
  return (
    <Card>
      <CardHeader><CardTitle>Mandate: nächste Schritte</CardTitle><CardDescription>Termine und Aufgaben mit euren Partnern, die nächsten 7 Tage und Überfälliges</CardDescription></CardHeader>
      <CardContent className="px-4">
        {liste.length ? liste.map((t: any) => {
          const rot = A.ueberfaellig(t)
          return (
            <button key={t.id} type="button" onClick={() => oeffneAkte(t.mandat)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/60">
              {t.art === "aufgabe" ? <ListTodo className="size-4 shrink-0 text-muted-foreground" /> : <CalendarClock className="size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{t.titel}</span><span className="block truncate text-xs text-muted-foreground">{name(t.mandat)}{t.ort ? " · " + t.ort : ""}</span></span>
              <span className={"shrink-0 font-mono text-xs tabular " + (rot ? "text-destructive" : "text-muted-foreground")}>{t.datum === M.HEUTE ? "Heute" + (t.zeit ? " " + t.zeit : "") : A.zeitText(t)}</span>
            </button>
          )
        }) : <Leer titel="Bei den Mandaten ist nichts fällig" text="Neue Schritte legst du in der Akte eines Mandats an." />}
      </CardContent>
    </Card>
  )
}

function AussendienstKarte() {
  const ui = useUI()
  const neu = M.LEADS.filter((l: any) => l.abschluss).sort((a: any, b: any) => b.abschluss.datum.localeCompare(a.abschluss.datum)).slice(0, 4)
  return (
    <Card>
      <CardHeader><CardTitle>Außendienst heute</CardTitle><CardDescription>Klick öffnet die Standorte des Handelsvertreters</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <Table>
          <TableHeader><TableRow><TableHead>Handelsvertreter</TableHead><TableHead className="text-right">Termine</TableHead><TableHead className="text-right">Fällig</TableHead><TableHead className="text-right">Freigegeben</TableHead></TableRow></TableHeader>
          <TableBody>
            {M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => {
              const ls = M.LEADS.filter((l: any) => l.betreuer === p.id)
              return (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => ui.geheZu("standort", { hv: p.id })}>
                  <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} />{p.voll}</div></TableCell>
                  <TableCell className="text-right tabular">{ls.filter((l: any) => M.istOffen(l) && l.next && l.next.datum === M.HEUTE && l.next.zeit).length}</TableCell>
                  <TableCell className="text-right tabular">{ls.filter((l: any) => M.faellig(l) && !(l.next.zeit && l.next.datum === M.HEUTE)).length}</TableCell>
                  <TableCell className="text-right tabular">{ls.filter((l: any) => l.abschluss && M.ym(l.abschluss.datum) === M.MONAT).length}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div>
          <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">Letzte Abschlüsse</div>
          {neu.map((l: any) => <LeadZeile key={l.id} l={l} wann={M.dKurz(l.abschluss.datum)} unter={kontext(l, M.eur(M.lumioGesamt(l)))} />)}
        </div>
      </CardContent>
    </Card>
  )
}

function EingereichtKarte() {
  const ui = useUI()
  const pipe = M.LEADS.filter((l: any) => l.betreuer === ui.ich && M.istOffen(l) && l.stufe === "eingereicht")
  return (
    <Card>
      <CardHeader><CardTitle>Beim Mandanten zur Freigabe</CardTitle><CardDescription>Was dir die Freigabe bringt</CardDescription></CardHeader>
      <CardContent className="px-4">
        {pipe.length ? pipe.map((l: any) => { const m = M.mandat(l.mandat); return <LeadZeile key={l.id} l={l} wann="offen" unter={kontext(l, "bringt dir " + M.eur(m.k.betrag * m.hv / 100))} /> })
          : <Leer titel="Gerade nichts eingereicht" />}
      </CardContent>
    </Card>
  )
}

function UebergabenKarte() {
  const ui = useUI()
  const an = M.TERMINE.filter((t: any) => t.status === "geplant" && t.closer === ui.ich)
    .sort((a: any, b: any) => (a.datum + (a.zeit || "")).localeCompare(b.datum + (b.zeit || "")))
  const lead = (id: number) => M.LEADS.find((l: any) => l.id === id)
  return (
    <Card>
      <CardHeader><CardTitle>Deine Closing-Termine</CardTitle><CardDescription>Gesetzt von dir oder für dich, mit Briefing</CardDescription></CardHeader>
      <CardContent className="px-4">
        {an.length ? an.map((t: any) => { const l = lead(t.lead); return l && <LeadZeile key={t.id} l={l} wann={M.wann({ datum: t.datum, zeit: t.zeit })} unter={kontext(l, t.setter === ui.ich ? "selbst gesetzt" : "von " + M.person(t.setter).name)} /> })
          : <Leer titel="Keine Closing-Termine offen" />}
      </CardContent>
    </Card>
  )
}

function GesetztKarte() {
  const ui = useUI()
  const offen = M.TERMINE.filter((t: any) => t.setter === ui.ich && t.status === "geplant")
  const neu = M.LEADS.filter((l: any) => l.terminStatus === "noshow" && M.istOffen(l) && l.betreuer === ui.ich)
  const lead = (id: number) => M.LEADS.find((l: any) => l.id === id)
  return (
    <Card>
      <CardHeader><CardTitle>Deine übergebenen Termine</CardTitle><CardDescription>Was beim Closer liegt und was zurückkam</CardDescription></CardHeader>
      <CardContent className="px-4">
        {neu.map((l: any) => <LeadZeile key={l.id} l={l} wann="No-Show" rot unter={kontext(l, "neu terminieren")} />)}
        {offen.map((t: any) => { const l = lead(t.lead); return l && <LeadZeile key={t.id} l={l} wann={M.wann({ datum: t.datum, zeit: t.zeit })} unter={kontext(l, "bei " + M.person(t.closer).name)} /> })}
        {!offen.length && !neu.length && <Leer titel="Gerade nichts übergeben" />}
      </CardContent>
    </Card>
  )
}
