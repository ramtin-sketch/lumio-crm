import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Seitenkopf } from "@/bits"
import { LeadZeile, kontext } from "@/lead-zeile"
import { GebietsKarte, PIN, useKacheln } from "@/gebiets-karte"
import { bump, useDaten, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import * as K from "@/model/karte.js"
import { toast } from "sonner"
import { LocateFixed, X } from "lucide-react"

function Punkt({ farbe, gross }: { farbe: string; gross?: boolean }) {
  return <span className={cn("inline-block shrink-0 rounded-full ring-2 ring-background", gross ? "size-3" : "size-2.5")} style={{ background: farbe }} />
}

export function Karte() {
  const version = useDaten()
  const ui = useUI()
  const kacheln = useKacheln()
  const ich = M.person(ui.ich)
  const gf = ui.istGF
  const stadt = ui.kartenStadt
  const [phase, setPhase] = React.useState("alle")
  const [auswahl, setAuswahl] = React.useState<string | null>(null)
  const hv = gf ? (ui.hvFilter !== "alle" ? ui.hvFilter : null) : ui.ich
  React.useEffect(() => { setAuswahl(null) }, [stadt])

  const alle = K.leadsIn(stadt)
  let ls = alle.filter((l: any) => phase === "alle" ? l.stufe !== "verloren" : phase === "offen" ? M.istOffen(l) : l.stufe === "gewonnen")
  if (ui.mandatFilter !== "alle") ls = ls.filter((l: any) => l.mandat === ui.mandatFilter)
  if (!gf) ls = ls.filter((l: any) => l.betreuer === ui.ich)
  else if (hv) ls = ls.filter((l: any) => l.betreuer === hv)

  const units = K.UNITS.filter((u: any) => u.stadt === stadt)
  const leute = M.PERSONEN.filter((p: any) => p.rolle === "hv" && (p.stadt === stadt || units.some((u: any) => K.besitzer(u) === p.id)))
  const frei = units.filter((u: any) => !K.besitzer(u))
  const einheit = stadt === "kiel" ? ["Gebiet", "Gebiete"] : ["Stadtteil", "Stadtteile"]
  const fokusLead = ui.kartenFokus ? M.LEADS.find((l: any) => l.id === ui.kartenFokus) : null
  const gewaehlt = auswahl ? K.unit(auswahl) : null
  const erfasst = alle.filter((l: any) => l.erfasst && (gf ? !hv || l.betreuer === hv : l.betreuer === ui.ich))
    .sort((a: any, b: any) => (b.erfasst.datum + b.erfasst.zeit).localeCompare(a.erfasst.datum + a.erfasst.zeit)).slice(0, 5)

  return (
    <>
      <Seitenkopf titel={gf ? "Karte" : "Mein Gebiet"} text={gf ? "Wer wo unterwegs ist, welche Stadtteile frei sind und wo die Standorte liegen." : "Dein Gebiet und deine Standorte. Vor Ort einfach auf „Standort hier erfassen“ tippen."}>
        <ToggleGroup type="single" variant="outline" size="sm" value={stadt} onValueChange={(v) => v && ui.setKartenStadt(v)} aria-label="Stadt">
          {K.STAEDTE.map((s: any) => <ToggleGroupItem key={s.id} value={s.id} className="px-3">{s.name}</ToggleGroupItem>)}
        </ToggleGroup>
        <Button size="sm" onClick={() => ui.setErfassen(true)}><LocateFixed />Standort hier erfassen</Button>
      </Seitenkopf>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={phase} onValueChange={(v) => v && setPhase(v)} aria-label="Phase">
          <ToggleGroupItem value="offen" className="px-3">Offen</ToggleGroupItem>
          <ToggleGroupItem value="gewonnen" className="px-3">Freigegeben</ToggleGroupItem>
          <ToggleGroupItem value="alle" className="px-3">Alle</ToggleGroupItem>
        </ToggleGroup>
        <NativeSelect size="sm" value={ui.mandatFilter} onChange={(e) => ui.setMandatFilter(e.target.value)} aria-label="Mandat" className="w-auto min-w-36">
          <NativeSelectOption value="alle">Alle Mandate</NativeSelectOption>
          {M.MANDATE.filter((m: any) => m.bereich === "standort").map((m: any) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}
        </NativeSelect>
        {gf && (
          <NativeSelect size="sm" value={ui.hvFilter} onChange={(e) => ui.setHvFilter(e.target.value)} aria-label="Vertriebler" className="w-auto min-w-40">
            <NativeSelectOption value="alle">Alle Vertriebler</NativeSelectOption>
            {M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}
          </NativeSelect>
        )}
        <span className="text-sm text-muted-foreground tabular">{M.plural(ls.length, "Standort", "Standorte")}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="gap-0 overflow-hidden p-0">
          <GebietsKarte stadt={stadt} leads={ls} version={version} hervorheben={hv} auswahl={auswahl}
            fokus={fokusLead?.geo || null}
            onUnit={(id) => setAuswahl(auswahl === id ? null : id)} onLead={(id) => ui.oeffne(id)}
            className="h-[58svh] min-h-[360px] w-full lg:h-[calc(100svh-15rem)] lg:min-h-[520px]" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Punkt farbe={PIN.offen} />offen</span>
            <span className="flex items-center gap-1.5"><Punkt farbe={PIN.eingereicht} />beim Mandanten</span>
            <span className="flex items-center gap-1.5"><Punkt farbe={PIN.gewonnen} />freigegeben</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-muted-foreground/60" />frei</span>
            {kacheln === "aus" && <span className="basis-full sm:ml-auto sm:basis-auto">Die Vorschau zeigt nur die Grenzen. Straßen und Hausnummern erscheinen in der App.</span>}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {gewaehlt && gf && (
            <Card className="gap-3 border-foreground/20 py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center justify-between gap-2">{gewaehlt.name}
                  <Button variant="ghost" size="icon" className="-mr-2 size-7" onClick={() => setAuswahl(null)} aria-label="Auswahl schließen"><X /></Button>
                </CardTitle>
                <CardDescription>{gewaehlt.bezirk !== gewaehlt.name ? gewaehlt.bezirk : K.STAEDTE.find((s: any) => s.id === stadt).name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/60 p-2.5"><div className="text-xs text-muted-foreground">Offen</div><div className="font-semibold tabular">{alle.filter((l: any) => l.unit === gewaehlt.id && M.istOffen(l)).length}</div></div>
                  <div className="rounded-lg bg-muted/60 p-2.5"><div className="text-xs text-muted-foreground">Freigegeben</div><div className="font-semibold tabular">{alle.filter((l: any) => l.unit === gewaehlt.id && l.stufe === "gewonnen").length}</div></div>
                </div>
                <label className="grid gap-1.5 text-xs text-muted-foreground">Gebiet gehört zu
                  <NativeSelect value={K.besitzer(gewaehlt) || ""} onChange={(e) => { toast(K.zuweisen(gewaehlt.id, e.target.value || null, ui.ich)); bump() }}>
                    <NativeSelectOption value="">frei, niemand</NativeSelectOption>
                    {M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}
                  </NativeSelect>
                </label>
              </CardContent>
            </Card>
          )}

          <Card className="gap-3 py-4">
            <CardHeader className="px-4"><CardTitle>Gebiete in {K.STAEDTE.find((s: any) => s.id === stadt).name}</CardTitle>
              <CardDescription>{gf ? "Auf einen Stadtteil tippen, um ihn zuzuweisen" : "Farbige Fläche = wer dort unterwegs ist"}</CardDescription></CardHeader>
            <CardContent className="space-y-1 px-2">
              {leute.map((p: any) => {
                const n = units.filter((u: any) => K.besitzer(u) === p.id).length
                const offen = alle.filter((l: any) => l.betreuer === p.id && M.istOffen(l)).length
                const monat = alle.filter((l: any) => l.betreuer === p.id && l.abschluss && M.ym(l.abschluss.datum) === M.MONAT).length
                const aktiv = hv === p.id
                const Tag = gf ? "button" : "div"
                return (
                  <Tag key={p.id} onClick={gf ? () => ui.setHvFilter(aktiv ? "alle" : p.id) : undefined}
                    className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left", gf && "hover:bg-muted/60", aktiv && gf && "bg-muted")}>
                    <Punkt farbe={p.farbe} gross />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.voll}{p.id === ui.ich ? " (du)" : ""}</span>
                      <span className="block truncate text-xs text-muted-foreground">{M.plural(n, einheit[0], einheit[1])} · {offen} offen</span></span>
                    <Badge variant="secondary" className="tabular font-normal">{monat} im {M.MONATSNAMEN[M.T0.getMonth()].slice(0, 3)}</Badge>
                  </Tag>
                )
              })}
              {frei.length > 0 && (
                <div className="flex items-center gap-3 px-2 py-2">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-dashed border-muted-foreground/60" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Frei</span>
                    <span className="block truncate text-xs text-muted-foreground">{M.plural(frei.length, einheit[0], einheit[1])} ohne Vertriebler</span></span>
                </div>
              )}
              {!leute.length && <p className="px-2 text-sm text-muted-foreground">Hier ist noch niemand unterwegs.</p>}
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="px-4"><CardTitle>Zuletzt vor Ort erfasst</CardTitle></CardHeader>
            <CardContent className="px-2">
              {erfasst.length ? erfasst.map((l: any) => <LeadZeile key={l.id} l={l} wann={l.erfasst.datum === M.HEUTE ? l.erfasst.zeit : M.dKurz(l.erfasst.datum)} unter={kontext(l, l.ort)} />)
                : <p className="px-2 py-4 text-sm text-muted-foreground">Noch nichts. Vor Ort auf „Standort hier erfassen“ tippen, dann landet der Standort mit Adresse hier und auf der Karte.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
