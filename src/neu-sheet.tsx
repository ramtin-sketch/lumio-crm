import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { bump, useUI } from "@/store"
import * as M from "@/model/model.js"
import { toast } from "sonner"

function Feld({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return <div className={"grid gap-1.5 " + (className || "")}><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

export function NeuSheet() {
  const ui = useUI()
  const offen = !!ui.neu
  const gf = ui.istGF
  const bereich = gf ? ui.neu?.bereich || "werbung" : (M.person(ui.ich).rolle === "setter" ? "werbung" : "standort")
  const ms = M.MANDATE.filter((m: any) => m.bereich === bereich && ["aktiv", "verhandlung"].includes(m.status))
  const [mid, setMid] = React.useState<string>("")
  React.useEffect(() => {
    if (!offen) return
    const wunsch = ui.neu?.mandat
    setMid(wunsch && ms.some((m: any) => m.id === wunsch) ? wunsch : ms[0]?.id)
  }, [offen, bereich])
  const m = M.mandat(mid) || ms[0]
  const [pruef, setPruef] = React.useState({ name: "", ort: "", tel: "", mail: "" })
  React.useEffect(() => { if (offen) setPruef({ name: "", ort: "", tel: "", mail: "" }) }, [offen])
  const dubs = pruef.name.length > 2 || pruef.tel || pruef.mail ? M.dubletten({ name: pruef.name, ort: pruef.ort, telefone: [pruef.tel], mails: [pruef.mail] }) : []
  const gesperrt = M.SPERRLISTE.some((e: any) => (pruef.tel && e.telefon === M.telNorm(pruef.tel)) || (pruef.mail && e.email === M.mailNorm(pruef.mail)))

  const anlegen = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const w = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>
    const felder: Record<string, string> = {}
    m.felder.forEach((f: any) => { if (w["f_" + f.key]) felder[f.key] = w["f_" + f.key] })
    const neu = M.neuerLead({
      mandat: m.id, name: w.name, ort: w.ort || null, adresse: w.adresse || null, stufe: w.stufe, felder,
      betreuer: gf ? w.betreuer : ui.ich, angelegt: M.HEUTE,
      kontakte: w.kname ? [{ name: w.kname, funktion: w.kfunktion || null, tel: w.ktel || null, mail: w.kmail || null }] : [],
      next: w.ndatum ? { datum: w.ndatum, zeit: null, text: w.ntext || (bereich !== "standort" ? "Erstanruf" : "Eigentümer ansprechen") } : null,
    })
    neu.verlauf.push({ datum: M.HEUTE, wer: ui.ich, art: "anlage", titel: "Angelegt", text: null })
    bump(); ui.setNeu(null); toast(`„${neu.name}“ ist angelegt`); ui.oeffne(neu.id)
  }

  return (
    <Sheet open={offen} onOpenChange={(o) => !o && ui.setNeu(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{bereich === "werbung" ? "Neuer Werbekunde" : bereich === "bildung" ? "Neuer Arbeitgeber" : "Neuer Standort"}</SheetTitle>
          <SheetDescription>{bereich === "werbung" ? "Firma für eines eurer Werbemandate" : bereich === "bildung" ? "Arbeitgeber, dessen Mitarbeiter eine geförderte Weiterbildung machen könnten" : "Objekt für ein Standort-Mandat"}</SheetDescription>
        </SheetHeader>
        {offen && !m && (
          <div className="space-y-3 px-4">
            {gf && (
              <ToggleGroup type="single" variant="outline" size="sm" value={bereich} onValueChange={(v) => v && ui.setNeu({ bereich: v })} className="w-full">
                <ToggleGroupItem value="werbung" className="flex-1">Werbung</ToggleGroupItem>
                <ToggleGroupItem value="bildung" className="flex-1">Weiterbildung</ToggleGroupItem>
                <ToggleGroupItem value="standort" className="flex-1">Standort</ToggleGroupItem>
              </ToggleGroup>
            )}
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">Für diesen Bereich gibt es noch kein aktives Mandat.{gf ? " Leg es zuerst unter „Mandate“ an." : " Bitte bei der Geschäftsführung melden."}</p>
          </div>
        )}
        {offen && m && (
          <form key={bereich + mid} id="neuform" className="grid gap-4 px-4" onSubmit={anlegen} onChange={(e) => { const f = new FormData(e.currentTarget); setPruef({ name: String(f.get("name") || ""), ort: String(f.get("ort") || ""), tel: String(f.get("ktel") || ""), mail: String(f.get("kmail") || "") }) }}>
            {gf && (
              <ToggleGroup type="single" variant="outline" size="sm" value={bereich} onValueChange={(v) => v && ui.setNeu({ bereich: v })} className="w-full">
                <ToggleGroupItem value="werbung" className="flex-1">Werbung</ToggleGroupItem>
                <ToggleGroupItem value="bildung" className="flex-1">Weiterbildung</ToggleGroupItem>
                <ToggleGroupItem value="standort" className="flex-1">Standort</ToggleGroupItem>
              </ToggleGroup>
            )}
            <Feld id="nm" label="Mandat"><NativeSelect id="nm" value={m.id} onChange={(e) => setMid(e.target.value)}>{ms.map((x: any) => <NativeSelectOption key={x.id} value={x.id}>{x.name} · {x.produkt}</NativeSelectOption>)}</NativeSelect></Feld>
            <div className="grid grid-cols-2 gap-3">
              <Feld id="nn" label={bereich !== "standort" ? "Firma" : "Objekt"}><Input id="nn" name="name" required /></Feld>
              {(dubs.length > 0 || gesperrt) && (
                <div className="col-span-2 space-y-1 rounded-lg border border-warn/40 bg-warn/5 p-2.5 text-sm">
                  {gesperrt && <div className="font-medium text-destructive">Telefon oder E-Mail steht auf der Sperrliste. Nicht anrufen.</div>}
                  {dubs.slice(0, 3).map((d: any) => <div key={d.l.id}>Gibt es schon: <button type="button" className="font-medium underline underline-offset-2" onClick={() => { ui.setNeu(null); ui.oeffne(d.l.id) }}>{d.l.name}</button> <span className="text-muted-foreground">({d.grund}, {M.stufeVon(d.l)?.name}, {M.person(d.l.betreuer)?.name})</span></div>)}
                </div>
              )}
              <Feld id="no" label="Ort"><Input id="no" name="ort" /></Feld>
            </div>
            {bereich === "standort" && <Feld id="na" label="Adresse"><Input id="na" name="adresse" /></Feld>}
            {m.felder.length > 0 && <div className="grid grid-cols-2 gap-3">{m.felder.map((f: any) => <Feld key={f.key} id={"nf_" + f.key} label={f.label}><Input id={"nf_" + f.key} name={"f_" + f.key} type={f.typ === "zahl" ? "number" : "text"} /></Feld>)}</div>}
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <Feld id="nkn" label="Ansprechpartner"><Input id="nkn" name="kname" /></Feld>
              <Feld id="nkf" label="Funktion"><Input id="nkf" name="kfunktion" /></Feld>
              <Feld id="nkt" label="Telefon"><Input id="nkt" name="ktel" type="tel" /></Feld>
              <Feld id="nkm" label="E-Mail"><Input id="nkm" name="kmail" type="email" /></Feld>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <Feld id="nst" label="Phase"><NativeSelect id="nst" name="stufe">{M.STUFEN[bereich].filter((s: any) => !s.ende).map((s: any) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}</NativeSelect></Feld>
              {gf && <Feld id="nbe" label={bereich !== "standort" ? "Betreut von" : "Handelsvertreter"}>
                <NativeSelect id="nbe" name="betreuer" defaultValue={bereich !== "standort" ? ui.ich : "jonas"}>
                  {M.PERSONEN.filter((p: any) => (bereich !== "standort" ? p.rolle !== "hv" : p.rolle === "hv")).map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}
                </NativeSelect></Feld>}
              <Feld id="nnd" label="Nächster Schritt am"><Input id="nnd" name="ndatum" type="date" defaultValue={M.tag(1)} /></Feld>
              <Feld id="nnt" label="Was"><Input id="nnt" name="ntext" placeholder={bereich !== "standort" ? "Erstanruf" : "Eigentümer ansprechen"} /></Feld>
            </div>
          </form>
        )}
        <SheetFooter><Button type="submit" form="neuform">Anlegen</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
