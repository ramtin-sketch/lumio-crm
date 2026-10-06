import * as React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PersonAvatar, Seitenkopf, StatusBadge } from "@/bits"
import { bump, useDaten } from "@/store"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { Zugaenge } from "@/zugaenge"

export function Team() {
  useDaten()
  const [z, setZ] = React.useState("monat")
  const weiter = (hv: string, mo: string) => {
    const ls = M.LEADS.filter((l: any) => l.betreuer === hv && l.abschluss && M.ym(l.abschluss.datum) === mo)
    const nx = ({ offen: "abgerechnet", abgerechnet: "bezahlt" } as any)[ls[0].abschluss.status]
    ls.forEach((l: any) => { l.abschluss.status = nx })
    bump(); toast(`${M.person(hv).voll}, ${M.monatName(mo)}: ${nx}`)
  }
  return (
    <>
      <Seitenkopf titel="Team & Provisionen" text="Wer was gebracht hat und was ausgezahlt werden muss.">
        <ToggleGroup type="single" variant="outline" size="sm" value={z} onValueChange={(v) => v && setZ(v)}>
          {M.ZEITRAEUME.map((x: any) => <ToggleGroupItem key={x[0]} value={x[0]} className="px-3">{x[1]}</ToggleGroupItem>)}
        </ToggleGroup>
      </Seitenkopf>
      <Card>
        <CardHeader><CardTitle>Team</CardTitle><CardDescription>Geschäftsführung zählt als Closer, Setter mit den Abschlüssen aus seinen Terminen</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead className="hidden sm:table-cell">Rolle</TableHead><TableHead className="text-right">Abschlüsse</TableHead><TableHead className="text-right">LUMIO-Umsatz</TableHead><TableHead className="text-right">Provision</TableHead><TableHead className="hidden md:table-cell">Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {M.PERSONEN.map((p: any) => {
                const ab = M.LEADS.filter((l: any) => l.abschluss && M.imZeitraum(l.abschluss.datum, z) && (p.rolle === "hv" ? l.betreuer === p.id : p.rolle === "setter" ? l.setter === p.id : l.closer === p.id))
                const won = M.LEADS.filter((l: any) => M.istTel(l) && l.abschluss && M.imZeitraum(l.abschluss.datum, z))
                return (
                  <TableRow key={p.id}>
                    <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} /><span className="font-medium">{p.voll}</span></div></TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{p.rolle === "gf" ? "Geschäftsführung" : p.rolle === "setter" ? "Setter" : "Handelsvertreter"}</TableCell>
                    <TableCell className="text-right tabular">{ab.length}</TableCell>
                    <TableCell className="text-right tabular">{M.eur(ab.reduce((s: number, l: any) => s + M.lumioGesamt(l), 0))}</TableCell>
                    <TableCell className="text-right tabular">{p.rolle === "hv" ? M.eur(ab.reduce((s: number, l: any) => s + M.hvAnteil(l), 0)) : "—"}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{p.rolle === "gf" ? `${won.filter((l: any) => l.setter === p.id).length} gesetzt · ${won.filter((l: any) => l.closer === p.id).length} geclosed` : p.rolle === "setter" ? `${won.filter((l: any) => l.setter === p.id).length} gesetzt, die abgeschlossen wurden` : p.gebiet}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Provisionsabrechnung</CardTitle><CardDescription>Je Handelsvertreter und Monat: offen → abgerechnet → bezahlt</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Monat</TableHead><TableHead>Handelsvertreter</TableHead><TableHead className="text-right">Standorte</TableHead><TableHead className="text-right">Provision</TableHead><TableHead>Status</TableHead><TableHead className="text-right" /></TableRow></TableHeader>
            <TableBody>
              {[0, 1, 2, 3, 4, 5].flatMap((n) => {
                const mo = M.ymAdd(M.MONAT, -n)
                return M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => {
                  const ab = M.LEADS.filter((l: any) => l.betreuer === p.id && l.abschluss && M.ym(l.abschluss.datum) === mo)
                  if (!ab.length) return null
                  const st = ab[0].abschluss.status
                  const naechst = ({ offen: "Abrechnen", abgerechnet: "Bezahlt" } as any)[st]
                  return (
                    <TableRow key={mo + p.id}>
                      <TableCell className="whitespace-nowrap">{M.monatName(mo)} {mo.slice(0, 4)}</TableCell>
                      <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} /><span className="hidden sm:inline">{p.voll}</span></div></TableCell>
                      <TableCell className="text-right tabular">{ab.length}</TableCell>
                      <TableCell className="text-right tabular">{M.eur(ab.reduce((s: number, l: any) => s + M.hvAnteil(l), 0))}</TableCell>
                      <TableCell><StatusBadge s={st} /></TableCell>
                      <TableCell className="text-right">{naechst && <Button variant="outline" size="xs" onClick={() => weiter(p.id, mo)}>{naechst}</Button>}</TableCell>
                    </TableRow>
                  )
                })
              })}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">Die Provision entsteht erst, wenn die Geschäftsführung die Freigabe des Mandanten eingetragen hat. Handelsvertreter können „Freigegeben“ nicht selbst setzen.</CardFooter>
      </Card>
      <Zugaenge />
    </>
  )
}
