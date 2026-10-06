import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Kpi, Seitenkopf } from "@/bits"
import { Ergebnis } from "@/ergebnis"
import { useDaten, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import { Phone } from "lucide-react"

export function Anrufen() {
  useDaten()
  const ui = useUI()
  const heute = M.anrufTag(ui.ich, M.HEUTE)
  const frueher = M.ANRUF_TAGE.filter((a: any) => a.person === ui.ich && a.datum < M.HEUTE).sort((a: any, b: any) => b.datum.localeCompare(a.datum)).slice(0, 10)
  const avg = (k: string) => (frueher.length ? frueher.reduce((s: number, a: any) => s + a[k], 0) / frueher.length : 0)

  let ls = M.LEADS.filter((l: any) => M.istTel(l) && M.istOffen(l) && (l.stufe === "recherche" || l.stufe === "setting") && l.betreuer === ui.ich && !M.istGesperrt(l))
  if (ui.mandatFilter !== "alle") ls = ls.filter((l: any) => l.mandat === ui.mandatFilter)
  const rang = (l: any) => (!l.next ? 2 : l.next.datum < M.HEUTE ? 0 : l.next.datum === M.HEUTE ? 1 : 3)
  ls.sort((a: any, b: any) => rang(a) - rang(b) || (a.next ? a.next.datum : "9").localeCompare(b.next ? b.next.datum : "9"))

  const e: Record<string, number> = {}
  M.ANRUF_TAGE.filter((a: any) => a.person === ui.ich && M.tageZwischen(a.datum, M.HEUTE) < 14).forEach((a: any) => Object.keys(a.einwaende).forEach((k) => { e[k] = (e[k] || 0) + a.einwaende[k] }))
  const top = Object.keys(e).sort((a, b) => e[b] - e[a])
  const mx = top.length ? e[top[0]] : 1

  return (
    <>
      <Seitenkopf titel="Anrufen" text="Deine Liste für heute, Überfälliges zuerst. Ein Tipp auf das Ergebnis, fertig.">
        <NativeSelect size="sm" value={ui.mandatFilter} onChange={(ev) => ui.setMandatFilter(ev.target.value)} aria-label="Mandat" className="w-auto min-w-44">
          <NativeSelectOption value="alle">Alle Werbemandate</NativeSelectOption>
          {M.MANDATE.filter((m: any) => m.bereich !== "standort" && ["aktiv", "verhandlung"].includes(m.status)).map((m: any) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}
        </NativeSelect>
      </Seitenkopf>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titel="Wählversuche" wert={heute.wahl} zusatz={"Ø " + M.zahl(avg("wahl")) + " pro Tag"} />
        <Kpi titel="Erreicht" wert={heute.erreicht} zusatz={M.prozent(heute.erreicht, heute.wahl) + " · Ø " + M.prozent(avg("erreicht"), avg("wahl"))} />
        <Kpi titel="Termine" wert={heute.termine} zusatz={"Ø " + avg("termine").toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " pro Tag"} />
        <Kpi titel="Terminquote" wert={M.prozent(heute.termine, heute.erreicht)} zusatz="Termine je Erreichte" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {ls.length === 0 && <Card><Empty><EmptyHeader><EmptyTitle>Deine Liste ist leer</EmptyTitle><EmptyDescription>Leg neue Werbekunden an oder wähle „Alle Werbemandate“.</EmptyDescription></EmptyHeader></Empty></Card>}
          {ls.map((l: any) => {
            const k = l.kontakte[0], last = l.verlauf[l.verlauf.length - 1]
            return (
              <Card key={l.id} className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-base"><button className="hover:underline" onClick={() => ui.oeffne(l.id)}>{l.name}</button></CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{l.ort} · {M.mandat(l.mandat).name}</span><Badge variant="secondary">{M.stufeVon(l).name}</Badge>
                    {k && <span className="text-xs">{k.name}{k.funktion ? ", " + k.funktion : ""}</span>}
                  </CardDescription>
                  {k && k.tel && (
                    <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                      <Button asChild variant="outline" size="sm" className="font-mono"><a href={"tel:" + k.tel.replace(/\s/g, "")}><Phone />{k.tel}</a></Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  <div className="text-sm">
                    {l.next && <div className={cn(M.ueberfaellig(l) ? "text-destructive" : "text-muted-foreground")}>{M.wann(l.next)} · {l.next.text}</div>}
                    {last && <div className="text-xs text-muted-foreground">Zuletzt {M.dKurz(last.datum)}: {last.titel}</div>}
                  </div>
                  <Ergebnis l={l} breit />
                </CardContent>
              </Card>
            )
          })}
        </div>
        <Card className="lg:sticky lg:top-20">
          <CardHeader><CardTitle>Deine Einwände</CardTitle><CardDescription>Letzte 14 Tage</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {top.map((k) => (
              <div key={k} className="grid grid-cols-[minmax(0,8.5rem)_1fr_2rem] items-center gap-3 text-sm">
                <span className="truncate text-muted-foreground">{k}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-1" style={{ width: (e[k] / mx) * 100 + "%" }} /></div>
                <span className="text-right font-mono text-xs tabular">{e[k]}</span>
              </div>
            ))}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">Ohne Aufnahme, nur ein Tipp pro „Kein Interesse“. Daran seht ihr, welcher Einwand im Skript nachgeschärft werden muss.</CardFooter>
        </Card>
      </div>
    </>
  )
}
