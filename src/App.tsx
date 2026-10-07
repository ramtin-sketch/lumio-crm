import { MandatAkte } from "@/mandat-akte"
import * as React from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Kbd } from "@/components/ui/kbd"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from "@/app-sidebar"
import { UIProvider, useUI } from "@/store"
import * as M from "@/model/model.js"
import { Heute } from "@/views/heute"
import { Dashboard } from "@/views/dashboard"
import { Brett } from "@/views/brett"
import { Anrufen } from "@/views/anrufen"
import { Mandate } from "@/views/mandate"
import { Team } from "@/views/team"
import { Verdienst } from "@/views/verdienst"
import { Uebergaben, MeineTermine } from "@/views/uebergaben"
import { Karte } from "@/views/karte"
import { D2D } from "@/views/d2d"
import { ErfassenSheet } from "@/erfassen"
import { LeadSheet } from "@/lead-sheet"
import { NeuSheet } from "@/neu-sheet"
import { Suche } from "@/suche"
import { Cloud, CloudOff, Loader2, LocateFixed, Plus, Search } from "lucide-react"
import { aufStatus, syncStatus, liveStand } from "@/daten/echt"
import { Datenschutz } from "@/views/datenschutz"
import { ImportExport } from "@/views/import"
import { Kalender } from "@/views/kalender"

const TITEL: Record<string, string> = {
  heute: "Heute", dashboard: "Dashboard", werbung: "Werbemandate", bildung: "Weiterbildung", standort: "Standortakquise", karte: "Karte",
  anrufen: "Anrufen", mandate: "Mandate", team: "Team & Provisionen", verdienst: "Mein Verdienst",
  uebergaben: "Übergaben", termine: "Meine Termine", datenschutz: "Datenschutz & Sicherheit", d2d: "Door-to-Door", import: "Import & Export", kalender: "Kalender",
}

function SyncAnzeige() {
  const [, set] = React.useState(0)
  React.useEffect(() => aufStatus(() => set((n) => n + 1)), [])
  const s = syncStatus()
  const live = liveStand()
  if (s.zustand === "fehler") return <Badge variant="outline" className="max-w-[50vw] truncate border-transparent bg-destructive/10 text-destructive" title={s.fehler}><CloudOff />{s.fehler}</Badge>
  if (s.zustand === "speichert") return <Badge variant="outline" className="text-muted-foreground"><Loader2 className="animate-spin" /><span className="hidden sm:inline">Speichert …</span></Badge>
  if (live === "getrennt") return <Badge variant="outline" className="text-muted-foreground" title="Die Live-Verbindung ist kurz weg. Sobald sie wieder steht, wird nachgeladen."><span className="size-2 rounded-full bg-warn" aria-hidden="true" /><span className="hidden sm:inline">Nicht live</span></Badge>
  return <Badge variant="outline" className="hidden text-muted-foreground sm:inline-flex" title={live === "live" ? "Gespeichert. Änderungen der anderen erscheinen sofort." : "Gespeichert"}>
    {live === "live" ? <span className="relative flex size-2" aria-hidden="true"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-50 motion-reduce:hidden" /><span className="relative inline-flex size-2 rounded-full bg-ok" /></span> : <Cloud />}
    {live === "live" ? "Live · gespeichert" : "Gespeichert"}</Badge>
}

function Kopf() {
  const ui = useUI()
  const hv = M.person(ui.ich).rolle === "hv"
  const neu = () => ui.setNeu({ bereich: ui.istGF ? (ui.ansicht === "standort" || ui.ansicht === "karte" ? "standort" : ui.ansicht === "bildung" ? "bildung" : "werbung") : (M.person(ui.ich).rolle === "setter" ? "werbung" : "standort"), mandat: ui.mandatFilter !== "alle" ? ui.mandatFilter : undefined })
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:rounded-t-xl">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <h2 className="truncate text-sm font-medium">{ui.ansicht === "standort" && !ui.istGF ? "Meine Standorte" : ui.ansicht === "karte" && !ui.istGF ? "Mein Gebiet" : TITEL[ui.ansicht]}</h2>
      {ui.echt ? <SyncAnzeige /> : <Badge variant="outline" className="hidden text-muted-foreground sm:inline-flex">Demo · erfundene Daten</Badge>}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => ui.setSuche(true)}>
          <Search /><span className="hidden md:inline">Suchen</span><Kbd className="hidden md:inline-flex">⌘K</Kbd>
        </Button>
        {hv
          ? <Button size="sm" onClick={() => ui.setErfassen(true)}><LocateFixed /><span className="hidden sm:inline">Erfassen</span></Button>
          : <Button size="sm" onClick={neu}><Plus /><span className="hidden sm:inline">Neu</span></Button>}
      </div>
    </header>
  )
}

function Inhalt() {
  const ui = useUI()
  switch (ui.ansicht) {
    case "heute": return <Heute />
    case "dashboard": return <Dashboard />
    case "werbung": return <Brett bereich="werbung" />
    case "bildung": return <Brett bereich="bildung" />
    case "standort": return <Brett bereich="standort" />
    case "anrufen": return <Anrufen />
    case "mandate": return <Mandate />
    case "team": return <Team />
    case "verdienst": return <Verdienst />
    case "uebergaben": return <Uebergaben />
    case "termine": return <MeineTermine />
    case "karte": return <Karte />
    case "d2d": return <D2D />
    case "datenschutz": return <Datenschutz />
    case "kalender": return <Kalender />
    case "import": return <ImportExport />
  }
  return null
}

export default function App({ start }: { start?: string }) {
  return (
    <UIProvider start={start}>
      <TooltipProvider delayDuration={200}>
        <SidebarProvider style={{ "--sidebar-width": "15.5rem" } as React.CSSProperties}>
          <AppSidebar />
          <SidebarInset>
            <Kopf />
            <div id="inhalt" className="flex flex-1 flex-col gap-4 p-4 pb-16 md:gap-6 md:p-6"><Inhalt /></div>
          </SidebarInset>
          <LeadSheet />
          <NeuSheet />
          <ErfassenSheet />
          <Suche />
          <MandatAkte />
          <Toaster position="bottom-center" />
        </SidebarProvider>
      </TooltipProvider>
    </UIProvider>
  )
}
