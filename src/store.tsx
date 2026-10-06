import * as React from "react"
import * as M from "@/model/model.js"
import { ECHT, spaeterSpeichern } from "@/daten/echt"

/* Die Demo-Daten sind ein veränderbarer Speicher. Nach jeder Änderung "bump()" aufrufen. */
let version = 0
const abos = new Set<() => void>()
export function bump() { version++; abos.forEach((f) => f()); spaeterSpeichern() }
export function neuZeichnen() { version++; abos.forEach((f) => f()) }
export function useDaten() {
  return React.useSyncExternalStore((cb) => { abos.add(cb); return () => abos.delete(cb) }, () => version)
}

export type Ansicht = "heute" | "dashboard" | "werbung" | "standort" | "anrufen" | "mandate" | "team" | "verdienst" | "uebergaben" | "termine" | "bildung" | "karte" | "datenschutz" | "import" | "d2d"

type UI = {
  ich: string; setIch: (id: string) => void
  ansicht: Ansicht; geheZu: (a: Ansicht, opts?: { mandat?: string; hv?: string }) => void
  detail: number | null; oeffne: (id: number | null) => void
  neu: null | { bereich: string; mandat?: string }; setNeu: (n: any) => void
  suche: boolean; setSuche: (b: boolean) => void
  mandatFilter: string; setMandatFilter: (m: string) => void
  hvFilter: string; setHvFilter: (h: string) => void
  istGF: boolean
  echt: boolean
  erfassen: boolean; setErfassen: (b: boolean) => void
  kartenStadt: string; setKartenStadt: (s: string) => void
  kartenFokus: number | null; zeigeAufKarte: (leadId: number) => void
}
const Ctx = React.createContext<UI>(null as any)
export const useUI = () => React.useContext(Ctx)

export function UIProvider({ children, start }: { children: React.ReactNode; start?: string }) {
  const [ich, setIchRaw] = React.useState(start || "ramtin")
  const [ansicht, setAnsicht] = React.useState<Ansicht>("heute")
  const [detail, setDetail] = React.useState<number | null>(null)
  const [neu, setNeu] = React.useState<any>(null)
  const [suche, setSuche] = React.useState(false)
  const [mandatFilter, setMandatFilter] = React.useState("alle")
  const [hvFilter, setHvFilter] = React.useState("alle")
  const istGF = M.person(ich).rolle === "gf"
  const [erfassen, setErfassen] = React.useState(false)
  const [kartenStadt, setKartenStadt] = React.useState(() => M.person(start || "ramtin")?.stadt || "hamburg")
  const [kartenFokus, setKartenFokus] = React.useState<number | null>(null)

  const setIch = (id: string) => {
    setIchRaw(id); setAnsicht("heute"); setErfassen(false); setKartenFokus(null); setKartenStadt(M.person(id).stadt || "hamburg"); setDetail(null); setNeu(null); setMandatFilter("alle"); setHvFilter("alle")
  }
  const geheZu = (a: Ansicht, opts?: { mandat?: string; hv?: string }) => {
    setAnsicht(a); setDetail(null); if (a !== "karte") setKartenFokus(null)
    setMandatFilter(opts?.mandat ?? "alle"); setHvFilter(opts?.hv ?? "alle")
    window.scrollTo(0, 0)
  }
  const wert: UI = { ich, setIch, ansicht, geheZu, detail, oeffne: setDetail, neu, setNeu, suche, setSuche,
    mandatFilter, setMandatFilter, hvFilter, setHvFilter, istGF, echt: ECHT,
    erfassen, setErfassen, kartenStadt, setKartenStadt, kartenFokus,
    zeigeAufKarte: (leadId: number) => {
      const l = M.LEADS.find((x: any) => x.id === leadId)
      if (l?.stadt) setKartenStadt(l.stadt)
      setAnsicht("karte"); setDetail(null); setKartenFokus(leadId); window.scrollTo(0, 0)
    } }
  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>
}
