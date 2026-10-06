import * as React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Seitenkopf } from "@/bits"
import { bump, useDaten, useUI } from "@/store"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { ECHT } from "@/daten/echt"
import { Download, FileUp, Upload } from "lucide-react"

/* ---------- CSV lesen und schreiben ---------- */
function csvLesen(text: string): string[][] {
  text = text.replace(/^﻿/, "")
  const erste = text.split(/\r?\n/)[0] || ""
  const trenner = [["\t", (erste.match(/\t/g) || []).length], [";", (erste.match(/;/g) || []).length], [",", (erste.match(/,/g) || []).length]]
    .sort((a: any, b: any) => b[1] - a[1])[0][0] as string
  const zeilen: string[][] = []
  let zeile: string[] = [], feld = "", inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++ }
      else if (c === '"') inQ = false
      else feld += c
    } else if (c === '"' && feld === "") inQ = true
    else if (c === trenner) { zeile.push(feld); feld = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      zeile.push(feld); feld = ""
      if (zeile.some((x) => x.trim())) zeilen.push(zeile)
      zeile = []
    } else feld += c
  }
  zeile.push(feld); if (zeile.some((x) => x.trim())) zeilen.push(zeile)
  return zeilen.map((z) => z.map((x) => x.trim()))
}
function csvSchreiben(kopf: string[], zeilen: any[][]) {
  const q = (v: any) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return "﻿" + [kopf, ...zeilen].map((z) => z.map(q).join(";")).join("\r\n")
}
function herunterladen(name: string, inhalt: string) {
  if (!ECHT) { toast("In der Vorschau sind Downloads gesperrt. In der echten App lädt hier die CSV-Datei herunter."); return }
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([inhalt], { type: "text/csv;charset=utf-8" }))
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

const ZIELE = [
  { key: "name", label: "Firma / Objekt", pflicht: true, muster: /firma|unternehmen|company|name|objekt|organisation/i },
  { key: "ort", label: "Ort", muster: /^ort$|stadt|city|ort\b/i },
  { key: "adresse", label: "Adresse", muster: /adresse|stra(ss|ß)e|anschrift|address/i },
  { key: "kname", label: "Ansprechpartner", muster: /ansprech|kontakt|person|vorname|nachname|contact/i },
  { key: "kfunktion", label: "Funktion", muster: /funktion|position|titel|rolle|job/i },
  { key: "ktel", label: "Telefon", muster: /tel|phone|mobil|handy|nummer/i },
  { key: "kmail", label: "E-Mail", muster: /mail/i },
  { key: "notiz", label: "Notiz", muster: /notiz|bemerk|kommentar|info|note/i },
]

export function ImportExport() {
  useDaten()
  return (
    <>
      <Seitenkopf titel="Import & Export" text="Listen aus Excel übernehmen und eure Daten herunterladen." />
      <Import />
      <Export />
    </>
  )
}

function Import() {
  const ui = useUI()
  const [bereich, setBereich] = React.useState("werbung")
  const mandate = M.MANDATE.filter((m: any) => m.bereich === bereich && m.status !== "beendet")
  const [mandat, setMandat] = React.useState<string>("")
  const leute = M.PERSONEN.filter((p: any) => p.aktiv !== false && (bereich === "standort" ? p.rolle === "hv" : p.rolle !== "hv"))
  const [betreuer, setBetreuer] = React.useState<string>(ui.ich)
  const [text, setText] = React.useState("")
  const [zuordnung, setZuordnung] = React.useState<Record<string, number>>({})
  const [kopfzeile, setKopfzeile] = React.useState(true)
  const [dubUeberspringen, setDubUeberspringen] = React.useState(true)
  React.useEffect(() => { setMandat(mandate[0]?.id || ""); if (!leute.some((p: any) => p.id === betreuer)) setBetreuer(leute[0]?.id || "") }, [bereich])

  const zeilen = React.useMemo(() => (text.trim() ? csvLesen(text) : []), [text])
  const kopf = kopfzeile ? zeilen[0] || [] : (zeilen[0] || []).map((_, i) => "Spalte " + (i + 1))
  const daten = kopfzeile ? zeilen.slice(1) : zeilen
  React.useEffect(() => {
    const z: Record<string, number> = {}
    ZIELE.forEach((t) => { const i = kopf.findIndex((h) => t.muster.test(h)); if (i >= 0 && !Object.values(z).includes(i)) z[t.key] = i })
    if (z.name === undefined && kopf.length) z.name = 0
    setZuordnung(z)
  }, [kopf.join("|")])

  const holen = (r: string[], key: string) => (zuordnung[key] !== undefined && zuordnung[key] >= 0 ? (r[zuordnung[key]] || "").trim() : "")
  const geprueft = React.useMemo(() => {
    const gesehen = new Map<string, number>()
    return daten.map((r, i) => {
      const o = { name: holen(r, "name"), ort: holen(r, "ort"), adresse: holen(r, "adresse"), kname: holen(r, "kname"), kfunktion: holen(r, "kfunktion"), ktel: holen(r, "ktel"), kmail: holen(r, "kmail"), notiz: holen(r, "notiz") }
      let status = "neu", info = ""
      const schluessel = M.firmaNorm(o.name) + "|" + (M.telNorm(o.ktel) || "")
      if (!o.name) { status = "fehlt"; info = "Firma fehlt" }
      else if (M.SPERRLISTE.some((e: any) => (o.ktel && e.telefon === M.telNorm(o.ktel)) || (o.kmail && e.email === M.mailNorm(o.kmail)))) { status = "gesperrt"; info = "steht auf der Sperrliste" }
      else {
        const d = M.dubletten({ name: o.name, ort: o.ort, telefone: [o.ktel], mails: [o.kmail] })
        if (d.length) { status = "dublette"; info = d[0].l.name + " · " + d[0].grund }
        else if (gesehen.has(schluessel)) { status = "dublette"; info = "doppelt in der Liste (Zeile " + (gesehen.get(schluessel)! + 1) + ")" }
      }
      gesehen.set(schluessel, i)
      return { o, status, info }
    })
  }, [daten, zuordnung])
  const zaehl = (s: string) => geprueft.filter((g) => g.status === s).length
  const nehmen = geprueft.filter((g) => g.status === "neu" || (g.status === "dublette" && !dubUeberspringen))

  async function datei(f: File | undefined) {
    if (!f) return
    if (/\.xlsx?$/i.test(f.name)) { toast("Excel-Dateien bitte als CSV speichern oder die Zellen kopieren und unten einfügen."); return }
    setText(await f.text())
  }
  function importieren() {
    if (!mandat || !betreuer) return toast("Bitte Mandat und Betreuer wählen.")
    const tel = bereich !== "standort"
    nehmen.forEach(({ o }) => {
      const l = M.neuerLead({
        mandat, name: o.name, ort: o.ort || null, adresse: o.adresse || null, stufe: "recherche", betreuer, angelegt: M.HEUTE, quelle: "import",
        setter: tel && M.person(betreuer)?.rolle === "setter" ? betreuer : null,
        kontakte: o.kname || o.ktel || o.kmail ? [{ name: o.kname || "Zentrale", funktion: o.kfunktion || null, tel: o.ktel || null, mail: o.kmail || null }] : [],
        next: { datum: M.HEUTE, zeit: null, text: tel ? "Erstanruf" : "Eigentümer ansprechen" },
      })
      M.verlauf(l, ui.ich, "anlage", "Importiert", o.notiz || null)
    })
    bump()
    toast(`${M.plural(nehmen.length, "Lead", "Leads")} importiert`, { description: `${zaehl("dublette")} Dubletten, ${zaehl("gesperrt")} gesperrte und ${zaehl("fehlt")} unvollständige Zeilen ${dubUeberspringen ? "übersprungen" : "geprüft"}.` })
    setText("")
  }

  return (
    <Card>
      <CardHeader><CardTitle>Leads importieren</CardTitle><CardDescription>CSV-Datei hochladen oder Zellen direkt aus Excel kopieren und einfügen. Dubletten und gesperrte Nummern werden erkannt.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5"><Label htmlFor="ib" className="text-xs text-muted-foreground">Bereich</Label>
            <NativeSelect id="ib" value={bereich} onChange={(e) => setBereich(e.target.value)}>{M.BEREICHE.map((b: any) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}</NativeSelect></div>
          <div className="grid gap-1.5"><Label htmlFor="im" className="text-xs text-muted-foreground">Mandat</Label>
            <NativeSelect id="im" value={mandat} onChange={(e) => setMandat(e.target.value)}>{mandate.map((m: any) => <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>)}</NativeSelect></div>
          <div className="grid gap-1.5"><Label htmlFor="iw" className="text-xs text-muted-foreground">Betreut von</Label>
            <NativeSelect id="iw" value={betreuer} onChange={(e) => setBetreuer(e.target.value)}>{leute.map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}</NativeSelect></div>
        </div>
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm"><label className="cursor-pointer"><FileUp />CSV-Datei wählen<input type="file" accept=".csv,.txt,text/csv,.xlsx,.xls" className="sr-only" onChange={(e) => { datei(e.target.files?.[0]); e.target.value = "" }} /></label></Button>
            <span className="text-xs text-muted-foreground">oder hier einfügen:</span>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Firma\tOrt\tAnsprechpartner\tTelefon\nMuster GmbH\tHamburg\tAnna Beispiel\t040 123456"} className="min-h-28 font-mono text-xs" aria-label="Daten einfügen" />
        </div>
        {zeilen.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={kopfzeile} onCheckedChange={(v) => setKopfzeile(!!v)} />Erste Zeile ist die Überschrift</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={dubUeberspringen} onCheckedChange={(v) => setDubUeberspringen(!!v)} />Dubletten überspringen</label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ZIELE.map((t) => (
                <div key={t.key} className="grid gap-1.5"><Label htmlFor={"z" + t.key} className="text-xs text-muted-foreground">{t.label}{t.pflicht ? " *" : ""}</Label>
                  <NativeSelect id={"z" + t.key} size="sm" value={String(zuordnung[t.key] ?? -1)} onChange={(e) => setZuordnung({ ...zuordnung, [t.key]: Number(e.target.value) })}>
                    <NativeSelectOption value="-1">nicht übernehmen</NativeSelectOption>
                    {kopf.map((h, i) => <NativeSelectOption key={i} value={String(i)}>{h || "Spalte " + (i + 1)}</NativeSelectOption>)}
                  </NativeSelect></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline" className="border-transparent bg-ok/15 text-ok">{zaehl("neu")} neu</Badge>
              <Badge variant="outline" className="border-transparent bg-warn/15 text-warn">{zaehl("dublette")} Dubletten</Badge>
              <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">{zaehl("gesperrt")} gesperrt</Badge>
              {zaehl("fehlt") > 0 && <Badge variant="secondary">{zaehl("fehlt")} ohne Firma</Badge>}
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Firma</TableHead><TableHead>Ort</TableHead><TableHead className="hidden md:table-cell">Ansprechpartner</TableHead><TableHead className="hidden sm:table-cell">Telefon</TableHead><TableHead>Prüfung</TableHead></TableRow></TableHeader>
                <TableBody>
                  {geprueft.slice(0, 100).map((g, i) => (
                    <TableRow key={i} className={g.status === "neu" ? "" : "text-muted-foreground"}>
                      <TableCell className="font-medium">{g.o.name || "—"}</TableCell><TableCell>{g.o.ort}</TableCell>
                      <TableCell className="hidden md:table-cell">{g.o.kname}</TableCell><TableCell className="hidden font-mono text-xs sm:table-cell">{g.o.ktel}</TableCell>
                      <TableCell>{g.status === "neu" ? <span className="text-ok">neu</span> : <span className={g.status === "gesperrt" ? "text-destructive" : "text-warn"}>{g.info}</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
      {zeilen.length > 0 && <CardFooter><Button onClick={importieren} disabled={!nehmen.length || !mandat || !betreuer}><Upload />{M.plural(nehmen.length, "Lead", "Leads")} importieren</Button></CardFooter>}
    </Card>
  )
}

function Export() {
  const leadsCsv = () => {
    const kopf = ["Bereich", "Mandat", "Firma", "Ort", "Adresse", "Phase", "Betreut von", "Setter", "Closer", "Nächster Schritt", "Datum", "Ansprechpartner", "Funktion", "Telefon", "E-Mail", "Gesperrt", "Abschluss", "LUMIO-Umsatz", "Angelegt"]
    const zeilen = M.LEADS.map((l: any) => {
      const k = l.kontakte[0] || {}
      return [M.BEREICHE.find((b: any) => b.id === l.bereich)?.name, M.mandat(l.mandat)?.name, l.name, l.ort, l.adresse, M.stufeVon(l)?.name,
        M.person(l.betreuer)?.voll, M.person(l.setter)?.voll, M.person(l.closer)?.voll, l.next?.text, l.next?.datum,
        k.name, k.funktion, k.tel, k.mail, M.istGesperrt(l) ? "ja" : "", l.abschluss?.datum, l.abschluss ? Math.round(M.lumioGesamt(l)) : "", l.angelegt]
    })
    herunterladen(`LUMIO-Leads-${M.HEUTE}.csv`, csvSchreiben(kopf, zeilen))
  }
  const sperreCsv = () => herunterladen(`LUMIO-Sperrliste-${M.HEUTE}.csv`, csvSchreiben(["Telefon", "E-Mail", "Firma", "Grund", "Seit"],
    M.SPERRLISTE.map((e: any) => [e.telefon, e.email, e.firma, e.grund, e.datum])))
  return (
    <Card>
      <CardHeader><CardTitle>Exportieren</CardTitle><CardDescription>Als CSV für Excel. Enthält nur, was du sehen darfst.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={leadsCsv}><Download />Alle Leads ({M.LEADS.length})</Button>
        <Button variant="outline" onClick={sperreCsv}><Download />Sperrliste ({M.SPERRLISTE.length})</Button>
      </CardContent>
    </Card>
  )
}
