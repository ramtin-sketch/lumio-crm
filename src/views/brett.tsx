import * as React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PersonAvatar, Seitenkopf, StufeBadge } from "@/bits"
import { bump, useDaten, useUI } from "@/store"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { ArrowRight, CalendarClock, Flame, KanbanSquare, List, Plus, Search } from "lucide-react"

function sortOffen(a: any, b: any) {
  const da = a.next ? a.next.datum : "9999", db = b.next ? b.next.datum : "9999"
  return da.localeCompare(db) || b.temp - a.temp
}

export function Brett({ bereich }: { bereich: "werbung" | "bildung" | "standort" }) {
  useDaten()
  const ui = useUI()
  const mobil = useIsMobile()
  const [ansicht, setAnsicht] = React.useState("brett")
  const [q, setQ] = React.useState("")
  const [nurMeine, setNurMeine] = React.useState(false)
  const [mobilStufe, setMobilStufe] = React.useState(bereich !== "standort" ? "setting" : "eigentuemer")
  const [ziehe, setZiehe] = React.useState<number | null>(null)
  const [ueber, setUeber] = React.useState<string | null>(null)
  const gf = ui.istGF

  let ls = M.LEADS.filter((l: any) => l.bereich === bereich)
  if (!gf) ls = ls.filter((l: any) => l.betreuer === ui.ich)
  if (ui.mandatFilter !== "alle") ls = ls.filter((l: any) => l.mandat === ui.mandatFilter)
  if (gf && bereich === "standort" && ui.hvFilter !== "alle") ls = ls.filter((l: any) => l.betreuer === ui.hvFilter)
  if (gf && bereich !== "standort" && nurMeine) ls = ls.filter((l: any) => l.betreuer === ui.ich || l.setter === ui.ich || l.closer === ui.ich)
  if (q) { const s = q.toLowerCase(); ls = ls.filter((l: any) => (l.name + " " + (l.ort || "") + " " + l.kontakte.map((k: any) => k.name).join(" ")).toLowerCase().includes(s)) }
  const stufen = M.STUFEN[bereich].filter((s: any) => !s.ende)
  const won = ls.filter((l: any) => l.stufe === "gewonnen"), lost = ls.filter((l: any) => l.stufe === "verloren")
  const wonM = won.filter((l: any) => l.abschluss && M.ym(l.abschluss.datum) === M.MONAT).length

  const ablegen = (stufe: string) => {
    const l = M.LEADS.find((x: any) => x.id === ziehe)
    setZiehe(null); setUeber(null)
    if (!l || l.stufe === stufe) return
    l.stufe = stufe
    M.verlauf(l, ui.ich, "stufe", "Phase: " + M.stufeVon(l).name)
    bump(); toast(`${l.name} → ${M.stufeVon(l).name}`)
  }

  const titel = bereich === "werbung" ? "Werbemandate" : bereich === "bildung" ? "Weiterbildung" : gf ? "Standortakquise" : "Meine Standorte"
  const text = bereich === "werbung" ? "Werbekunden am Telefon: setzen, Termin, closen." : bereich === "bildung" ? "Arbeitgeber am Telefon für geförderte Weiterbildung: setzen, Termin, Übergabe an den Bildungsträger." : gf ? "Handelsvertreter draußen: Eigentümer, Besichtigung, Freigabe beim Mandanten." : "Deine Objekte von der Recherche bis zur Freigabe."

  return (
    <>
      <Seitenkopf titel={titel} text={text}>
        <Button size="sm" variant="outline" onClick={() => ui.setNeu({ bereich, mandat: ui.mandatFilter !== "alle" ? ui.mandatFilter : undefined })}><Plus />{bereich === "werbung" ? "Werbekunde" : bereich === "bildung" ? "Arbeitgeber" : "Standort"}</Button>
      </Seitenkopf>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect size="sm" value={ui.mandatFilter} onChange={(e) => ui.setMandatFilter(e.target.value)} aria-label="Mandat" className="w-auto min-w-40">
          <NativeSelectOption value="alle">Alle Mandate</NativeSelectOption>
          {M.MANDATE.filter((m: any) => m.bereich === bereich).map((m: any) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}
        </NativeSelect>
        {gf && bereich === "standort" && (
          <NativeSelect size="sm" value={ui.hvFilter} onChange={(e) => ui.setHvFilter(e.target.value)} aria-label="Handelsvertreter" className="w-auto min-w-44">
            <NativeSelectOption value="alle">Alle Handelsvertreter</NativeSelectOption>
            {M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}
          </NativeSelect>
        )}
        {gf && bereich !== "standort" && (
          <div className="flex items-center gap-2 px-1">
            <Checkbox id="nurmeine" checked={nurMeine} onCheckedChange={(v) => setNurMeine(!!v)} />
            <Label htmlFor="nurmeine" className="text-sm font-normal">Nur meine</Label>
          </div>
        )}
        <div className="relative min-w-48 flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Ort, Ansprechpartner" className="h-8 pl-8" aria-label="Suchen" />
        </div>
        <Tabs value={ansicht} onValueChange={setAnsicht} className="ml-auto">
          <TabsList className="h-8">
            <TabsTrigger value="brett" className="px-2.5"><KanbanSquare />Brett</TabsTrigger>
            <TabsTrigger value="liste" className="px-2.5"><List />Liste</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {ansicht === "liste" ? <Liste ls={ls} /> : (
        <>
          {mobil && (
            <Tabs value={mobilStufe} onValueChange={setMobilStufe}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {stufen.map((s: any) => <TabsTrigger key={s.id} value={s.id} className="flex-none">{s.name}<Badge variant="secondary" className="ml-1 h-4 px-1 tabular">{ls.filter((l: any) => l.stufe === s.id).length}</Badge></TabsTrigger>)}
              </TabsList>
            </Tabs>
          )}
          <div className={cn("grid gap-3", mobil ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-4")}>
            {stufen.filter((s: any) => !mobil || s.id === mobilStufe).map((s: any) => {
              const inS = ls.filter((l: any) => l.stufe === s.id).sort(sortOffen)
              return (
                <div key={s.id}
                  onDragOver={(e) => { if (ziehe !== null){ e.preventDefault(); setUeber(s.id) } }}
                  onDragLeave={() => setUeber((u) => (u === s.id ? null : u))}
                  onDrop={(e) => { e.preventDefault(); ablegen(s.id) }}
                  className={cn("flex min-w-0 flex-col gap-2 rounded-xl border border-transparent bg-muted/50 p-2 transition-colors", ueber === s.id && "border-dashed border-ring bg-muted")}>
                  {!mobil && (
                    <div className="flex items-center justify-between px-1.5 pt-1 pb-0.5">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Badge variant="secondary" className="tabular">{inS.length}</Badge>
                    </div>
                  )}
                  {inS.length === 0 && <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{ziehe !== null ? "Hier ablegen" : "Leer"}</div>}
                  {inS.map((l: any) => <LeadKarte key={l.id} l={l} onDrag={(an) => setZiehe(an ? l.id : null)} />)}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => setAnsicht("liste")}>{bereich === "werbung" ? "Abgeschlossen" : bereich === "bildung" ? "Angemeldet" : "Freigegeben"}: {won.length} <span className="text-muted-foreground">({wonM} im {M.MONATSNAMEN[M.T0.getMonth()]})</span></Button>
            <Button variant="ghost" size="sm" onClick={() => setAnsicht("liste")}>{bereich !== "standort" ? "Verloren" : "Abgelehnt"}: {lost.length}</Button>
            {!mobil && <span className="ml-auto text-xs">Tipp: Karten mit der Maus in eine andere Spalte ziehen</span>}
          </div>
        </>
      )}
    </>
  )
}

function LeadKarte({ l, onDrag }: { l: any; onDrag: (an: boolean) => void }) {
  const ui = useUI()
  const m = M.mandat(l.mandat)
  const rot = M.ueberfaellig(l)
  return (
    <Card draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDrag(true) }} onDragEnd={() => onDrag(false)}
      onClick={() => ui.oeffne(l.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") ui.oeffne(l.id) }}
      className="cursor-pointer gap-2 rounded-lg px-3 py-3 shadow-xs transition-all hover:-translate-y-px hover:border-ring/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{l.name}</div>
          <div className="truncate text-xs text-muted-foreground">{l.ort} · {m.name}</div>
        </div>
        {l.temp === 2 && <Flame className="size-4 shrink-0 text-destructive" aria-label="heiß" />}
        {l.temp === 1 && <Flame className="size-4 shrink-0 text-warn" aria-label="warm" />}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className={cn("flex min-w-0 items-center gap-1 text-xs text-muted-foreground", rot && "text-destructive")}>
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="truncate">{l.next ? M.wann(l.next) + " · " + l.next.text : "Kein nächster Schritt"}</span>
        </div>
        {M.istTel(l) && l.setter && l.closer && l.setter !== l.closer
          ? <div className="flex shrink-0 items-center gap-0.5"><PersonAvatar id={l.setter} /><ArrowRight className="size-3 text-muted-foreground" /><PersonAvatar id={l.closer} /></div>
          : <PersonAvatar id={l.betreuer} />}
      </div>
    </Card>
  )
}

function Liste({ ls }: { ls: any[] }) {
  const ui = useUI()
  const offen = ls.filter(M.istOffen).sort(sortOffen)
  const zu = ls.filter((l: any) => !M.istOffen(l)).sort((a: any, c: any) => ((c.abschluss && c.abschluss.datum) || c.angelegt).localeCompare((a.abschluss && a.abschluss.datum) || a.angelegt))
  const zeigen = offen.concat(zu.slice(0, 60))
  return (
    <Card className="py-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="pl-4">Name</TableHead><TableHead className="hidden md:table-cell">Mandat</TableHead><TableHead>Phase</TableHead>
          <TableHead className="hidden sm:table-cell">Nächster Schritt</TableHead><TableHead className="hidden md:table-cell">Betreuer</TableHead><TableHead className="pr-4 text-right">LUMIO</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {zeigen.map((l: any) => (
            <TableRow key={l.id} className="cursor-pointer" onClick={() => ui.oeffne(l.id)}>
              <TableCell className="pl-4"><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.ort}</div></TableCell>
              <TableCell className="hidden md:table-cell">{M.mandat(l.mandat).name}</TableCell>
              <TableCell><StufeBadge l={l} /></TableCell>
              <TableCell className={cn("hidden max-w-64 truncate sm:table-cell", M.ueberfaellig(l) && "text-destructive")}>
                {l.next ? M.wann(l.next) + " · " + l.next.text : l.abschluss ? M.dKurz(l.abschluss.datum) : l.verlustgrund || ""}
              </TableCell>
              <TableCell className="hidden md:table-cell"><PersonAvatar id={l.betreuer} /></TableCell>
              <TableCell className="pr-4 text-right tabular">{l.abschluss ? M.eur(M.lumioGesamt(l)) : ""}</TableCell>
            </TableRow>
          ))}
          {zeigen.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Keine Einträge für diese Auswahl.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {zu.length > 60 && <div className="border-t px-4 py-3 text-xs text-muted-foreground">{zu.length - 60} ältere abgeschlossene Einträge ausgeblendet. Über die Suche findest du sie.</div>}
    </Card>
  )
}
