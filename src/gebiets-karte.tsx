import * as React from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import * as K from "@/model/karte.js"
import * as M from "@/model/model.js"
import { cn } from "@/lib/utils"

/* Straßenkarte (CARTO/OpenStreetMap). In der Vorschau blockiert, dann zeichnen wir nur die Grenzen. */
let KACHELN: "?" | "ok" | "aus" = "?"
const hoerer = new Set<(s: typeof KACHELN) => void>()
const setzeKacheln = (s: typeof KACHELN) => { if (KACHELN === s) return; KACHELN = s; hoerer.forEach((f) => f(s)) }
export function useKacheln() {
  const [s, set] = React.useState(KACHELN)
  React.useEffect(() => { hoerer.add(set); return () => { hoerer.delete(set) } }, [])
  return s
}
function useDunkel() {
  const [d, set] = React.useState(() => document.documentElement.classList.contains("dark"))
  React.useEffect(() => {
    const mo = new MutationObserver(() => set(document.documentElement.classList.contains("dark")))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [])
  return d
}

function mix(a: string, b: string, t: number) {
  const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
  const x = h(a), y = h(b)
  return "#" + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("")
}
const PALETTE = {
  hell: { bg: "#e9eef4", ctx: "#f7f8fa", ctxRand: "#dfe4ea", frei: "#ffffff", rand: "#d3d9e2", ink: "#0e1523", label: "#5b6475" },
  dunkel: { bg: "#0a0f1c", ctx: "#121829", ctxRand: "#1d2436", frei: "#192033", rand: "#2a3248", ink: "#e6eaf2", label: "#9aa3b5" },
}
export const PIN = { offen: "#0e1523", offenDunkel: "#e6eaf2", eingereicht: "#f08c00", gewonnen: "#2f9e44", verloren: "#adb5bd" }
const pinFarbe = (l: any, dunkel: boolean) =>
  l.stufe === "gewonnen" ? PIN.gewonnen : l.stufe === "verloren" ? PIN.verloren : l.stufe === "eingereicht" ? PIN.eingereicht : dunkel ? PIN.offenDunkel : PIN.offen

function labelPunkt(u: any): [number, number] {
  const ring = u.g.reduce((a: any, p: any) => (p[0].length > a.length ? p[0] : a), [])
  let la = 0, lo = 0; ring.forEach((c: number[]) => { la += c[0]; lo += c[1] })
  const p: [number, number] = [la / ring.length, lo / ring.length]
  if (K.unitAt(p[0], p[1])?.id === u.id) return p
  return [(u.bbox[0] + u.bbox[2]) / 2, (u.bbox[1] + u.bbox[3]) / 2]
}

type Props = {
  stadt: string
  leads: any[]
  version?: number
  auswahl?: string | null
  onUnit?: (id: string) => void
  onLead?: (id: number) => void
  hervorheben?: string | null
  punkt?: { lat: number; lng: number; genau?: number | null } | null
  fokus?: { lat: number; lng: number } | null
  klein?: boolean
  className?: string
  objekte?: { id: string; geo: { lat: number; lng: number }; farbe: string; titel: string; radius?: number }[]
  onObjekt?: (id: string) => void
}

export function GebietsKarte({ stadt, leads, version, auswahl, onUnit, onLead, hervorheben, punkt, fokus, klein, className, objekte, onObjekt }: Props) {
  const box = React.useRef<HTMLDivElement>(null)
  const map = React.useRef<L.Map | null>(null)
  const kachel = React.useRef<L.TileLayer | null>(null)
  const flaechen = React.useRef<L.LayerGroup | null>(null)
  const namen = React.useRef<L.LayerGroup | null>(null)
  const pins = React.useRef<L.LayerGroup | null>(null)
  const dunkel = useDunkel()
  const kacheln = useKacheln()
  const cb = React.useRef({ onUnit, onLead, onObjekt }); cb.current = { onUnit, onLead, onObjekt }
  const units = React.useMemo(() => K.UNITS.filter((u: any) => u.stadt === stadt), [stadt])
  const aktuell = React.useRef({ units, stadt, klein }); aktuell.current = { units, stadt, klein }

  React.useEffect(() => {
    const m = L.map(box.current!, {
      zoomControl: !klein, attributionControl: true, zoomSnap: 0.25, minZoom: 8, maxZoom: 18,
      dragging: !klein, scrollWheelZoom: !klein, doubleClickZoom: !klein, touchZoom: !klein, boxZoom: !klein, keyboard: !klein,
    })
    m.attributionControl.setPrefix(false)
    map.current = m
    flaechen.current = L.layerGroup().addTo(m)
    namen.current = L.layerGroup().addTo(m)
    m.createPane("pins").style.zIndex = "450"
    pins.current = L.layerGroup().addTo(m)
    if (KACHELN !== "aus") {
      const t = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
      })
      let geladen = false
      t.on("tileload", () => { if (!geladen) { geladen = true; setzeKacheln("ok") } })
      t.on("tileerror", () => { if (!geladen) { setzeKacheln("aus"); m.removeLayer(t); kachel.current = null } })
      t.addTo(m); kachel.current = t
    }
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(box.current!)
    m.on("zoomend", () => zeichneNamen())
    return () => { ro.disconnect(); m.remove(); map.current = null }
  }, [])

  React.useEffect(() => {
    const t = kachel.current; if (!t) return
    t.setUrl(`https://{s}.basemaps.cartocdn.com/${dunkel ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`)
  }, [dunkel])

  function zeichneNamen() {
    const m = map.current, g = namen.current; if (!m || !g) return
    const { units, stadt, klein } = aktuell.current
    g.clearLayers()
    const z = m.getZoom()
    if (klein) return
    if (stadt === "kiel") {
      if (z < 10.5) return
      Object.entries(K.KIEL as Record<string, number[]>).forEach(([n, p]) => g.addLayer(L.marker([p[0], p[1]], { interactive: false, keyboard: false,
        icon: L.divIcon({ className: "lumio-label", html: `<span>${n.replace("Kiel-", "")}</span>`, iconSize: [0, 0] }) })))
      return
    }
    if (z < 12.5) return
    units.forEach((u: any) => {
      g.addLayer(L.marker(labelPunkt(u), { interactive: false, keyboard: false,
        icon: L.divIcon({ className: "lumio-label", html: `<span>${u.name}</span>`, iconSize: [0, 0] }) }))
    })
  }

  React.useEffect(() => {
    const m = map.current, g = flaechen.current; if (!m || !g) return
    const P = dunkel ? PALETTE.dunkel : PALETTE.hell
    const ohneKarte = kacheln !== "ok"
    m.getContainer().style.background = ohneKarte ? P.bg : dunkel ? "#0e0e0e" : "#f2f2f0"
    g.clearLayers()
    if (ohneKarte) {
      K.KONTEXT.forEach((c: any) => g.addLayer(L.polygon(c.g, { color: P.ctxRand, weight: 0.8, fillColor: P.ctx, fillOpacity: 1, interactive: false })))
      K.UNITS.filter((u: any) => u.stadt !== stadt).forEach((u: any) => g.addLayer(L.polygon(u.g, { color: P.ctxRand, weight: 0.6, fillColor: P.ctx, fillOpacity: 1, interactive: false })))
    }
    units.forEach((u: any) => {
      const hv = K.besitzer(u), f = K.farbe(hv)
      const gedimmt = !!hervorheben && hv !== hervorheben
      const gewaehlt = auswahl === u.id
      const st: L.PathOptions = ohneKarte
        ? { fillColor: f ? mix(f, P.frei, gedimmt ? 0.1 : 0.3) : P.frei, fillOpacity: 1, color: f && !gedimmt ? mix(f, P.frei, 0.55) : P.rand, weight: 0.8 }
        : { fillColor: f || "#000", fillOpacity: f ? (gedimmt ? 0.06 : 0.2) : 0, color: f && !gedimmt ? f : "#8b93a3", weight: f ? 1 : 0.7, opacity: f && !gedimmt ? 0.6 : 0.5, dashArray: f ? undefined : "3 3" }
      if (gewaehlt) Object.assign(st, { color: P.ink, weight: 2.5, opacity: 1, dashArray: undefined })
      const poly = L.polygon(u.g, { ...st, interactive: !klein, bubblingMouseEvents: false })
      if (!klein) {
        poly.bindTooltip(`<b>${u.name}</b><br>${hv ? M.person(hv).voll : "frei, noch kein Vertriebler"}`, { sticky: true, direction: "top", className: "lumio-tip" })
        poly.on("click", () => cb.current.onUnit?.(u.id))
      }
      g.addLayer(poly)
      if (gewaehlt) poly.bringToFront()
    })
    zeichneNamen()
  }, [units, auswahl, hervorheben, dunkel, kacheln, version, klein])

  React.useEffect(() => {
    const g = pins.current; if (!g) return
    g.clearLayers()
    const sortiert = leads.slice().sort((a, b) => (a.stufe === "gewonnen" ? 0 : 1) - (b.stufe === "gewonnen" ? 0 : 1))
    sortiert.forEach((l) => {
      if (!l.geo) return
      const gew = l.stufe === "gewonnen"
      const c = L.circleMarker([l.geo.lat, l.geo.lng], {
        radius: klein ? 4 : gew ? 4 : 6.5, color: dunkel ? "#0a0f1c" : "#ffffff", weight: gew ? 1 : 2, fillColor: pinFarbe(l, dunkel), fillOpacity: gew ? 0.85 : 1,
        interactive: !klein, bubblingMouseEvents: false, pane: "pins",
      })
      if (!klein) {
        c.bindTooltip(`<b>${l.name}</b><br>${M.stufeVon(l).name} · ${M.person(l.betreuer)?.name ?? ""}`, { direction: "top", offset: [0, -6], className: "lumio-tip" })
        c.on("click", () => cb.current.onLead?.(l.id))
      }
      g.addLayer(c)
    })
    ;(objekte || []).forEach((o) => {
      const c = L.circleMarker([o.geo.lat, o.geo.lng], { radius: o.radius || 7, color: dunkel ? "#0a0f1c" : "#ffffff", weight: 2, fillColor: o.farbe, fillOpacity: 1, pane: "pins", interactive: !klein, bubblingMouseEvents: false })
      if (!klein) { c.bindTooltip(o.titel, { direction: "top", offset: [0, -6], className: "lumio-tip" }); c.on("click", () => cb.current.onObjekt?.(o.id)) }
      g.addLayer(c)
    })
    if (punkt) {
      if (punkt.genau) g.addLayer(L.circle([punkt.lat, punkt.lng], { pane: "pins", radius: punkt.genau, color: "#4d6cf0", weight: 1, fillColor: "#4d6cf0", fillOpacity: 0.12, interactive: false }))
      g.addLayer(L.circleMarker([punkt.lat, punkt.lng], { pane: "pins", radius: 9, color: "#ffffff", weight: 3, fillColor: "#4d6cf0", fillOpacity: 1, interactive: false }))
    }
  }, [leads, objekte, punkt?.lat, punkt?.lng, punkt?.genau, dunkel, version, klein])

  // Ausschnitt: Punkt > Fokus > Gebiet des Vertrieblers > ganze Stadt
  React.useEffect(() => {
    const m = map.current; if (!m) return
    if (punkt) { m.setView([punkt.lat, punkt.lng], klein ? 15 : 16); return }
    if (fokus) { m.setView([fokus.lat, fokus.lng], 15); return }
    if (objekte && objekte.length) {
      const bo = L.latLngBounds(objekte.map((o) => [o.geo.lat, o.geo.lng] as [number, number]))
      m.fitBounds(bo.pad(0.15), { maxZoom: 16 }); return
    }
    const eigene = hervorheben ? units.filter((u: any) => K.besitzer(u) === hervorheben) : []
    const basis = eigene.length ? eigene : units
    if (!basis.length) return
    const b = L.latLngBounds([])
    basis.forEach((u: any) => { b.extend([u.bbox[0], u.bbox[1]]); b.extend([u.bbox[2], u.bbox[3]]) })
    m.fitBounds(b, { padding: [16, 16] })
  }, [stadt, hervorheben, punkt?.lat, punkt?.lng, fokus?.lat, fokus?.lng, objekte ? objekte.length : -1])

  return <div ref={box} className={cn("isolate z-0 overflow-hidden", className)} role="application" aria-label={"Karte " + (K.STAEDTE.find((s: any) => s.id === stadt)?.name ?? "")} />
}
