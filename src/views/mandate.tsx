import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Seitenkopf } from "@/bits"
import { useDaten, useUI } from "@/store"
import * as M from "@/model/model.js"
import * as React from "react"
import { ArrowRight, CalendarClock, FolderOpen, Mail, Pencil, Phone, Plus } from "lucide-react"
import { oeffneAkte, STATUS_TEXT } from "@/mandat-akte"
import * as A from "@/model/akte.js"
import { MandatSheet } from "@/mandat-sheet"
import * as D from "@/model/d2d.js"

export function Mandate() {
  useDaten()
  const ui = useUI()
  const sechs: string[] = M.monateVon("sechs")
  const [bearbeiten, setBearbeiten] = React.useState<{ m: any } | null>(null)
  return (
    <>
      <Seitenkopf titel="Mandate" text="Was ihr für wen verkauft, zu welchen Konditionen, und was es bringt.">
        {ui.istGF && <Button size="sm" onClick={() => setBearbeiten({ m: null })}><Plus />Mandat</Button>}
      </Seitenkopf>
      <MandatSheet offen={!!bearbeiten} mandat={bearbeiten?.m || null} onClose={() => setBearbeiten(null)} />
      {M.BEREICHE.map((b: any) => [b.id, b.name]).map(([b, t]) => (
        <section key={b} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {M.MANDATE.filter((m: any) => m.bereich === b).map((m: any) => {
              const ls = M.LEADS.filter((l: any) => l.mandat === m.id)
              const as = m.bereich === "d2d" ? D.AUFTRAEGE.filter((a: any) => a.mandat === m.id) : []
              const um = m.bereich === "d2d"
                ? as.filter((a: any) => a.status === "geschaltet" && sechs.includes(M.ym(a.statusDatum))).reduce((s: number, a: any) => s + D.provisionVon(a).lumio, 0)
                : ls.reduce((s: number, l: any) => s + sechs.reduce((t2, mo) => t2 + M.umsatzImMonat(l, mo), 0), 0)
              return (
                <Card key={m.id}>
                  <CardHeader>
                    <CardTitle>{m.name}</CardTitle>
                    <CardDescription>{m.produkt}{m.seit ? " · seit " + M.dKurz(m.seit) + m.seit.slice(0, 4) : ""}</CardDescription>
                    <CardAction className="flex items-center gap-1">{m.status === "aktiv"
                      ? <Badge variant="outline" className="border-transparent bg-ok/15 text-ok">aktiv</Badge>
                      : <Badge variant="outline" className="border-transparent bg-warn/15 text-warn">{STATUS_TEXT[m.status] || m.status}</Badge>}
                      {ui.istGF && <Button variant="ghost" size="icon" className="size-7" aria-label={m.name + " bearbeiten"} onClick={() => setBearbeiten({ m })}><Pencil /></Button>}</CardAction>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      {(m.bereich === "d2d" ? [["in Arbeit", as.filter((a: any) => !D.statusVon(a.status).ende && a.status !== "geschaltet").length], ["geschaltet", as.filter((a: any) => a.status === "geschaltet").length], ["6 Monate", M.eur(um)]] : [["offen", ls.filter(M.istOffen).length], ["Abschlüsse", ls.filter((l: any) => l.abschluss).length], ["6 Monate", M.eur(um)]]).map(([l, v]) => (
                        <div key={l as string} className="rounded-lg bg-muted/60 px-3 py-2"><div className="font-mono text-base tabular">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
                      ))}
                    </div>
                    <div><div className="mb-0.5 text-xs font-medium text-muted-foreground">Konditionen</div>{m.ktext || "Noch nicht eingetragen."}{m.hv ? ` Handelsvertreter erhalten ${m.hv} %.` : ""}</div>
                    <Separator />
                    {(() => {
                      const hk: any = A.hauptkontakt(m.id) || m.ap, mehr = A.kontakteVon(m.id).length - 1, n: any = A.naechster(m.id)
                      return (
                        <>
                          {ui.istGF && (
                            <button type="button" className="flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left hover:bg-muted/50" onClick={() => oeffneAkte(m.id)}>
                              <CalendarClock className={"mt-0.5 size-4 shrink-0 " + (n && A.ueberfaellig(n) ? "text-destructive" : "text-muted-foreground")} />
                              <span className="min-w-0"><span className="block text-xs font-medium text-muted-foreground">Nächster Schritt</span>
                                {n ? <span className={A.ueberfaellig(n) ? "text-destructive" : ""}>{A.zeitText(n)} · {n.titel}</span> : <span className="text-muted-foreground">Nichts geplant</span>}</span>
                            </button>
                          )}
                          <div>
                            <div className="mb-0.5 text-xs font-medium text-muted-foreground">Ansprechpartner{mehr > 0 ? ` (+${mehr} weitere)` : ""}</div>
                            <div className="font-medium">{hk?.name || "—"}</div>{hk?.funktion && <div className="text-muted-foreground">{hk.funktion}</div>}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {hk?.tel && <Button asChild variant="outline" size="xs"><a href={"tel:" + hk.tel.replace(/\s/g, "")}><Phone />{hk.tel}</a></Button>}
                              {hk?.mail && <Button asChild variant="outline" size="xs"><a href={"mailto:" + hk.mail}><Mail />E-Mail</a></Button>}
                            </div>
                          </div>
                        </>
                      )
                    })()}
                    <div className="flex flex-wrap gap-1">{m.felder.map((f: any) => <Badge key={f.key} variant="secondary" className="font-normal">{f.label}</Badge>)}</div>
                  </CardContent>
                  {(ui.istGF || m.status === "aktiv") && (
                    <CardFooter className="mt-auto flex flex-wrap gap-2">
                      {ui.istGF && <Button variant="outline" size="sm" onClick={() => oeffneAkte(m.id)}><FolderOpen />Akte</Button>}
                      {m.status === "aktiv" && <Button variant="ghost" size="sm" onClick={() => ui.geheZu(m.bereich === "d2d" ? "d2d" : m.bereich, { mandat: m.id })}>Leads ansehen<ArrowRight /></Button>}
                    </CardFooter>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
