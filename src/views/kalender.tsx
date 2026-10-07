import * as React from "react"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PersonAvatar, Seitenkopf } from "@/bits"
import { useUI } from "@/store"
import * as M from "@/model/model.js"
import { aufKalender, kalenderStand, standVergessen, teamTermine, trennen, verbinden, type KalStand, type KalTermin } from "@/daten/kalender"
import { toast } from "sonner"
import { CalendarDays, ExternalLink, Loader2, MapPin, RefreshCw, Unplug, Video } from "lucide-react"

const ZONE = "Europe/Berlin"
const tagKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: ZONE })
const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" })
function tagTitel(key: string) {
  const d = new Date(key + "T12:00:00")
  const heute = M.HEUTE, morgen = M.tag(1)
  const name = key === heute ? "Heute" : key === morgen ? "Morgen" : M.WOCHENTAGE[d.getDay()]
  return `${name}, ${d.getDate()}. ${M.MONATSNAMEN[d.getMonth()]}`
}
type Zeile = KalTermin & { profil: string }

/* Lädt Stand und Termine; lädt neu, wenn das Fenster wieder in den Vordergrund kommt (z. B. nach der Google-Anmeldung) */
function useKalender(tage: number, personen?: string[]) {
  const ui = useUI()
  const [stand, setStand] = React.useState<KalStand | null>(null)
  const [zeilen, setZeilen] = React.useState<Zeile[] | null>(null)
  const [fehler, setFehler] = React.useState<string[]>([])
  const [laedt, setLaedt] = React.useState(false)
  const [runde, setRunde] = React.useState(0)
  const neu = React.useCallback(() => { standVergessen(); setRunde((r) => r + 1) }, [])
  React.useEffect(() => {
    if (!ui.echt) return
    const sichtbar = () => { if (document.visibilityState === "visible") neu() }
    const nachricht = (e: MessageEvent) => { if (e.data && typeof e.data === "object" && "lumioGoogle" in e.data) neu() }
    document.addEventListener("visibilitychange", sichtbar); window.addEventListener("message", nachricht)
    const ab = aufKalender(() => setRunde((r) => r + 1))
    return () => { document.removeEventListener("visibilitychange", sichtbar); window.removeEventListener("message", nachricht); ab() }
  }, [ui.echt, neu])
  const pKey = (personen || []).join(",")
  React.useEffect(() => {
    if (!ui.echt) return
    let weg = false
    setLaedt(true)
    ;(async () => {
      try {
        const s = await kalenderStand(); if (weg) return; setStand(s)
        if (!s.eingerichtet || !s.team.some((p) => p.verbunden)) { setZeilen([]); return }
        const von = new Date(M.HEUTE + "T00:00:00"), bis = new Date(von.getTime() + tage * 86400000)
        const k = await teamTermine(von, bis, personen); if (weg) return
        setZeilen(k.flatMap((x) => x.termine.map((t) => ({ ...t, profil: x.profil }))).sort((a, b) => a.start.localeCompare(b.start)))
        setFehler(k.filter((x) => x.fehler).map((x) => `${M.person(x.profil)?.name || "?"}: ${x.fehler}`))
      } catch (e: any) { if (!weg) { setFehler([e.message]); setZeilen([]) } } finally { if (!weg) setLaedt(false) }
    })()
    return () => { weg = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.echt, tage, pKey, runde])
  return { stand, zeilen, fehler, laedt, neu }
}

function TerminZeile({ t, mitPerson }: { t: Zeile; mitPerson: boolean }) {
  return (
    <div className={"flex items-start gap-3 rounded-lg px-2 py-2 text-sm " + (t.belegt ? "text-muted-foreground" : "")}>
      <div className="w-12 shrink-0 pt-0.5 font-mono text-xs tabular">{t.ganztags ? <span className="font-sans">ganzer Tag</span> : <><div>{uhr(t.start)}</div><div className="text-muted-foreground">{uhr(t.ende)}</div></>}</div>
      {mitPerson && <PersonAvatar id={t.profil} />}
      <div className="min-w-0 flex-1">
        <div className={"line-clamp-2 " + (t.belegt ? "italic" : "font-medium")}>{t.belegt ? "belegt" : t.titel}{mitPerson && <span className="font-normal text-muted-foreground"> · {M.person(t.profil)?.name}</span>}</div>
        {!t.belegt && (t.ort || t.teilnehmer?.length) ? (
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {t.ort && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{t.ort}</span>}
            {t.ort && t.teilnehmer?.length ? " · " : ""}{t.teilnehmer?.length ? "mit " + t.teilnehmer.slice(0, 3).join(", ") + (t.teilnehmer.length > 3 ? " …" : "") : ""}
          </div>
        ) : null}
      </div>
      {t.meet && <Button asChild variant="outline" size="icon" className="size-7"><a href={t.meet} target="_blank" rel="noreferrer" aria-label={"Videocall: " + t.titel}><Video /></a></Button>}
      {t.link && <Button asChild variant="ghost" size="icon" className="size-7"><a href={t.link} target="_blank" rel="noreferrer" aria-label={"In Google Kalender öffnen: " + t.titel}><ExternalLink /></a></Button>}
    </div>
  )
}

function Verbindung({ stand, onNeu }: { stand: KalStand; onNeu: () => void }) {
  const ui = useUI()
  const ich = stand.team.find((p) => p.id === ui.ich)
  const [laeuft, setLaeuft] = React.useState(false)
  if (!stand.eingerichtet) return (
    <Card><CardHeader><CardTitle>Google Kalender</CardTitle>
      <CardDescription>{ui.istGF ? "Die Google-Anbindung ist gebaut, aber der Google-Cloud-Zugang fehlt noch. Sobald er in Supabase eingetragen ist, kann sich jeder hier verbinden." : "Die Google-Anbindung wird gerade eingerichtet. Danach kannst du hier deinen Kalender verbinden."}</CardDescription>
    </CardHeader></Card>
  )
  const los = async () => { setLaeuft(true); try { await verbinden() } catch (e: any) { toast(e.message) } finally { setLaeuft(false) } }
  const aus = async () => { setLaeuft(true); try { await trennen(); toast("Kalender getrennt"); onNeu() } catch (e: any) { toast(e.message) } finally { setLaeuft(false) } }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dein Google Kalender</CardTitle>
        <CardDescription>{ich?.verbunden ? <>Verbunden mit <b>{ich.email}</b>. Closing-Termine landen automatisch darin.</> : "Einmal verbinden, dann sehen Setter deine freien Zeiten und tragen Closing-Termine direkt bei dir ein."}</CardDescription>
        <CardAction>{ich?.verbunden
          ? <Button variant="ghost" size="sm" onClick={aus} disabled={laeuft}><Unplug />Trennen</Button>
          : <Button size="sm" onClick={los} disabled={laeuft}>{laeuft ? <Loader2 className="animate-spin" /> : <CalendarDays />}Google Kalender verbinden</Button>}</CardAction>
      </CardHeader>
      {ui.istGF && (
        <CardContent className="flex flex-wrap gap-2">
          {stand.team.filter((p) => p.rolle !== "handelsvertreter").map((p) => (
            <Badge key={p.id} variant="outline" className={p.verbunden ? "border-transparent bg-ok/15 text-ok" : "text-muted-foreground"}>
              <span className={"size-1.5 rounded-full " + (p.verbunden ? "bg-ok" : "bg-muted-foreground/40")} aria-hidden="true" />{p.name}{p.verbunden ? "" : " · nicht verbunden"}
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

export function Kalender() {
  const ui = useUI()
  const [tage, setTage] = React.useState("7")
  const { stand, zeilen, fehler, laedt, neu } = useKalender(Number(tage))
  const [wer, setWer] = React.useState<string>("alle")
  if (!ui.echt) return (
    <>
      <Seitenkopf titel="Kalender" text="Die Google-Kalender des Teams an einem Ort." />
      <Empty><EmptyHeader><EmptyTitle>Nur in der echten App</EmptyTitle><EmptyDescription>Im Demo-Modus gibt es keine Verbindung zu Google.</EmptyDescription></EmptyHeader></Empty>
    </>
  )
  const leute = [...new Set((zeilen || []).map((z) => z.profil))]
  const sichtbar = (zeilen || []).filter((z) => wer === "alle" || z.profil === wer)
  const tageListe = [...new Set(sichtbar.map((z) => tagKey(z.start)))]
  return (
    <>
      <Seitenkopf titel="Kalender" text={ui.istGF ? "Die Termine aus den Google-Kalendern des Teams." : "Deine Termine und wann die Closer belegt sind."}>
        <Button variant="outline" size="sm" onClick={neu} disabled={laedt}><RefreshCw className={laedt ? "animate-spin" : ""} />Neu laden</Button>
      </Seitenkopf>
      {stand && <Verbindung stand={stand} onNeu={neu} />}
      {stand?.eingerichtet && (
        <Card>
          <CardHeader>
            <CardTitle>Nächste {tage === "7" ? "7" : "14"} Tage</CardTitle>
            <CardAction>
              <ToggleGroup type="single" variant="outline" size="sm" value={tage} onValueChange={(v) => v && setTage(v)}>
                <ToggleGroupItem value="7" className="px-3 text-xs">7 Tage</ToggleGroupItem><ToggleGroupItem value="14" className="px-3 text-xs">14 Tage</ToggleGroupItem>
              </ToggleGroup>
            </CardAction>
            {leute.length > 1 && (
              <div className="col-span-full flex flex-wrap gap-1.5 pt-2">
                {["alle", ...leute].map((p) => (
                  <Button key={p} size="xs" variant={wer === p ? "default" : "outline"} onClick={() => setWer(p)}>
                    {p === "alle" ? "Alle" : <><PersonAvatar id={p} className="size-4" />{M.person(p)?.name}</>}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4 px-4">
            {fehler.map((f) => <p key={f} className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{f}</p>)}
            {zeilen === null ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
              : !tageListe.length ? <Empty className="py-8"><EmptyHeader><EmptyTitle className="text-sm">Keine Termine</EmptyTitle><EmptyDescription>{stand.team.some((p) => p.verbunden) ? "In diesem Zeitraum steht nichts im Kalender." : "Noch hat niemand seinen Kalender verbunden."}</EmptyDescription></EmptyHeader></Empty>
              : tageListe.map((k) => (
                <section key={k}>
                  <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">{tagTitel(k)}</h3>
                  {sichtbar.filter((z) => tagKey(z.start) === k).map((z) => <TerminZeile key={z.profil + z.id} t={z} mitPerson={leute.length > 1} />)}
                </section>
              ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}

/* Startseite der Geschäftsführung: was heute und morgen im Team ansteht */
export function KalenderHeuteKarte() {
  const ui = useUI()
  const { stand, zeilen } = useKalender(2)
  if (!ui.echt || !stand?.eingerichtet) return null
  const liste = (zeilen || []).filter((z) => !z.ganztags && Date.parse(z.ende) > Date.now()).slice(0, 8)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team-Kalender</CardTitle><CardDescription>Heute und morgen, aus Google</CardDescription>
        <CardAction><Button variant="ghost" size="sm" onClick={() => ui.geheZu("kalender")}>Alle<CalendarDays /></Button></CardAction>
      </CardHeader>
      <CardContent className="px-4">
        {zeilen === null ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
          : !stand.team.some((p) => p.verbunden) ? <p className="px-2 py-4 text-sm text-muted-foreground">Noch kein Kalender verbunden. <Button variant="link" className="h-auto p-0" onClick={() => ui.geheZu("kalender")}>Jetzt verbinden</Button></p>
          : !liste.length ? <p className="px-2 py-4 text-sm text-muted-foreground">Heute und morgen steht nichts mehr an.</p>
          : liste.map((z) => (
            <div key={z.profil + z.id} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
              <PersonAvatar id={z.profil} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{z.titel}</span><span className="block truncate text-xs text-muted-foreground">{M.person(z.profil)?.name}{z.ort ? " · " + z.ort : ""}</span></span>
              <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">{tagKey(z.start) === M.HEUTE ? "" : "morgen "}{uhr(z.start)}</span>
              {z.meet && <Button asChild variant="outline" size="icon" className="size-7"><a href={z.meet} target="_blank" rel="noreferrer" aria-label={"Videocall: " + z.titel}><Video /></a></Button>}
            </div>
          ))}
      </CardContent>
    </Card>
  )
}
