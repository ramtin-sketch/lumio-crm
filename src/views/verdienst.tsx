import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Kpi, Seitenkopf, StatusBadge, ZielBar } from "@/bits"
import { LeadZeile, kontext } from "@/lead-zeile"
import { useDaten, useUI } from "@/store"
import * as M from "@/model/model.js"

export function Verdienst() {
  useDaten()
  const ui = useUI()
  const me = M.person(ui.ich)
  const ab = M.LEADS.filter((l: any) => l.betreuer === me.id && l.abschluss)
  const imMonat = ab.filter((l: any) => M.ym(l.abschluss.datum) === M.MONAT).sort((a: any, b: any) => b.abschluss.datum.localeCompare(a.abschluss.datum))
  const prov = imMonat.reduce((s: number, l: any) => s + M.hvAnteil(l), 0)
  const hoch = M.hochrechnungBetrag(prov)
  const letzte3 = ab.filter((l: any) => M.ym(l.abschluss.datum) >= M.ymAdd(M.MONAT, -3) && M.ym(l.abschluss.datum) < M.MONAT)
  const proStandort = letzte3.length ? letzte3.reduce((s: number, l: any) => s + M.hvAnteil(l), 0) / letzte3.length : 110
  const fehlt = Math.max(0, Math.ceil((M.ZIEL_HV.min - prov) / proStandort))
  const pipe = M.LEADS.filter((l: any) => l.betreuer === me.id && M.istOffen(l) && l.stufe === "eingereicht")
  const pipeProv = pipe.reduce((s: number, l: any) => s + (M.mandat(l.mandat).k.betrag * M.mandat(l.mandat).hv) / 100, 0)
  const vormonat = ab.filter((l: any) => M.ym(l.abschluss.datum) === M.ymAdd(M.MONAT, -1)).reduce((s: number, l: any) => s + M.hvAnteil(l), 0)

  return (
    <>
      <Seitenkopf titel="Mein Verdienst" text={`${M.MONATSNAMEN[M.T0.getMonth()]} ${M.T0.getFullYear()} · ${me.gebiet}`} />
      <Card>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">Provision bisher</div>
            <div className="font-mono text-4xl font-semibold tabular">{M.eur(prov)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{M.plural(imMonat.length, "freigegebener Standort", "freigegebene Standorte")} · Hochrechnung {M.eur(hoch)}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Dein Ziel: {M.eur(M.ZIEL_HV.min)} bis {M.eur(M.ZIEL_HV.max)}</div>
            <ZielBar betrag={prov} prognose={hoch} className="h-3" />
            <p className="text-sm">{fehlt ? <>Noch <strong>{fehlt} Standorte</strong> bis {M.eur(M.ZIEL_HV.min)}. Im Schnitt bringt dir ein Standort {M.eur(proStandort)}.</> : "Die 2.000 € sind geschafft. Alles darüber ist Bonus."}</p>
            {pipe.length > 0 && <p className="text-sm text-muted-foreground">{M.plural(pipe.length, "Standort liegt", "Standorte liegen")} beim Mandanten. Werden sie freigegeben, kommen {M.eur(pipeProv)} dazu.</p>}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titel="Freigegeben" wert={imMonat.length} zusatz={"im " + M.MONATSNAMEN[M.T0.getMonth()]} />
        <Kpi titel="Hochrechnung" wert={M.eur(hoch)} zusatz="bei gleichem Tempo" />
        <Kpi titel="Beim Mandanten" wert={pipe.length} zusatz={"möglich: " + M.eur(pipeProv)} />
        <Kpi titel="Letzter Monat" wert={M.eur(vormonat)} zusatz={M.MONATSNAMEN[(M.T0.getMonth() + 11) % 12]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Letzte Monate</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Monat</TableHead><TableHead className="text-right">Standorte</TableHead><TableHead className="text-right">Provision</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {[0, 1, 2, 3, 4, 5].map((n) => {
                  const mo = M.ymAdd(M.MONAT, -n)
                  const m2 = ab.filter((l: any) => M.ym(l.abschluss.datum) === mo)
                  if (!m2.length && n > 0) return null
                  return (
                    <TableRow key={mo}>
                      <TableCell>{M.monatName(mo)}</TableCell>
                      <TableCell className="text-right tabular">{m2.length}</TableCell>
                      <TableCell className="text-right tabular">{M.eur(m2.reduce((s: number, l: any) => s + M.hvAnteil(l), 0))}</TableCell>
                      <TableCell><StatusBadge s={m2.length ? m2[0].abschluss.status : "offen"} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Freigegeben im {M.MONATSNAMEN[M.T0.getMonth()]}</CardTitle><CardDescription>Was dir jeder Standort bringt</CardDescription></CardHeader>
          <CardContent className="px-4">
            {imMonat.length ? imMonat.map((l: any) => <LeadZeile key={l.id} l={l} wann={M.dKurz(l.abschluss.datum)} unter={kontext(l, M.eur(M.hvAnteil(l)))} />)
              : <div className="py-8 text-center text-sm text-muted-foreground">Noch keine Freigabe in diesem Monat.</div>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
