import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { Kpi, PersonAvatar, Seitenkopf, ZielBar } from "@/bits"
import { useDaten, useUI } from "@/store"
import * as M from "@/model/model.js"
import { cn } from "@/lib/utils"

const chartConfig = {
  werbung: { label: "Werbemandate", color: "var(--chart-1)" },
  bildung: { label: "Weiterbildung", color: "var(--chart-4)" },
  standort: { label: "Standortakquise", color: "var(--chart-2)" },
} satisfies ChartConfig

const kurzT = (n: number) => n >= 1000 ? (n / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k" : String(Math.round(n))

export function Dashboard() {
  useDaten()
  const ui = useUI()
  const [z, setZ] = React.useState("monat")
  const [bf, setBf] = React.useState("alle")
  const passt = (l: any) => bf === "alle" || l.bereich === bf
  const mons: string[] = M.monateVon(z)
  const mitAb = M.LEADS.filter((l: any) => l.abschluss && passt(l))
  const umsatz = mitAb.reduce((s: number, l: any) => s + mons.reduce((t, m) => t + M.umsatzImMonat(l, m), 0), 0)
  const vormonat = M.umsatzMonat(M.ymAdd(M.MONAT, -1), passt)
  const vorvormonat = M.umsatzMonat(M.ymAdd(M.MONAT, -2), passt)
  const hoch = M.hochrechnungMonat(passt)
  const trend = z === "monat" ? (hoch / vormonat - 1) * 100 : z === "vormonat" ? (vormonat / vorvormonat - 1) * 100 : null
  const laufend = M.laufendImMonat(mons[mons.length - 1])
  const anzahl = mitAb.filter((l: any) => M.imZeitraum(l.abschluss.datum, z)).length
  const hvOffen = M.LEADS.filter((l: any) => l.abschluss && l.abschluss.status !== "bezahlt").reduce((s: number, l: any) => s + M.hvAnteil(l), 0)
  const pipe = M.pipelineGewichtet(passt)
  const zLabel = M.ZEITRAEUME.find((x: any) => x[0] === z)[1]

  const reihen = ["standort", "bildung", "werbung"].filter((b) => bf === "alle" || bf === b)
  const daten = [5, 4, 3, 2, 1, 0].map((n) => {
    const mo = M.ymAdd(M.MONAT, -n)
    const u: Record<string, number> = { werbung: 0, bildung: 0, standort: 0 }
    M.LEADS.forEach((l: any) => { if (l.abschluss) u[l.bereich] += M.umsatzImMonat(l, mo) })
    const zeile: any = { monat: M.monatName(mo, true) + (n === 0 ? " *" : ""), laeuft: n === 0, summe: 0 }
    reihen.forEach((b) => { zeile[b] = Math.round(u[b]); zeile.summe += Math.round(u[b]) })
    return zeile
  })
  const teilnehmer = mitAb.filter((l: any) => l.bereich === "bildung" && M.imZeitraum(l.abschluss.datum, z)).reduce((s2: number, l: any) => s2 + (l.abschluss.teilnehmer || 0), 0)

  return (
    <>
      <Seitenkopf titel="Dashboard" text="Umsatz, Pipeline und Team auf einen Blick">
        <ToggleGroup type="single" variant="outline" size="sm" value={z} onValueChange={(v) => v && setZ(v)}>
          {M.ZEITRAEUME.map((x: any) => <ToggleGroupItem key={x[0]} value={x[0]} className="px-3">{x[1]}</ToggleGroupItem>)}
        </ToggleGroup>
        <ToggleGroup type="single" variant="outline" size="sm" value={bf} onValueChange={(v) => v && setBf(v)}>
          <ToggleGroupItem value="alle" className="px-3">Alles</ToggleGroupItem>
          <ToggleGroupItem value="werbung" className="px-3">Werbung</ToggleGroupItem>
          <ToggleGroupItem value="bildung" className="px-3">Weiterbildung</ToggleGroupItem>
          <ToggleGroupItem value="standort" className="px-3">Standorte</ToggleGroupItem>
        </ToggleGroup>
      </Seitenkopf>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi titel="LUMIO-Umsatz" wert={M.eur(umsatz)} trend={trend}
          fuss={z === "monat" ? "Hochrechnung " + M.eur(hoch) : zLabel}
          zusatz={z === "monat" ? "Vormonat " + M.eur(vormonat) : z === "vormonat" ? "Monat davor " + M.eur(vorvormonat) : "Mai bis heute"} />
        {bf === "bildung"
          ? <Kpi titel="Angemeldete Teilnehmer" wert={M.zahl(teilnehmer)} fuss={zLabel} zusatz="über Arbeitgeber vermittelt" />
          : bf !== "standort"
          ? <Kpi titel="Laufend pro Monat" wert={M.eur(laufend)} fuss="aus Werbeverträgen" zusatz="kommt jeden Monat wieder" />
          : <Kpi titel="An Handelsvertreter offen" wert={M.eur(hvOffen)} fuss="noch nicht ausgezahlt" zusatz="siehe Team & Provisionen" />}
        <Kpi titel="Abschlüsse" wert={M.zahl(anzahl)} fuss={zLabel} zusatz={bf === "alle" ? "alle drei Bereiche" : bf === "werbung" ? "Werbemandate" : bf === "bildung" ? "Arbeitgeber gewonnen" : "freigegebene Standorte"} />
        <Kpi titel="Pipeline gewichtet" wert={M.eur(pipe)} fuss="offene Leads × Wahrscheinlichkeit" zusatz={M.LEADS.filter((l: any) => M.istOffen(l) && passt(l)).length + " offene Leads"} />
      </div>

      <Card className="pt-0">
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>Umsatz je Monat</CardTitle>
            <CardDescription>Laufzeitverträge zählen jeden Monat mit ihrem Anteil · * Monat läuft noch</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={daten} margin={{ top: 22, left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="monat" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={kurzT} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v: any, name: any) => (
                <div className="flex w-full items-center justify-between gap-4"><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span><span className="font-mono font-medium tabular">{M.eur(v)}</span></div>
              )} />} />
              <ChartLegend content={<ChartLegendContent />} />
              {reihen.map((r, i) => (
                <Bar key={r} dataKey={r} stackId="a" fill={`var(--color-${r})`} radius={i === reihen.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}>
                  {daten.map((d, j) => <Cell key={j} fillOpacity={d.laeuft ? 0.55 : 1} />)}
                  {i === reihen.length - 1 && <LabelList dataKey="summe" position="top" className="fill-foreground font-mono text-[11px]" formatter={(v: any) => kurzT(v)} />}
                </Bar>
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {(bf === "alle" || bf === "standort") && <HvKarte z={z} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <MandatKarte z={z} passt={passt} />
        {bf !== "standort" && <TelefonKarte z={z} />}
      </div>
    </>
  )
}

function HvKarte({ z }: { z: string }) {
  const ui = useUI()
  const mons: string[] = M.monateVon(z)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Handelsvertreter</CardTitle>
        <CardDescription>Ziel {M.eur(M.ZIEL_HV.min)}–{M.eur(M.ZIEL_HV.max)} Provision im Monat · Strich = {M.eur(M.ZIEL_HV.min)} · Farbe nach Hochrechnung</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Gebiet</TableHead>
            <TableHead className="text-right">Standorte</TableHead><TableHead className="hidden text-right sm:table-cell">LUMIO</TableHead>
            <TableHead className="text-right">Provision</TableHead>
            {z !== "vormonat" && <TableHead className="text-right">{z === "monat" ? "Hochrechnung" : "Ø Monat"}</TableHead>}
            <TableHead className="w-[22%] min-w-28">Ziel</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => {
              const ab = M.LEADS.filter((l: any) => l.betreuer === p.id && l.abschluss && M.imZeitraum(l.abschluss.datum, z))
              const lu = ab.reduce((s: number, l: any) => s + M.lumioGesamt(l), 0)
              const pr = ab.reduce((s: number, l: any) => s + M.hvAnteil(l), 0)
              const aktiv = mons.filter((m) => m >= M.ym(p.seit)).length || 1
              const bezug = z === "monat" ? M.hochrechnungBetrag(pr) : z === "sechs" ? pr / aktiv : pr
              return (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => ui.geheZu("standort", { hv: p.id })}>
                  <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} /><span className="font-medium">{p.voll}</span></div></TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{p.gebiet}</TableCell>
                  <TableCell className="text-right tabular">{ab.length}</TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{M.eur(lu)}</TableCell>
                  <TableCell className="text-right tabular">{M.eur(pr)}</TableCell>
                  {z !== "vormonat" && <TableCell className="text-right tabular">{M.eur(bezug)}</TableCell>}
                  <TableCell><ZielBar betrag={z === "monat" ? pr : bezug} prognose={bezug} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function MandatKarte({ z, passt }: { z: string; passt: (l: any) => boolean }) {
  const ui = useUI()
  const mons: string[] = M.monateVon(z)
  return (
    <Card>
      <CardHeader><CardTitle>Mandate</CardTitle><CardDescription>Klick öffnet die Leads</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Mandat</TableHead><TableHead className="text-right">Abschl.</TableHead><TableHead className="text-right">Umsatz</TableHead><TableHead className="text-right">Offen</TableHead></TableRow></TableHeader>
          <TableBody>
            {M.MANDATE.filter((m: any) => passt({ bereich: m.bereich })).map((m: any) => {
              const ls = M.LEADS.filter((l: any) => l.mandat === m.id)
              const um = ls.reduce((s: number, l: any) => s + mons.reduce((t, mo) => t + M.umsatzImMonat(l, mo), 0), 0)
              return (
                <TableRow key={m.id} className={m.status === "aktiv" ? "cursor-pointer" : ""} onClick={() => m.status === "aktiv" && ui.geheZu(m.bereich, { mandat: m.id })}>
                  <TableCell>
                    <div className="font-medium">{m.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{m.produkt}{m.status !== "aktiv" && <Badge variant="outline" className="h-4 border-transparent bg-warn/15 px-1 text-[10px] text-warn">Verhandlung</Badge>}</div>
                  </TableCell>
                  <TableCell className="text-right tabular">{ls.filter((l: any) => l.abschluss && M.imZeitraum(l.abschluss.datum, z)).length}</TableCell>
                  <TableCell className="text-right tabular">{M.eur(um)}</TableCell>
                  <TableCell className="text-right tabular">{ls.filter(M.istOffen).length}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function TelefonKarte({ z }: { z: string }) {
  const alleE: Record<string, number> = {}
  const ui = useUI()
  const zeilen = M.PERSONEN.filter((p: any) => p.rolle !== "hv").map((p: any) => {
    const a = M.anrufeImZeitraum(p.id, z)
    Object.keys(a.einwaende).forEach((e) => { alleE[e] = (alleE[e] || 0) + a.einwaende[e] })
    return { p, a, sc: M.setterCloser(p.id, z) }
  })
  const top = Object.keys(alleE).sort((a, b) => alleE[b] - alleE[a]).slice(0, 5)
  const mx = top.length ? alleE[top[0]] : 1
  return (
    <Card>
      <CardHeader><CardTitle>Telefon · Setting und Closing</CardTitle><CardDescription>Quoten je Person · Klick öffnet die Übergaben</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader><TableRow><TableHead /><TableHead className="text-right">Wahl</TableHead><TableHead className="text-right">Erreicht</TableHead><TableHead className="text-right">Termine</TableHead><TableHead className="text-right">Show-Rate</TableHead><TableHead className="text-right">Closing</TableHead></TableRow></TableHeader>
          <TableBody>
            {zeilen.map(({ p, a, sc }) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => ui.geheZu("uebergaben")}>
                <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} />{p.name}</div></TableCell>
                <TableCell className="text-right tabular">{M.zahl(a.wahl)}</TableCell>
                <TableCell className="text-right tabular">{M.zahl(a.erreicht)}<div className="text-xs text-muted-foreground">{M.prozent(a.erreicht, a.wahl)}</div></TableCell>
                <TableCell className="text-right tabular">{M.zahl(a.termine)}<div className="text-xs text-muted-foreground">{M.prozent(a.termine, a.erreicht)}</div></TableCell>
                <TableCell className={cn("text-right tabular", sc.showRate !== null && sc.showRate < 0.75 && "text-destructive")}>{M.quote(sc.showRate)}</TableCell>
                <TableCell className="text-right tabular">{p.rolle === "gf" ? M.quote(sc.closingQuote) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="space-y-2">
          <div className="text-sm font-medium">Häufigste Einwände</div>
          {top.map((e) => (
            <div key={e} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground">{e}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-1" style={{ width: (alleE[e] / mx) * 100 + "%" }} /></div>
              <span className="text-right font-mono text-xs tabular">{alleE[e]}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">Ohne Aufnahme. Ein Tipp pro „Kein Interesse“ reicht, um zu sehen, wo das Skript nachgeschärft werden muss.</CardFooter>
    </Card>
  )
}
