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
import { protokollLaden } from "@/daten/echt"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { CheckCircle2, Loader2, ShieldBan } from "lucide-react"

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
      <Seitenkopf titel="Datenschutz & Sperrliste" text="Wer nicht mehr angerufen werden will, was geändert wurde und wie ihr Daten löscht." />
      <Tabs defaultValue="sperre" className="gap-4">
        <TabsList><TabsTrigger value="sperre">Sperrliste</TabsTrigger><TabsTrigger value="protokoll">Änderungen</TabsTrigger><TabsTrigger value="regeln">So ist es geregelt</TabsTrigger></TabsList>
        <TabsContent value="sperre"><Sperrliste /></TabsContent>
        <TabsContent value="protokoll">{ui.echt ? <Protokoll /> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">In der Demo gibt es kein Protokoll. In der echten App steht hier jede Änderung mit Name, Uhrzeit und vorher/nachher.</CardContent></Card>}</TabsContent>
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

function Regeln() {
  const punkte = [
    ["Server in Frankfurt", "Die Daten liegen bei Supabase in der EU (eu-central-1)."],
    ["Jeder sieht nur seins", "Setter sehen ihre Telefon-Leads ohne Umsätze, Handelsvertreter nur ihre eigenen Standorte und ihre Provision. Das prüft die Datenbank selbst, nicht nur die App."],
    ["Änderungsprotokoll", "Jede Änderung an Leads, Ansprechpartnern, Abschlüssen, Mandaten, Gebieten, Sperrliste und Zugängen wird mit Name und Uhrzeit festgehalten."],
    ["Löschen auf Anfrage", "Im Lead unten: „Daten auf Anfrage löschen“ (nur Geschäftsführung). Personenbezogenes wird überschrieben, auch im Protokoll."],
    ["Sperrliste", "„Will nie wieder angerufen werden“ beim Anruf oder hier von Hand. Gilt für alle und für spätere Importe."],
    ["Keine Gesprächsaufnahmen", "Anrufe werden nur als Ergebnis gezählt, nicht aufgenommen."],
  ]
  const offen = [
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
