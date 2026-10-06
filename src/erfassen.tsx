import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GebietsKarte } from "@/gebiets-karte"
import { bump, useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"
import * as K from "@/model/karte.js"
import { toast } from "sonner"
import { AlertTriangle, Camera, CheckCircle2, Link2, Loader2, LocateFixed, MapPin, X } from "lucide-react"

export function ErfassenSheet() {
  const ui = useUI()
  const [lauf, setLauf] = React.useState(0)
  React.useEffect(() => { if (ui.erfassen) setLauf((n) => n + 1) }, [ui.erfassen])
  return (
    <Sheet open={ui.erfassen} onOpenChange={(o) => !o && ui.setErfassen(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {ui.erfassen && <Inhalt key={lauf} />}
      </SheetContent>
    </Sheet>
  )
}

function Feld({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-1.5", className)}><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

/* Foto verkleinern, damit es schnell hochgeht */
function fotoLesen(f: File): Promise<string> {
  return new Promise((ok, fehler) => {
    const r = new FileReader()
    r.onerror = fehler
    r.onload = () => {
      const img = new Image()
      img.onerror = () => ok(String(r.result))
      img.onload = () => {
        const s = Math.min(1, 1024 / Math.max(img.width, img.height))
        const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
        ok(c.toDataURL("image/jpeg", 0.8))
      }
      img.src = String(r.result)
    }
    r.readAsDataURL(f)
  })
}

type Pos = { lat: number; lng: number; genau?: number | null }

function Inhalt() {
  const ui = useUI()
  const gf = ui.istGF
  const [modus, setModus] = React.useState("gps")
  const [status, setStatus] = React.useState<"suche" | "ok">("suche")
  const [hinweis, setHinweis] = React.useState<string | null>(null)
  const [pos, setPos] = React.useState<Pos | null>(null)
  const [quelle, setQuelle] = React.useState<"gps" | "link" | "demo">("gps")
  const [name, setName] = React.useState("")
  const [adresse, setAdresse] = React.useState("")
  const [adrLaedt, setAdrLaedt] = React.useState(false)
  const [link, setLink] = React.useState("")
  const [linkFehler, setLinkFehler] = React.useState<string | null>(null)
  const mandate = M.MANDATE.filter((m: any) => m.bereich === "standort" && ["aktiv", "verhandlung"].includes(m.status))
  const [mandat, setMandat] = React.useState(mandate[0]?.id || "")
  const [stufe, setStufe] = React.useState("recherche")
  const [kname, setKname] = React.useState("")
  const [ktel, setKtel] = React.useState("")
  const [notiz, setNotiz] = React.useState("")
  const [fotos, setFotos] = React.useState<string[]>([])
  const [betreuerWahl, setBetreuerWahl] = React.useState("")
  const fotoInput = React.useRef<HTMLInputElement>(null)

  const u = pos ? K.unitAt(pos.lat, pos.lng) : null
  const owner = K.besitzer(u)
  const betreuer = gf ? betreuerWahl || owner || "" : ui.ich
  const nah = pos ? K.naheLeads(pos, 60) : []
  const stadtName = (id: string) => K.STAEDTE.find((s: any) => s.id === id)?.name ?? ""

  async function uebernehmen(p: Pos, q: "gps" | "link" | "demo", extra?: { name?: string; adresse?: string }) {
    setPos(p); setQuelle(q); setStatus("ok")
    if (extra?.name) setName(extra.name)
    if (extra?.adresse) setAdresse(extra.adresse)
    const einheit = K.unitAt(p.lat, p.lng)
    if (einheit) ui.setKartenStadt(einheit.stadt)
    if (q !== "demo" && !extra?.adresse) {
      setAdrLaedt(true)
      const a = await K.adresseZu(p)
      setAdrLaedt(false)
      if (a) { if (a.name && !extra?.name) setName(a.name); if (a.adresse) setAdresse(a.adresse) }
      else setHinweis((h) => h ?? "Die Adresse konnte gerade nicht automatisch geholt werden. Bitte kurz eintippen.")
    }
  }
  function beispiel(grund: string) {
    const b = K.beispielPunkt(ui.kartenStadt, gf ? null : ui.ich)
    setHinweis(grund + " In der Vorschau nehme ich deshalb einen Beispiel-Standort in " + stadtName(ui.kartenStadt) + ". In der App auf dem Handy steht hier dein echter Standort.")
    uebernehmen({ lat: b.lat, lng: b.lng, genau: 12 }, "demo", { name: b.name, adresse: b.adresse })
  }
  function gpsHolen() {
    setStatus("suche"); setHinweis(null)
    if (!("geolocation" in navigator)) return beispiel("Dieses Gerät gibt keinen Standort her.")
    navigator.geolocation.getCurrentPosition(
      (p) => uebernehmen({ lat: p.coords.latitude, lng: p.coords.longitude, genau: p.coords.accuracy }, "gps"),
      (e) => beispiel(e.code === 1 ? "Die Standortfreigabe ist hier gesperrt." : "Das GPS hat nicht rechtzeitig geantwortet."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  }
  React.useEffect(() => { gpsHolen() }, [])

  function linkUebernehmen() {
    const r = K.linkLesen(link)
    if (!r) { setLinkFehler("In diesem Link steht kein Ort. In Google Maps oder Apple Karten auf „Teilen“ und „Link kopieren“ tippen."); return }
    if (r.kurz) { setLinkFehler("Kurzlinks (maps.app.goo.gl) kann erst die echte App auflösen, weil sie dafür den Server braucht. Bis dahin bitte GPS nehmen oder den langen Link aus dem Browser."); return }
    setLinkFehler(null); setHinweis(null)
    uebernehmen({ lat: r.lat, lng: r.lng, genau: null }, "link", { name: r.name, adresse: r.adresse })
  }

  async function fotosDazu(files: FileList | null) {
    if (!files) return
    const neu = await Promise.all(Array.from(files).slice(0, 4).map(fotoLesen))
    setFotos((f) => f.concat(neu).slice(0, 6))
  }

  function speichern(e: React.FormEvent) {
    e.preventDefault()
    if (!pos || !betreuer) return
    const l = K.standortAnlegen({
      mandat, name: name.trim(), adresse: adresse.trim(), stufe, betreuer, geo: { lat: pos.lat, lng: pos.lng }, fotos,
      kontakt: kname.trim() ? { name: kname.trim(), funktion: null, tel: ktel.trim() || null, mail: null } : null,
      quelle, genau: pos.genau, notiz: notiz.trim(),
    }, ui.ich)
    bump(); ui.setErfassen(false)
    toast(`„${l.name}“ ist erfasst`, { description: (l.ort ? l.ort + " · " : "") + M.mandat(l.mandat).name, action: { label: "Öffnen", onClick: () => ui.oeffne(l.id) } })
  }

  const gebiet = !pos ? null
    : !u ? { ton: "warn", text: "Liegt außerhalb von Hamburg, Berlin und Kiel." }
    : owner === ui.ich ? { ton: "ok", text: "In deinem Gebiet · " + u.name }
    : owner ? { ton: gf ? "info" : "warn", text: (gf ? "Gebiet von " + M.person(owner).name : "Liegt in " + M.person(owner).name + "s Gebiet") + " · " + u.name }
    : { ton: "info", text: "Freier " + (u.stadt === "kiel" ? "Bereich" : "Stadtteil") + " · " + u.name + ", noch niemandem zugeteilt" }

  return (
    <form onSubmit={speichern} className="flex min-h-full flex-col">
      <SheetHeader className="gap-1 border-b pb-4">
        <SheetTitle className="flex items-center gap-2 text-lg"><LocateFixed className="size-5" />Standort hier erfassen</SheetTitle>
        <SheetDescription>Vor Ort antippen. Ort, Adresse und Gebiet trägt die App selbst ein.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 p-4">
        <Tabs value={modus} onValueChange={setModus}>
          <TabsList className="w-full">
            <TabsTrigger value="gps" className="flex-1"><LocateFixed />GPS</TabsTrigger>
            <TabsTrigger value="link" className="flex-1"><Link2 />Link aus Karten-App</TabsTrigger>
          </TabsList>
        </Tabs>

        {modus === "link" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link aus Google Maps oder Apple Karten einfügen" aria-label="Karten-Link" />
              <Button type="button" variant="secondary" onClick={linkUebernehmen} disabled={!link.trim()}>Übernehmen</Button>
            </div>
            {linkFehler ? <p className="text-xs text-destructive">{linkFehler}</p>
              : <p className="text-xs text-muted-foreground">Im Ort auf „Teilen“ → „Link kopieren“, dann hier einfügen. Name und Adresse kommen mit, wenn der Link sie enthält.</p>}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border">
          {pos ? (
            <GebietsKarte klein stadt={u?.stadt || ui.kartenStadt} leads={K.leadsIn(u?.stadt || ui.kartenStadt)} punkt={pos} className="h-44 w-full" />
          ) : (
            <div className="flex h-44 flex-col items-center justify-center gap-2 bg-muted/40 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />Standort wird gesucht …<span className="text-xs">Falls das Handy fragt: „Erlauben“ tippen.</span>
            </div>
          )}
          {pos && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-mono tabular">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}{pos.genau ? " · ±" + Math.round(pos.genau) + " m" : ""}</span>
              <span>{quelle === "gps" ? "per GPS" : quelle === "link" ? "aus Link" : "Beispiel (Vorschau)"}</span>
              {modus === "gps" && <Button type="button" variant="ghost" size="xs" onClick={gpsHolen}><LocateFixed />Neu orten</Button>}
            </div>
          )}
        </div>

        {hinweis && <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">{hinweis}</p>}

        {gebiet && (
          <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
            gebiet.ton === "ok" && "bg-ok/10 text-ok", gebiet.ton === "warn" && "bg-warn/15 text-warn", gebiet.ton === "info" && "bg-muted text-foreground")}>
            {gebiet.ton === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : gebiet.ton === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <MapPin className="mt-0.5 size-4 shrink-0" />}
            <span>{gebiet.text}</span>
          </div>
        )}

        {nah.length > 0 && (
          <div className="space-y-2 rounded-lg border border-warn/40 bg-warn/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4 text-warn" />Hier gibt es schon {nah.length === 1 ? "einen Standort" : nah.length + " Standorte"}</div>
            {nah.slice(0, 3).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0"><span className="block truncate">{l.name}</span><span className="block text-xs text-muted-foreground">{M.stufeVon(l).name} · {M.person(l.betreuer)?.name} · {Math.round(K.abstandM(pos!, l.geo))} m entfernt</span></span>
                <Button type="button" variant="outline" size="xs" onClick={() => { ui.setErfassen(false); ui.oeffne(l.id) }}>Öffnen</Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4">
          {!mandate.length && <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">Es gibt noch kein Standort-Mandat. Die Geschäftsführung legt es unter „Mandate“ an.</p>}
          <Feld id="em" label="Für welches Mandat">
            <NativeSelect id="em" value={mandat} onChange={(e) => setMandat(e.target.value)}>{mandate.map((m: any) => <NativeSelectOption key={m.id} value={m.id}>{m.name} · {m.produkt}</NativeSelectOption>)}</NativeSelect>
          </Feld>
          <Feld id="en" label="Name des Objekts">
            <Input id="en" value={name} onChange={(e) => setName(e.target.value)} required placeholder="z. B. Kiosk am Markt" />
          </Feld>
          <Feld id="ea" label={adrLaedt ? "Adresse · wird geholt …" : "Adresse"}>
            <Input id="ea" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Straße Hausnummer, PLZ Ort" />
          </Feld>
          {gf && (
            <Feld id="eb" label="Handelsvertreter">
              <NativeSelect id="eb" value={betreuer} onChange={(e) => setBetreuerWahl(e.target.value)} required>
                <NativeSelectOption value="">bitte wählen</NativeSelectOption>
                {M.PERSONEN.filter((p: any) => p.rolle === "hv").map((p: any) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}{p.id === owner ? " (Gebiet)" : ""}</NativeSelectOption>)}
              </NativeSelect>
            </Feld>
          )}
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Wie weit bist du?</span>
            <ToggleGroup type="single" variant="outline" size="sm" value={stufe} onValueChange={(v) => v && setStufe(v)} className="w-full">
              <ToggleGroupItem value="recherche" className="flex-1">Nur gesehen</ToggleGroupItem>
              <ToggleGroupItem value="eigentuemer" className="flex-1">Mit Inhaber gesprochen</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {stufe === "eigentuemer" && (
            <div className="grid grid-cols-2 gap-3">
              <Feld id="ek" label="Ansprechpartner"><Input id="ek" value={kname} onChange={(e) => setKname(e.target.value)} placeholder="Name" /></Feld>
              <Feld id="et" label="Telefon"><Input id="et" type="tel" value={ktel} onChange={(e) => setKtel(e.target.value)} placeholder="+49 …" /></Feld>
            </div>
          )}
          <Feld id="ez" label="Notiz"><Textarea id="ez" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Strom liegt an, Fläche neben dem Eingang" className="min-h-16" /></Feld>
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Fotos</span>
            <div className="flex flex-wrap gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative size-20 overflow-hidden rounded-lg border">
                  <img src={f} alt={"Foto " + (i + 1)} className="size-full object-cover" />
                  <button type="button" onClick={() => setFotos(fotos.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5" aria-label="Foto entfernen"><X className="size-3.5" /></button>
                </div>
              ))}
              <Button type="button" variant="outline" className="size-20 flex-col gap-1 text-xs" onClick={() => fotoInput.current?.click()}><Camera className="size-5" />Foto</Button>
              <input ref={fotoInput} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { fotosDazu(e.target.files); e.target.value = "" }} />
            </div>
          </div>
        </div>
      </div>

      <SheetFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur">
        <Button type="submit" size="lg" disabled={status !== "ok" || !pos || !name.trim() || !betreuer || !mandat}><MapPin />Standort speichern</Button>
      </SheetFooter>
    </form>
  )
}
