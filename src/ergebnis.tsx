import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bump, useUI } from "@/store"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { UebergabeFormular } from "@/uebergabe"
import { Building2, CalendarPlus, Clock, Mail, PhoneMissed, PhoneForwarded, PhoneOff, ShieldBan, ThumbsDown, UserX, Voicemail } from "lucide-react"

/* Vier Knöpfe nach dem Anruf oder Besuch. Bei "Kein Interesse" folgt der Einwand, bei Termin/Rückruf das Datum. */
export function Ergebnis({ l, breit }: { l: any; breit?: boolean }) {
  if (M.istTel(l) && M.istNeuesModell(l)) return <ErgebnisWerbung l={l} breit={breit} />
  return <ErgebnisAlt l={l} breit={breit} />
}

function ErgebnisAlt({ l, breit }: { l: any; breit?: boolean }) {
  const ui = useUI()
  const [offen, setOffen] = React.useState<null | "kein" | "termin" | "rueckruf" | "sperre">(null)
  const [datum, setDatum] = React.useState(M.tag(1))
  const [zeit, setZeit] = React.useState("10:00")
  const tel = M.istTel(l)
  const lbl = tel ? { nicht: "Nicht erreicht", rueckruf: "Rückruf", kein: "Kein Interesse", termin: "Termin" }
                  : { nicht: "Nicht angetroffen", rueckruf: "Wiedervorlage", kein: "Kein Interesse", termin: "Besichtigung" }
  const fertig = (erg: string, x?: any) => { toast(M.protokoll(l, ui.ich, erg, x)); setOffen(null); bump() }

  return (
    <div className="space-y-3">
      <div className={"grid grid-cols-2 gap-2" + (breit ? " sm:grid-cols-4" : "")}>
        <Button variant="outline" size="sm" onClick={() => fertig("nicht")}><PhoneMissed />{lbl.nicht}</Button>
        <Button variant={offen === "rueckruf" ? "secondary" : "outline"} size="sm" onClick={() => setOffen(offen === "rueckruf" ? null : "rueckruf")}><PhoneForwarded />{lbl.rueckruf}</Button>
        <Button variant={offen === "kein" ? "secondary" : "outline"} size="sm" onClick={() => setOffen(offen === "kein" ? null : "kein")}><ThumbsDown />{lbl.kein}</Button>
        <Button size="sm" variant={offen === "termin" ? "secondary" : "default"} onClick={() => setOffen(offen === "termin" ? null : "termin")}><CalendarPlus />{lbl.termin}</Button>
      </div>
      {offen === "kein" && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <div className="text-xs text-muted-foreground">Woran ist es gescheitert?</div>
          <div className="flex flex-wrap gap-2">
            {M.EINWAENDE.map((e: string) => <Button key={e} variant="outline" size="xs" onClick={() => fertig("kein", { einwand: e })}>{e}</Button>)}
          </div>
          {tel && <button type="button" className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => setOffen("sperre")}><ShieldBan className="size-3.5" />Will nie wieder angerufen werden</button>}
        </div>
      )}
      {offen === "sperre" && (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="text-sm font-medium">Nicht mehr anrufen</div>
          <p className="text-xs text-muted-foreground">Die Nummern und E-Mails dieses Kontakts kommen auf die Sperrliste. Sie tauchen dann in keiner Anrufliste mehr auf, auch nicht bei einem neuen Import.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" onClick={() => { toast(M.sperren(l, ui.ich, "Werbewiderspruch")); setOffen(null); bump() }}><ShieldBan />Sperren</Button>
            <Button size="sm" variant="ghost" onClick={() => setOffen(null)}>Abbrechen</Button>
          </div>
        </div>
      )}
      {offen === "termin" && tel && <UebergabeFormular l={l} onFertig={() => setOffen(null)} onAbbrechen={() => setOffen(null)} />}
      {((offen === "termin" && !tel) || offen === "rueckruf") && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3" onSubmit={(e) => { e.preventDefault(); fertig(offen, { datum, zeit: zeit || null }) }}>
          <div className="grid gap-1"><Label htmlFor={"d" + l.id} className="text-xs text-muted-foreground">Datum</Label><Input id={"d" + l.id} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required className="h-8 w-40" /></div>
          <div className="grid gap-1"><Label htmlFor={"z" + l.id} className="text-xs text-muted-foreground">Uhrzeit</Label><Input id={"z" + l.id} type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} required={offen === "termin"} className="h-8 w-28" /></div>
          <Button type="submit" size="sm">{offen === "termin" ? lbl.termin + " eintragen" : "Eintragen"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOffen(null)}>Abbrechen</Button>
        </form>
      )}
    </div>
  )
}

/* Werbemandate: getrennt nach "nicht gesprochen" (zählt nur Versuche) und "gesprochen" (bewegt die Phase) */
function ErgebnisWerbung({ l, breit }: { l: any; breit?: boolean }) {
  const ui = useUI()
  type Offen = null | "kein" | "termin" | "rueckruf" | "sperre" | "zentrale" | "ap" | "info"
  const [offen, setOffen] = React.useState<Offen>(null)
  const [datum, setDatum] = React.useState(M.tag(1))
  const [zeit, setZeit] = React.useState("10:00")
  const [text, setText] = React.useState("")
  const [tel2, setTel2] = React.useState("")
  const fertig = (erg: string, x?: any) => { toast(M.protokoll(l, ui.ich, erg, x)); setOffen(null); setText(""); setTel2(""); bump() }
  const auf = (o: Offen, vorbelegt = "") => { setText(vorbelegt); setTel2(""); setOffen(offen === o ? null : o) }
  const inKontakt = ["recherche", "anrufversuch", "spaeter"].includes(l.stufe)
  const raster = "grid grid-cols-2 gap-2" + (breit ? " sm:grid-cols-4" : "")
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Niemanden Entscheidendes gesprochen</span>
          {inKontakt && <span className="tabular">Versuch {Math.min((l.versuche || 0) + 1, M.MAX_VERSUCHE)} von {M.MAX_VERSUCHE}</span>}
        </div>
        <div className={raster}>
          <Button variant="outline" size="sm" onClick={() => fertig("nicht")}><PhoneMissed />Nicht erreicht</Button>
          <Button variant="outline" size="sm" onClick={() => fertig("mailbox")}><Voicemail />Mailbox</Button>
          <Button variant={offen === "zentrale" ? "secondary" : "outline"} size="sm" onClick={() => auf("zentrale")}><Building2 />Zentrale</Button>
          <Button variant="outline" size="sm" onClick={() => fertig("falsche_nummer")}><PhoneOff />Falsche Nummer</Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Gesprochen</div>
        <div className={raster}>
          <Button variant={offen === "rueckruf" ? "secondary" : "outline"} size="sm" onClick={() => auf("rueckruf")}><PhoneForwarded />Rückruf</Button>
          <Button variant={offen === "info" ? "secondary" : "outline"} size="sm" onClick={() => auf("info", l.kontakte[0]?.mail || "")}><Mail />Info per Mail</Button>
          <Button variant={offen === "ap" ? "secondary" : "outline"} size="sm" onClick={() => auf("ap")}><UserX />Falscher Ansprechp.</Button>
          <Button variant={offen === "kein" ? "secondary" : "outline"} size="sm" onClick={() => auf("kein")}><ThumbsDown />Kein Interesse</Button>
        </div>
        <Button size="sm" className="w-full" variant={offen === "termin" ? "secondary" : "default"} onClick={() => auf("termin")}><CalendarPlus />Termin vereinbart</Button>
      </div>

      {offen === "zentrale" && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3" onSubmit={(e) => { e.preventDefault(); fertig("zentrale", { notiz: text }) }}>
          <div className="grid min-w-48 flex-1 gap-1"><Label htmlFor={"zn" + l.id} className="text-xs text-muted-foreground">Was hast du erfahren? (optional)</Label>
            <Input id={"zn" + l.id} value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Herr Meier, Durchwahl -23, ab 14 Uhr da" className="h-8" /></div>
          <Button type="submit" size="sm">Eintragen</Button>
        </form>
      )}
      {offen === "ap" && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3" onSubmit={(e) => { e.preventDefault(); fertig("falscher_ap", { name: text, tel: tel2 }) }}>
          <div className="grid min-w-40 flex-1 gap-1"><Label htmlFor={"an" + l.id} className="text-xs text-muted-foreground">Empfohlen wurde (optional)</Label><Input id={"an" + l.id} value={text} onChange={(e) => setText(e.target.value)} placeholder="Name" className="h-8" /></div>
          <div className="grid w-40 gap-1"><Label htmlFor={"at" + l.id} className="text-xs text-muted-foreground">Telefon</Label><Input id={"at" + l.id} value={tel2} onChange={(e) => setTel2(e.target.value)} className="h-8" inputMode="tel" /></div>
          <Button type="submit" size="sm">Eintragen</Button>
        </form>
      )}
      {offen === "info" && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3" onSubmit={(e) => { e.preventDefault(); fertig("info", { mail: text }) }}>
          <div className="grid min-w-48 flex-1 gap-1"><Label htmlFor={"im" + l.id} className="text-xs text-muted-foreground">E-Mail</Label><Input id={"im" + l.id} type="email" value={text} onChange={(e) => setText(e.target.value)} className="h-8" /></div>
          <Button type="submit" size="sm">Eintragen</Button>
        </form>
      )}
      {offen === "kein" && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <div className="text-xs text-muted-foreground">Woran ist es gescheitert?</div>
          <div className="flex flex-wrap gap-2">
            {M.EINWAENDE.map((e: string) => <Button key={e} variant="outline" size="xs" onClick={() => fertig("kein", { einwand: e })}>{e}</Button>)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => fertig("spaeter", { datum: M.monatePlus(3), einwand: "Kein Bedarf" })}><Clock className="size-3.5" />Jetzt kein Bedarf, in 3 Monaten nochmal</button>
            <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => setOffen("sperre")}><ShieldBan className="size-3.5" />Will nie wieder angerufen werden</button>
          </div>
        </div>
      )}
      {offen === "sperre" && (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="text-sm font-medium">Nicht mehr anrufen</div>
          <p className="text-xs text-muted-foreground">Die Nummern und E-Mails dieses Kontakts kommen auf die Sperrliste. Sie tauchen dann in keiner Anrufliste mehr auf, auch nicht bei einem neuen Import.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" onClick={() => { toast(M.sperren(l, ui.ich, "Werbewiderspruch")); setOffen(null); bump() }}><ShieldBan />Sperren</Button>
            <Button size="sm" variant="ghost" onClick={() => setOffen(null)}>Abbrechen</Button>
          </div>
        </div>
      )}
      {offen === "termin" && <UebergabeFormular l={l} onFertig={() => setOffen(null)} onAbbrechen={() => setOffen(null)} />}
      {offen === "rueckruf" && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3" onSubmit={(e) => { e.preventDefault(); fertig("rueckruf", { datum, zeit: zeit || null }) }}>
          <div className="grid gap-1"><Label htmlFor={"d" + l.id} className="text-xs text-muted-foreground">Datum</Label><Input id={"d" + l.id} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required className="h-8 w-40" /></div>
          <div className="grid gap-1"><Label htmlFor={"z" + l.id} className="text-xs text-muted-foreground">Uhrzeit</Label><Input id={"z" + l.id} type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} className="h-8 w-28" /></div>
          <Button type="submit" size="sm">Eintragen</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOffen(null)}>Abbrechen</Button>
        </form>
      )}
    </div>
  )
}
