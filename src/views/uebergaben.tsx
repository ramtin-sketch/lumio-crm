import * as React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Kpi, PersonAvatar, Seitenkopf } from "@/bits"
import { LeadZeile, kontext } from "@/lead-zeile"
import { useDaten, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { ArrowRight } from "lucide-react"

function Paar({ s, c }: { s: string; c: string }) {
  return <div className="flex items-center gap-1"><PersonAvatar id={s} />{s !== c && <><ArrowRight className="size-3 text-muted-foreground" /><PersonAvatar id={c} /></>}</div>
}
function TerminStatus({ t }: { t: any }) {
  if (t.status === "noshow") return <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">No-Show</Badge>
  if (t.ergebnis === "abschluss") return <Badge variant="outline" className="border-transparent bg-ok/15 text-ok">Abschluss</Badge>
  if (t.ergebnis === "verloren") return <Badge variant="secondary">verloren</Badge>
  if (t.status === "gelaufen") return <Badge variant="outline" className="border-transparent bg-cobalt/10 text-cobalt">im Closing</Badge>
  return <Badge variant="outline">geplant</Badge>
}

/* Geschäftsführung: alle Übergaben, Show-Rate und Closing-Quote */
export function Uebergaben() {
  useDaten()
  const ui = useUI()
  const [z, setZ] = React.useState("sechs")
  const geplant = M.TERMINE.filter((t: any) => t.status === "geplant").sort((a: any, b: any) => (a.datum + (a.zeit || "")).localeCompare(b.datum + (b.zeit || "")))
  const offenFuerMich = geplant.filter((t: any) => t.closer === ui.ich)
  const neuTerminieren = M.LEADS.filter((l: any) => l.terminStatus === "noshow" && M.istOffen(l))
  const ges = { gelaufen: 0, noshow: 0, ct: 0, ca: 0 }
  M.PERSONEN.filter((p: any) => p.rolle !== "hv").forEach((p: any) => { const s = M.setterCloser(p.id, z); ges.gelaufen += s.gelaufenAlsSetter; ges.noshow += s.noShows; ges.ct += s.closingTermine; ges.ca += s.closingAbschluesse })
  const zLabel = M.ZEITRAEUME.find((x: any) => x[0] === z)[1]
  const lead = (id: number) => M.LEADS.find((l: any) => l.id === id)

  return (
    <>
      <Seitenkopf titel="Übergaben" text="Vom Setter zum Closer: wer welchen Termin gesetzt hat, wer ihn closed, und wie gut das läuft.">
        <ToggleGroup type="single" variant="outline" size="sm" value={z} onValueChange={(v) => v && setZ(v)}>
          {M.ZEITRAEUME.map((x: any) => <ToggleGroupItem key={x[0]} value={x[0]} className="px-3">{x[1]}</ToggleGroupItem>)}
        </ToggleGroup>
      </Seitenkopf>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi titel="Anstehende Termine" wert={geplant.length} zusatz={"davon closest du " + offenFuerMich.length} />
        <Kpi titel="Show-Rate" wert={M.quote(ges.gelaufen + ges.noshow ? ges.gelaufen / (ges.gelaufen + ges.noshow) : null)} fuss="Termine, die stattfinden" zusatz={zLabel} />
        <Kpi titel="Closing-Quote" wert={M.quote(ges.ct ? ges.ca / ges.ct : null)} fuss="Abschlüsse je gelaufenem Termin" zusatz={zLabel} />
        <Kpi titel="Neu terminieren" wert={neuTerminieren.length} kritisch={neuTerminieren.length > 0} zusatz="nach No-Show zurück beim Setter" />
      </div>

      <Card>
        <CardHeader><CardTitle>Anstehende Termine</CardTitle><CardDescription>Klick öffnet den Lead mit dem Briefing des Setters</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Termin</TableHead><TableHead>Firma</TableHead><TableHead className="hidden md:table-cell">Mandat</TableHead><TableHead>Setter → Closer</TableHead><TableHead className="hidden sm:table-cell">Briefing</TableHead></TableRow></TableHeader>
            <TableBody>
              {geplant.map((t: any) => {
                const l = lead(t.lead)
                const u = l?.uebergabe
                return (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => l && ui.oeffne(l.id)}>
                    <TableCell className={cn("whitespace-nowrap tabular", t.datum <= M.HEUTE && "font-medium")}>{M.wann({ datum: t.datum, zeit: t.zeit })}</TableCell>
                    <TableCell className="font-medium">{l?.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{l && M.mandat(l.mandat).name}</TableCell>
                    <TableCell><Paar s={t.setter} c={t.closer} /></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {u && <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={cn(u.entscheider === "ja" ? "text-ok" : "text-warn")}>{u.entscheider === "ja" ? "Entscheider ✓" : "Entscheider ?"}</Badge>
                        {u.budget !== "unklar" && <Badge variant="secondary" className="font-normal">{M.BUDGETS.find((b: any) => b[0] === u.budget)?.[1].replace(" im Monat", "")}</Badge>}
                      </div>}
                    </TableCell>
                  </TableRow>
                )
              })}
              {geplant.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Keine Termine geplant.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Setter und Closer</CardTitle><CardDescription>{zLabel}</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Person</TableHead><TableHead className="text-right">Gesetzt</TableHead><TableHead className="text-right">Show-Rate</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Daraus Abschl.</TableHead><TableHead className="text-right">Closings</TableHead><TableHead className="text-right">Closing-Quote</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {M.PERSONEN.filter((p: any) => p.rolle !== "hv").map((p: any) => {
                  const s = M.setterCloser(p.id, z)
                  const schwach = s.showRate !== null && s.showRate < 0.75
                  return (
                    <TableRow key={p.id}>
                      <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} /><div><div className="font-medium">{p.voll}</div><div className="text-xs text-muted-foreground">{p.rolle === "gf" ? "setzt und closed" : "Setter"}</div></div></div></TableCell>
                      <TableCell className="text-right tabular">{s.gesetzt}</TableCell>
                      <TableCell className={cn("text-right tabular", schwach && "text-destructive")}>{M.quote(s.showRate)}</TableCell>
                      <TableCell className="hidden text-right tabular sm:table-cell">{s.abschluesseAusGesetzten}</TableCell>
                      <TableCell className="text-right tabular">{p.rolle === "gf" ? s.closingTermine : "—"}</TableCell>
                      <TableCell className="text-right tabular">{p.rolle === "gf" ? M.quote(s.closingQuote) : "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">Show-Rate unter 75 % ist rot. Dann stimmt meist die Qualifizierung im Setting nicht, nicht das Closing.</CardFooter>
        </Card>
        <Card>
          <CardHeader><CardTitle>Neu terminieren</CardTitle><CardDescription>Nicht erschienen, liegt wieder beim Setter</CardDescription></CardHeader>
          <CardContent className="px-4">
            {neuTerminieren.length ? neuTerminieren.map((l: any) => <LeadZeile key={l.id} l={l} wann={M.wann(l.next)} rot={M.ueberfaellig(l)} unter={kontext(l, "No-Show bei " + M.person(l.closer).name)} />)
              : <div className="py-8 text-center text-sm text-muted-foreground">Nichts offen.</div>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/* Setter: meine gesetzten Termine und wie viele davon stattfinden */
export function MeineTermine() {
  useDaten()
  const ui = useUI()
  const s = M.setterCloser(ui.ich, "monat")
  const s6 = M.setterCloser(ui.ich, "sechs")
  const meine = M.TERMINE.filter((t: any) => t.setter === ui.ich).sort((a: any, b: any) => b.datum.localeCompare(a.datum)).slice(0, 25)
  const neu = M.LEADS.filter((l: any) => l.terminStatus === "noshow" && M.istOffen(l) && l.betreuer === ui.ich)
  const lead = (id: number) => M.LEADS.find((l: any) => l.id === id)
  return (
    <>
      <Seitenkopf titel="Meine Termine" text="Was du gesetzt hast, an wen es ging und was daraus wurde." />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi titel={"Gesetzt im " + M.MONATSNAMEN[M.T0.getMonth()]} wert={s.gesetzt} zusatz={"seit Mai: " + s6.gesetzt} />
        <Kpi titel="Show-Rate" wert={M.quote(s6.showRate)} kritisch={s6.showRate !== null && s6.showRate < 0.75} fuss="Ziel: über 75 %" zusatz="letzte 6 Monate" />
        <Kpi titel="Daraus Abschlüsse" wert={s6.abschluesseAusGesetzten} zusatz="letzte 6 Monate" />
        <Kpi titel="Neu terminieren" wert={neu.length} kritisch={neu.length > 0} zusatz="No-Shows bei dir" />
      </div>
      {neu.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Neu terminieren</CardTitle><CardDescription>Kunde ist nicht erschienen. Gleich nochmal anrufen.</CardDescription></CardHeader>
          <CardContent className="px-4">{neu.map((l: any) => <LeadZeile key={l.id} l={l} wann={M.wann(l.next)} unter={kontext(l, "war bei " + M.person(l.closer).name)} />)}</CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Gesetzte Termine</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Termin</TableHead><TableHead>Firma</TableHead><TableHead>Closer</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {meine.map((t: any) => {
                const l = t.lead ? lead(t.lead) : null
                return (
                  <TableRow key={t.id} className={l ? "cursor-pointer" : ""} onClick={() => l && ui.oeffne(l.id)}>
                    <TableCell className="whitespace-nowrap tabular">{M.wann({ datum: t.datum, zeit: t.zeit })}</TableCell>
                    <TableCell className="font-medium">{l ? l.name : <span className="font-normal text-muted-foreground">Werbekunde (Archiv)</span>}</TableCell>
                    <TableCell><PersonAvatar id={t.closer} /></TableCell>
                    <TableCell><TerminStatus t={t} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
