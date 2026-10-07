import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { bump, useUI } from "@/store"
import { mandatSpeichern } from "@/daten/echt"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { Loader2, Plus, X } from "lucide-react"

const ARTEN = [
  ["fix", "Fester Betrag je Abschluss/Standort"],
  ["marge", "Anteil vom Monatsbeitrag über die Laufzeit"],
  ["prozent", "Prozent vom Auftragsvolumen, einmalig"],
  ["kopf", "Je Teilnehmer (Prozent der Dealgröße, mit Mindestbetrag)"],
  ["offen", "Noch offen"],
]

function Feld({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return <div className={"grid gap-1.5 " + (className || "")}><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

/* Mandat anlegen oder bearbeiten (nur Geschäftsführung) */
export function MandatSheet({ mandat, offen, onClose }: { mandat: any | null; offen: boolean; onClose: () => void }) {
  return (
    <Sheet open={offen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {offen && <Formular key={mandat?.id || "neu"} m={mandat} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function Formular({ m, onClose }: { m: any | null; onClose: () => void }) {
  const ui = useUI()
  const [w, setW] = React.useState(() => ({
    name: m?.name || "", bereich: m?.bereich || "werbung", produkt: m?.produkt || "", status: m?.status || "aktiv",
    typ: m?.k?.typ || "offen", betrag: m?.k?.betrag ?? "", satz: m?.k?.satz ?? "", min: m?.k?.min ?? "",
    produkte: (m?.k?.produkte || []).join("\n"), rueckhalt: m?.k?.rueckhalt ?? 20, stornofrist: m?.k?.stornofrist ?? 6,
    ktext: m?.ktext || "", hv: m?.hv ?? 0, seit: m?.seit || "",
    apName: m?.ap?.name || "", apFunktion: m?.ap?.funktion || "", apTel: m?.ap?.tel || "", apMail: m?.ap?.mail || "",
    felder: (m?.felder || []).map((f: any) => ({ ...f })) as { key: string; label: string; typ: string }[],
  }))
  const [laeuft, setLaeuft] = React.useState(false)
  const set = (k: string, v: any) => setW((x) => ({ ...x, [k]: v }))
  const zahl = (v: any) => (v === "" || v === null ? undefined : Number(v))

  async function speichern(e: React.FormEvent) {
    e.preventDefault()
    const k: any = { typ: w.typ }
    if (w.typ === "fix") k.betrag = zahl(w.betrag)
    if (w.typ === "marge" || w.typ === "prozent" || w.typ === "kopf") k.satz = zahl(w.satz)
    if (w.typ === "kopf") k.min = zahl(w.min) || 0
    if (w.bereich === "d2d") { k.produkte = String(w.produkte).split("\n").map((x: string) => x.trim()).filter(Boolean); k.rueckhalt = Number(w.rueckhalt) || 0; k.stornofrist = Number(w.stornofrist) || 0 }
    const neu = {
      ...(m || {}), name: w.name.trim(), bereich: w.bereich, produkt: w.produkt.trim(), status: w.status, k, ktext: w.ktext.trim(),
      hv: Number(w.hv) || 0, seit: w.seit || null,
      ap: { name: w.apName.trim() || undefined, funktion: w.apFunktion.trim() || undefined, tel: w.apTel.trim() || undefined, mail: w.apMail.trim() || undefined },
      felder: w.felder.filter((f) => f.label.trim()).map((f) => ({ key: f.key || f.label.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "_"), label: f.label.trim(), typ: f.typ || "text" })),
    }
    setLaeuft(true)
    try {
      const gespeichert = ui.echt ? await mandatSpeichern(neu) : { ...neu, id: m?.id || "m" + (M.MANDATE.length + 1) }
      const i = M.MANDATE.findIndex((x: any) => x.id === gespeichert.id)
      if (i >= 0) M.MANDATE[i] = gespeichert; else M.MANDATE.push(gespeichert)
      M.LEADS.forEach((l: any) => { if (l.mandat === gespeichert.id) l.bereich = gespeichert.bereich })
      bump(); toast(`„${gespeichert.name}“ gespeichert`); onClose()
    } catch (x: any) { toast(x.message) } finally { setLaeuft(false) }
  }

  return (
    <form onSubmit={speichern} className="flex min-h-full flex-col">
      <SheetHeader><SheetTitle>{m ? "Mandat bearbeiten" : "Neues Mandat"}</SheetTitle><SheetDescription>Für wen ihr verkauft und was es euch bringt.</SheetDescription></SheetHeader>
      <div className="grid flex-1 gap-4 px-4">
        <Feld id="mn" label="Name"><Input id="mn" value={w.name} onChange={(e) => set("name", e.target.value)} required /></Feld>
        <div className="grid grid-cols-2 gap-3">
          <Feld id="mb" label="Bereich"><NativeSelect id="mb" value={w.bereich} onChange={(e) => set("bereich", e.target.value)}>{M.BEREICHE.map((b: any) => <NativeSelectOption key={b.id} value={b.id}>{b.name}</NativeSelectOption>)}</NativeSelect></Feld>
          <Feld id="ms" label="Status"><NativeSelect id="ms" value={w.status} onChange={(e) => set("status", e.target.value)}>
            {[["anbahnung", "Anbahnung"], ["verhandlung", "in Verhandlung"], ["aktiv", "aktiv"], ["pausiert", "pausiert"], ["beendet", "beendet"]].map(([v, t]) => <NativeSelectOption key={v} value={v}>{t}</NativeSelectOption>)}
          </NativeSelect></Feld>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Feld id="mp" label="Produkt"><Input id="mp" value={w.produkt} onChange={(e) => set("produkt", e.target.value)} placeholder="z. B. HPC-Ladeparks" /></Feld>
          <Feld id="mz" label="Läuft seit"><Input id="mz" type="date" value={w.seit} onChange={(e) => set("seit", e.target.value)} /></Feld>
        </div>
        <Feld id="mk" label="Vergütung"><NativeSelect id="mk" value={w.typ} onChange={(e) => set("typ", e.target.value)}>{ARTEN.map(([v, t]) => <NativeSelectOption key={v} value={v}>{t}</NativeSelectOption>)}</NativeSelect></Feld>
        {w.typ !== "offen" && (
          <div className="grid grid-cols-2 gap-3">
            {w.typ === "fix" && <Feld id="mbt" label="Betrag je Abschluss (€)"><Input id="mbt" type="number" min={0} value={w.betrag} onChange={(e) => set("betrag", e.target.value)} required /></Feld>}
            {w.typ !== "fix" && <Feld id="msa" label={w.typ === "marge" ? "LUMIO-Anteil am Monatsbeitrag (%)" : "Prozent (%)"}><Input id="msa" type="number" min={0} max={100} step="0.1" value={w.satz} onChange={(e) => set("satz", e.target.value)} required /></Feld>}
            {w.typ === "kopf" && <Feld id="mmi" label="Mindestens je Teilnehmer (€)"><Input id="mmi" type="number" min={0} value={w.min} onChange={(e) => set("min", e.target.value)} /></Feld>}
          </div>
        )}
        <Feld id="mt" label="Konditionen in Worten"><Textarea id="mt" value={w.ktext} onChange={(e) => set("ktext", e.target.value)} className="min-h-16" /></Feld>
        {w.bereich === "d2d" && (
          <>
            <Feld id="mpr" label="Produkte und Tarife (eins pro Zeile)"><Textarea id="mpr" value={w.produkte} onChange={(e) => set("produkte", e.target.value)} className="min-h-20" placeholder={"Pure Speed 250\nKombi Internet + TV"} /></Feld>
            <div className="grid grid-cols-2 gap-3">
              <Feld id="mrh" label="Rückhalt von der Provision (%)"><Input id="mrh" type="number" min={0} max={100} value={w.rueckhalt} onChange={(e) => set("rueckhalt", e.target.value)} /></Feld>
              <Feld id="msf" label="Stornohaftung (Monate)"><Input id="msf" type="number" min={0} max={36} value={w.stornofrist} onChange={(e) => set("stornofrist", e.target.value)} /></Feld>
            </div>
          </>
        )}
        {(w.bereich === "standort" || w.bereich === "d2d") && <Feld id="mh" label="Anteil für Handelsvertreter (%)"><Input id="mh" type="number" min={0} max={100} value={w.hv} onChange={(e) => set("hv", e.target.value)} /></Feld>}
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">Ansprechpartner beim Mandanten</span>
          <div className="grid grid-cols-2 gap-3">
            <Input aria-label="Name" placeholder="Name" value={w.apName} onChange={(e) => set("apName", e.target.value)} />
            <Input aria-label="Funktion" placeholder="Funktion" value={w.apFunktion} onChange={(e) => set("apFunktion", e.target.value)} />
            <Input aria-label="Telefon" placeholder="Telefon" type="tel" value={w.apTel} onChange={(e) => set("apTel", e.target.value)} />
            <Input aria-label="E-Mail" placeholder="E-Mail" type="email" value={w.apMail} onChange={(e) => set("apMail", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">Eigene Felder für Leads dieses Mandats</span>
          {w.felder.map((f, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label="Feldname" value={f.label} onChange={(e) => set("felder", w.felder.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="z. B. Stellplätze" />
              <NativeSelect aria-label="Art" value={f.typ} onChange={(e) => set("felder", w.felder.map((x, j) => (j === i ? { ...x, typ: e.target.value } : x)))} className="w-28">
                <NativeSelectOption value="text">Text</NativeSelectOption><NativeSelectOption value="zahl">Zahl</NativeSelectOption>
              </NativeSelect>
              <Button type="button" variant="ghost" size="icon" aria-label="Feld entfernen" onClick={() => set("felder", w.felder.filter((_, j) => j !== i))}><X /></Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="-ml-2 justify-start" onClick={() => set("felder", [...w.felder, { key: "", label: "", typ: "text" }])}><Plus />Feld hinzufügen</Button>
        </div>
      </div>
      <SheetFooter className="sticky bottom-0 border-t bg-background/95"><Button type="submit" disabled={laeuft}>{laeuft && <Loader2 className="animate-spin" />}Speichern</Button></SheetFooter>
    </form>
  )
}
