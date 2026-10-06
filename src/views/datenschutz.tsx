import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Seitenkopf } from "@/bits"
import { bump, useDaten, useUI } from "@/store"
import { protokollLaden, hinweiseLaden, anmeldungenLaden, sicherungenLaden, sicherungErstellen, sicherungHerunterladen, ABMELDEN_NACH_STUNDEN } from "@/daten/echt"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, Download, Info, Loader2, ShieldBan, DatabaseBackup } from "lucide-react"

const GRUENDE = ["Werbewiderspruch", "Will keine Anrufe", "Wunsch des Kunden", "Falsche Nummer", "Sonstiges"]
const TABELLEN: Record<string, string> = { lead: "Lead", kontakt: "Ansprechpartner", abschluss: "Abschluss", mandat: "Mandat", gebiet: "Gebiet", sperrliste: "Sperrliste", profil: "Zugang", profil_vorbelegung: "Zugang" }
const FELDER: Record<string, string> = { stufe: "Phase", betreuer_id: "Betreut von", setter_id: "Setter", closer_id: "Closer", name: "Name", telefon: "Telefon", email: "E-Mail",
  next_datum: "Nächster Schritt", next_text: "Was", verlustgrund: "Grund", status: "Status", profil_id: "Vertriebler", aktiv: "Aktiv", rolle: "Rolle", adresse: "Adresse" }

function wert(feld: string, v: any) {
  if (v === null || v === undefined || v === "") return "—"
  if (/_id$/.test(feld) && typeof v === "string") return M.person(v)?.name || "…"
  if (typeof v === "object") return "…"
  return String(v)
}

export function Datenschutz() {
  useDaten()
  const ui = useUI()
  return (
    <>
      <Seitenkopf titel="Datenschutz & Sicherheit" text="Sperrliste, wer was geändert hat, Auffälligkeiten, Sicherungskopien und wie alles geregelt ist." />
      <Tabs defaultValue="sperre" className="gap-4" onValueChange={(v) => {
        if (v !== "sicherheit") return
        try { localStorage.setItem("lumio-hinweise-gesehen", String(Date.now())) } catch (e) {}
        window.dispatchEvent(new Event("lumio-hinweise-gesehen"))
      }}>
        <div className="-mx-1 overflow-x-auto px-1"><TabsList><TabsTrigger value="sperre">Sperrliste</TabsTrigger><TabsTrigger value="protokoll">Änderungen</TabsTrigger><TabsTrigger value="sicherheit">Sicherheit</TabsTrigger><TabsTrigger value="regeln">So ist es geregelt</TabsTrigger></TabsList></div>
        <TabsContent value="sperre"><Sperrliste /></TabsContent>
        <TabsContent value="protokoll">{ui.echt ? <Protokoll /> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">In der Demo gibt es kein Protokoll. In der echten App steht hier jede Änderung mit Name, Uhrzeit und vorher/nachher.</CardContent></Card>}</TabsContent>
        <TabsContent value="sicherheit"><Sicherheit /></TabsContent>
        <TabsContent value="regeln"><Regeln /></TabsContent>
      </Tabs>
    </>
  )
}

function Sperrliste() {
  const ui = useUI()
  const [q, setQ] = React.useState("")
  const [w, setW] = React.useState({ telefon: "", email: "", firma: "", grund: GRUENDE[0] })
  const liste = M.SPERRLISTE.slice().reverse().filter((e: any) => !q || [e.telefon, e.email, e.firma].join(" ").toLowerCase().includes(q.toLowerCase().replace(/\s/g, "")) || (e.firma || "").toLowerCase().includes(q.toLowerCase()))
  const lead = (id: any) => M.LEADS.find((l: any) => l.id === id)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader><CardTitle>{M.plural(M.SPERRLISTE.length, "Eintrag", "Einträge")}</CardTitle>
          <CardDescription>Nummern und E-Mails hier tauchen in keiner Anrufliste mehr auf, auch nicht nach einem Import. Einträge bleiben dauerhaft, damit der Widerspruch beachtet wird.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nummer, E-Mail oder Firma suchen" aria-label="Sperrliste durchsuchen" />
          <Table>
            <TableHeader><TableRow><TableHead>Telefon / E-Mail</TableHead><TableHead className="hidden sm:table-cell">Firma</TableHead><TableHead>Grund</TableHead><TableHead className="text-right">Seit</TableHead></TableRow></TableHeader>
            <TableBody>
              {liste.slice(0, 200).map((e: any) => (
                <TableRow key={e.id} className={lead(e.lead) ? "cursor-pointer" : ""} onClick={() => lead(e.lead) && ui.oeffne(e.lead)}>
                  <TableCell className="font-mono text-xs">{e.telefon || ""}{e.telefon && e.email ? <br /> : null}{e.email || ""}{!e.telefon && !e.email ? "—" : ""}</TableCell>
                  <TableCell className="hidden sm:table-cell">{e.firma || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="border-transparent bg-destructive/10 font-normal text-destructive">{e.grund}</Badge></TableCell>
                  <TableCell className="text-right tabular">{M.dKurz(e.datum)}{e.datum?.slice(2, 4)}</TableCell>
                </TableRow>
              ))}
              {!liste.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{q ? "Nichts gefunden." : "Noch niemand auf der Sperrliste."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>Von Hand eintragen</CardTitle><CardDescription>Zum Beispiel wenn jemand per E-Mail widerspricht.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(e) => {
            e.preventDefault()
            if (!w.telefon && !w.email && !w.firma) return toast("Bitte Telefon, E-Mail oder Firma angeben.")
            const ok = M.sperreHinzu({ ...w, wer: ui.ich })
            if (!ok) return toast("Steht schon auf der Sperrliste.")
            bump(); toast("Auf die Sperrliste gesetzt"); setW({ telefon: "", email: "", firma: "", grund: GRUENDE[0] })
          }}>
            <div className="grid gap-1.5"><Label htmlFor="st" className="text-xs text-muted-foreground">Telefon</Label><Input id="st" type="tel" value={w.telefon} onChange={(e) => setW({ ...w, telefon: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="se" className="text-xs text-muted-foreground">E-Mail</Label><Input id="se" type="email" value={w.email} onChange={(e) => setW({ ...w, email: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="sf" className="text-xs text-muted-foreground">Firma</Label><Input id="sf" value={w.firma} onChange={(e) => setW({ ...w, firma: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="sg" className="text-xs text-muted-foreground">Grund</Label>
              <NativeSelect id="sg" value={w.grund} onChange={(e) => setW({ ...w, grund: e.target.value })}>{GRUENDE.map((g) => <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>)}</NativeSelect></div>
            <Button type="submit"><ShieldBan />Sperren</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Protokoll() {
  const ui = useUI()
  const [tabelle, setTabelle] = React.useState("")
  const [daten, setDaten] = React.useState<any[] | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  React.useEffect(() => {
    setDaten(null); setFehler(null)
    protokollLaden(tabelle ? { tabelle } : {}).then(setDaten).catch((e) => setFehler(e.message))
  }, [tabelle])
  const titel = (z: any) => {
    const l = M.LEADS.find((x: any) => x.id === z.datensatz) || M.LEADS.find((x: any) => x.kontakte.some((k: any) => k.id === z.datensatz))
    if (l) return l.name
    if (z.tabelle === "gebiet") return z.datensatz.replace(/^(hh|be|ki):/, "")
    if (z.tabelle === "mandat") return M.MANDATE.find((m: any) => m.dbId === Number(z.datensatz))?.name || "Mandat"
    if (z.tabelle.startsWith("profil")) return M.person(z.datensatz)?.voll || z.neu?.name || z.alt?.name || z.datensatz
    return z.neu?.name || z.alt?.name || z.neu?.firma || "—"
  }
  const aenderungen = (z: any) => {
    if (z.aktion === "anonymisiert") return "Personenbezogene Daten gelöscht (" + (z.neu?.grund || "auf Anfrage") + ")"
    if (z.aktion === "insert") return "angelegt"
    if (z.aktion === "delete") return "gelöscht"
    if (!z.neu) return "geändert (Details nach 12 Monaten entfernt)"
    return Object.keys(z.neu).filter((k) => FELDER[k]).map((k) => `${FELDER[k]}: ${wert(k, z.alt?.[k])} → ${wert(k, z.neu[k])}`).join(" · ") || "Details geändert"
  }
  return (
    <Card>
      <CardHeader><CardTitle>Wer hat was geändert</CardTitle><CardDescription>Die letzten 200 Änderungen. Details werden nach 12 Monaten entfernt.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <NativeSelect size="sm" value={tabelle} onChange={(e) => setTabelle(e.target.value)} aria-label="Bereich" className="w-auto min-w-44">
          <NativeSelectOption value="">Alles</NativeSelectOption>
          {["lead", "kontakt", "abschluss", "mandat", "gebiet", "sperrliste", "profil"].map((t) => <NativeSelectOption key={t} value={t}>{TABELLEN[t]}</NativeSelectOption>)}
        </NativeSelect>
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        {!daten && !fehler && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>}
        {daten && (
          <Table>
            <TableHeader><TableRow><TableHead>Wann</TableHead><TableHead>Wer</TableHead><TableHead>Was</TableHead><TableHead className="hidden md:table-cell">Änderung</TableHead></TableRow></TableHeader>
            <TableBody>
              {daten.map((z) => {
                const l = M.LEADS.find((x: any) => x.id === z.datensatz)
                return (
                  <TableRow key={z.id} className={l ? "cursor-pointer" : ""} onClick={() => l && ui.oeffne(l.id)}>
                    <TableCell className="whitespace-nowrap tabular text-xs">{M.dKurz(z.zeit.slice(0, 10))} {new Date(z.zeit).toTimeString().slice(0, 5)}</TableCell>
                    <TableCell>{z.profil_id ? M.person(z.profil_id)?.name || "?" : "System"}</TableCell>
                    <TableCell><div className="font-medium">{titel(z)}</div><div className="text-xs text-muted-foreground">{TABELLEN[z.tabelle] || z.tabelle}</div><div className="text-xs text-muted-foreground md:hidden">{aenderungen(z)}</div></TableCell>
                    <TableCell className="hidden max-w-md text-sm text-muted-foreground md:table-cell">{aenderungen(z)}</TableCell>
                  </TableRow>
                )
              })}
              {!daten.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Noch keine Änderungen.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

/* Gerät aus dem Browser-Kennzeichen lesbar machen */
export function geraetText(ua?: string | null) {
  if (!ua) return "—"
  const sys = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Gerät"
  const br = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : ""
  return br ? sys + " · " + br : sys
}
const zeitText = (z: string) => new Date(z).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
function Laedt() { return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div> }
function NurEcht({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p> }

function Sicherheit() {
  const ui = useUI()
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Hinweise echt={ui.echt} />
      <Sicherungen echt={ui.echt} />
      <Anmeldungen echt={ui.echt} />
    </div>
  )
}

function Hinweise({ echt }: { echt: boolean }) {
  const [daten, setDaten] = React.useState<any[] | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  React.useEffect(() => { if (echt) hinweiseLaden(30).then(setDaten).catch((e) => setFehler(e.message)) }, [echt])
  return (
    <Card className="xl:row-span-2">
      <CardHeader><CardTitle>Auffälligkeiten</CardTitle>
        <CardDescription>Die letzten 30 Tage: Anmeldungen nachts oder aus neuen Netzen, sehr viele Anmeldungen oder Änderungen, Löschungen und Exporte. Neue Warnungen stehen als Zahl im Menü.</CardDescription></CardHeader>
      <CardContent>
        {!echt ? <NurEcht text="In der Demo gibt es keine Anmeldungen. In der echten App steht hier zum Beispiel: „Kevin: Anmeldung mitten in der Nacht (03:12 Uhr)“." />
          : fehler ? <p className="text-sm text-destructive">{fehler}</p>
          : !daten ? <Laedt />
          : !daten.length ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-ok" />Nichts Auffälliges in den letzten 30 Tagen.</div>
          : <ul className="divide-y">{daten.map((h, i) => (
              <li key={i} className="flex gap-3 py-2.5">
                {h.stufe === "warnung" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-label="Warnung" /> : <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Hinweis" />}
                <div className="min-w-0 text-sm"><div><span className="font-medium">{M.person(h.profil_id)?.voll || "Unbekannt"}</span>: {h.text}</div>
                  <div className="text-xs text-muted-foreground tabular">{zeitText(h.zeit)}</div></div>
              </li>))}</ul>}
      </CardContent>
    </Card>
  )
}

function Sicherungen({ echt }: { echt: boolean }) {
  const [daten, setDaten] = React.useState<any[] | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [laeuft, setLaeuft] = React.useState<string | null>(null)
  const laden = React.useCallback(() => { if (echt) sicherungenLaden().then(setDaten).catch((e) => setFehler(e.message)) }, [echt])
  React.useEffect(() => { laden() }, [laden])
  const umfang = (t: any) => !t ? "—" : [M.plural(t.lead || 0, "Lead", "Leads"), M.plural(t.kontakt || 0, "Ansprechpartner", "Ansprechpartner"), M.plural(t.objekt || 0, "Haus", "Häuser"), M.plural(t.auftrag || 0, "Auftrag", "Aufträge")].join(" · ")
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1.5"><CardTitle>Sicherungskopien</CardTitle>
          <CardDescription>Jede Nacht um 3:20 Uhr wird alles gesichert. Die letzten 14 Sicherungen bleiben vollständig und lassen sich als Datei herunterladen. Fotos sind nicht enthalten.</CardDescription></div>
        <Button size="sm" variant="outline" disabled={!echt || laeuft === "neu"} onClick={async () => {
          setLaeuft("neu"); try { await sicherungErstellen(); toast("Sicherung erstellt"); laden() } catch (e: any) { toast(e.message) } finally { setLaeuft(null) }
        }}>{laeuft === "neu" ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}Jetzt sichern</Button>
      </CardHeader>
      <CardContent>
        {!echt ? <NurEcht text="In der Demo gibt es keine Sicherungen. In der echten App stehen hier die nächtlichen Sicherungen zum Herunterladen." />
          : fehler ? <p className="text-sm text-destructive">{fehler}</p>
          : !daten ? <Laedt />
          : <Table>
              <TableHeader><TableRow><TableHead>Wann</TableHead><TableHead className="hidden sm:table-cell">Inhalt</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {daten.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell className="whitespace-nowrap"><div className="tabular text-sm">{zeitText(z.erstellt_am)}</div><div className="text-xs text-muted-foreground">{z.art}{z.groesse_kb ? " · " + z.groesse_kb + " KB" : ""}</div></TableCell>
                    <TableCell className="hidden whitespace-normal text-sm text-muted-foreground sm:table-cell">{umfang(z.tabellen)}</TableCell>
                    <TableCell>{z.groesse_kb ? <Button variant="ghost" size="icon" className="size-8" aria-label="Sicherung herunterladen" disabled={laeuft === String(z.id)}
                      onClick={async () => { setLaeuft(String(z.id)); try { await sicherungHerunterladen(z.id) } catch (e: any) { toast(e.message) } finally { setLaeuft(null) } }}>
                      {laeuft === String(z.id) ? <Loader2 className="animate-spin" /> : <Download />}</Button> : <span className="text-xs text-muted-foreground">abgelaufen</span>}</TableCell>
                  </TableRow>
                ))}
                {!daten.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Noch keine Sicherung.</TableCell></TableRow>}
              </TableBody>
            </Table>}
      </CardContent>
    </Card>
  )
}

function Anmeldungen({ echt }: { echt: boolean }) {
  const [daten, setDaten] = React.useState<any[] | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  React.useEffect(() => { if (echt) anmeldungenLaden().then(setDaten).catch((e) => setFehler(e.message)) }, [echt])
  return (
    <Card>
      <CardHeader><CardTitle>Anmeldungen</CardTitle><CardDescription>Wer sich wann von welchem Gerät angemeldet hat. Unbekanntes Gerät? Person unter Team → Zugänge sperren oder Passwort zurücksetzen.</CardDescription></CardHeader>
      <CardContent>
        {!echt ? <NurEcht text="In der Demo gibt es keine Anmeldungen." />
          : fehler ? <p className="text-sm text-destructive">{fehler}</p>
          : !daten ? <Laedt />
          : <Table>
              <TableHeader><TableRow><TableHead>Wann</TableHead><TableHead>Wer</TableHead><TableHead>Gerät</TableHead><TableHead className="hidden md:table-cell">IP</TableHead></TableRow></TableHeader>
              <TableBody>
                {daten.slice(0, 50).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap tabular text-xs">{zeitText(a.zeit)}</TableCell>
                    <TableCell>{M.person(a.profil_id)?.name || "?"}</TableCell>
                    <TableCell className="text-sm">{geraetText(a.geraet)}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{a.ip || "—"}</TableCell>
                  </TableRow>
                ))}
                {!daten.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Noch keine Anmeldungen.</TableCell></TableRow>}
              </TableBody>
            </Table>}
      </CardContent>
    </Card>
  )
}

function Regeln() {
  const punkte = [
    ["Server in Frankfurt", "Die Daten liegen bei Supabase in der EU (eu-central-1)."],
    ["Jeder sieht nur seins", "Setter sehen ihre Telefon-Leads ohne Umsätze, Handelsvertreter nur ihre eigenen Standorte und ihre Provision. Das prüft die Datenbank selbst, nicht nur die App."],
    ["Änderungsprotokoll", "Jede Änderung an Leads, Ansprechpartnern, Abschlüssen, Mandaten, Gebieten, Sperrliste und Zugängen wird mit Name und Uhrzeit festgehalten."],
    ["Löschen auf Anfrage", "Im Lead unten: „Daten auf Anfrage löschen“ (nur Geschäftsführung). Personenbezogenes wird überschrieben, auch im Protokoll."],
    ["Sperrliste", "„Will nie wieder angerufen werden“ beim Anruf oder hier von Hand. Gilt für alle und für spätere Importe."],
    ["Keine Gesprächsaufnahmen", "Anrufe werden nur als Ergebnis gezählt, nicht aufgenommen."],
    ["Zwei-Faktor-Anmeldung", "Neben dem Passwort ein Code vom Handy. Für die Geschäftsführung Pflicht, für andere einzeln einschaltbar. Die Datenbank selbst gibt ohne Code nichts heraus."],
    ["Automatisch abmelden", `Nach ${ABMELDEN_NACH_STUNDEN} Stunden ohne Nutzung. Über das Menü unten links lässt sich jeder auf allen Geräten abmelden.`],
    ["Sicherungskopie jede Nacht", "Alle Daten werden nachts gesichert, die letzten 14 Tage bleiben vollständig."],
    ["Auffälligkeiten", "Anmeldungen nachts oder aus neuen Netzen, viele Änderungen auf einmal, Löschungen und Exporte werden gemeldet."],
    ["Kein Zugriff ohne Anmeldung", "Ohne gültige Anmeldung gibt die Datenbank gar nichts heraus, auch nicht über Umwege."],
  ]
  const offen = [
    "Zwei-Faktor-Anmeldung auch bei Gmail, GitHub und Supabase einschalten. Wer diese Konten hat, hat alles.",
    "Im Supabase-Dashboard die Selbst-Registrierung abschalten (Authentication → „Allow new users to sign up“).",
    "Sobald echte Daten drin sind: Supabase Pro buchen (tägliche Backups beim Anbieter, kein Pausieren).",
    "Auftragsverarbeitungsvertrag (AVV) mit Supabase abschließen: im Supabase-Dashboard unter Organization → Legal Documents.",
    "Datenschutzerklärung und Verzeichnis der Verarbeitungstätigkeiten um das CRM ergänzen.",
    "Kaltakquise im B2B: Nur Firmen anrufen, bei denen ein Interesse vermutet werden kann (§ 7 Abs. 2 UWG).",
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Was die App schon macht</CardTitle></CardHeader>
        <CardContent className="space-y-3">{punkte.map(([t, x]) => (
          <div key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /><div><div className="text-sm font-medium">{t}</div><div className="text-sm text-muted-foreground">{x}</div></div></div>
        ))}</CardContent></Card>
      <Card className="h-fit"><CardHeader><CardTitle>Was ihr noch erledigen müsst</CardTitle><CardDescription>Keine Rechtsberatung. Im Zweifel kurz mit dem Anwalt abstimmen.</CardDescription></CardHeader>
        <CardContent><ol className="list-decimal space-y-2 pl-5 text-sm">{offen.map((o) => <li key={o}>{o}</li>)}</ol></CardContent></Card>
    </div>
  )
}
