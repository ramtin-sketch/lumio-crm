import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fotoUrls } from "@/daten/echt"
import { cn } from "@/lib/utils"
import * as V from "@/model/vorort.js"
import { Camera, CheckCircle2, X } from "lucide-react"

/* Foto verkleinern, damit es schnell hochgeht */
export function fotoLesen(f: File): Promise<string> {
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

const GRUPPEN: Record<string, string> = { standort: "Fragen an den Standort", check: "Checkliste für uns", fotos: "Fotos" }

/* Vor-Ort-Check: beim Erfassen und im Lead derselbe Block */
export function VorOrtCheck({ v, m, onSet, kompakt }: { v: any; m: any; onSet: (key: string, wert: any) => void; kompakt?: boolean }) {
  const werte = v || {}
  const alle = V.punkte(m)
  const st = V.stand({ vorOrt: werte }, m)
  return (
    <div className="space-y-4">
      {!kompakt && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{st.fertig} von {st.gesamt} erledigt</span>
            {st.offen.length === 0 && <span className="flex items-center gap-1 text-ok"><CheckCircle2 className="size-3.5" />vollständig</span>}
          </div>
          <Progress value={st.gesamt ? (st.fertig / st.gesamt) * 100 : 0} />
        </div>
      )}
      {Object.keys(GRUPPEN).map((g) => {
        const liste = alle.filter((p: any) => p.gruppe === g)
        if (!liste.length) return null
        return (
          <div key={g} className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{GRUPPEN[g]}</div>
            {g === "fotos" ? (
              <div className="flex flex-wrap gap-2">{liste.map((p: any) => <FotoPlatz key={p.key} titel={p.text} wert={werte[p.key]} onSet={(x) => onSet(p.key, x)} />)}</div>
            ) : (
              <div className="divide-y rounded-lg border">{liste.map((p: any) => <Punkt key={p.key} p={p} werte={werte} onSet={onSet} />)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Punkt({ p, werte, onSet }: { p: any; werte: any; onSet: (key: string, wert: any) => void }) {
  const id = "vo_" + p.key
  if (p.art === "haken") {
    return (
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm">
        <Checkbox id={id} checked={werte[p.key] === true} onCheckedChange={(x) => onSet(p.key, x === true)} className="mt-0.5" />
        <span>{p.text}</span>
      </label>
    )
  }
  const zeigeZusatz = p.zusatz && werte[p.key] === p.zusatz.wenn
  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{p.text}</span>
        <ToggleGroup type="single" variant="outline" size="sm" value={werte[p.key] || ""} onValueChange={(x) => onSet(p.key, x || null)} aria-label={p.text}>
          <ToggleGroupItem value="ja" className="px-3">Ja</ToggleGroupItem>
          <ToggleGroupItem value="nein" className="px-3">Nein</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {zeigeZusatz && (
        <Input key={p.zusatz.key + (werte[p.zusatz.key] || "")} defaultValue={werte[p.zusatz.key] || ""} placeholder={p.zusatz.label} aria-label={p.zusatz.label} className="h-9"
          onBlur={(e) => { const t = e.target.value.trim(); if (t !== (werte[p.zusatz.key] || "")) onSet(p.zusatz.key, t || null) }} />
      )}
    </div>
  )
}

function FotoPlatz({ titel, wert, onSet }: { titel: string; wert: string | null; onSet: (x: string | null) => void }) {
  const input = React.useRef<HTMLInputElement>(null)
  const [url, setUrl] = React.useState<string>(wert && wert.startsWith("data:") ? wert : "")
  React.useEffect(() => {
    let ok = true
    if (!wert) setUrl("")
    else if (wert.startsWith("data:")) setUrl(wert)
    else fotoUrls([wert]).then((u) => ok && setUrl(u[0] || ""))
    return () => { ok = false }
  }, [wert])
  return (
    <div className="grid w-32 gap-1">
      {wert ? (
        <div className="relative h-24 w-32 overflow-hidden rounded-lg border">
          {url ? <img src={url} alt={titel} className="size-full object-cover" /> : <div className="size-full animate-pulse bg-muted" />}
          <button type="button" onClick={() => onSet(null)} className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5" aria-label={titel + " entfernen"}><X className="size-3.5" /></button>
        </div>
      ) : (
        <Button type="button" variant="outline" className={cn("h-24 w-32 flex-col gap-1 border-dashed text-xs")} onClick={() => input.current?.click()}><Camera className="size-5" />Foto</Button>
      )}
      <span className="text-xs text-muted-foreground">{titel}</span>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onSet(await fotoLesen(f)) }} />
    </div>
  )
}
