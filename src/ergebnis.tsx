import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bump, useUI } from "@/store"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { UebergabeFormular } from "@/uebergabe"
import { CalendarPlus, PhoneMissed, PhoneForwarded, ShieldBan, ThumbsDown } from "lucide-react"

/* Vier Knöpfe nach dem Anruf oder Besuch. Bei "Kein Interesse" folgt der Einwand, bei Termin/Rückruf das Datum. */
export function Ergebnis({ l, breit }: { l: any; breit?: boolean }) {
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
