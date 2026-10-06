import * as React from "react"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { useUI, type Ansicht } from "@/store"
import * as M from "@/model/model.js"
import { ArrowRightLeft, Building2, DoorOpen, GraduationCap, Map as MapIcon, CalendarCheck, LayoutDashboard, MapPin, Megaphone, Phone, Users, Wallet } from "lucide-react"

export function Suche() {
  const ui = useUI()
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ui.setSuche(!ui.suche) } }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [ui.suche])
  const leads = M.LEADS.filter((l: any) => ui.istGF || l.betreuer === ui.ich)
  const offen = leads.filter(M.istOffen)
  const seiten: [Ansicht, string, any][] = ui.istGF
    ? [["heute", "Heute", CalendarCheck], ["dashboard", "Dashboard", LayoutDashboard], ["werbung", "Werbemandate", Megaphone], ["bildung", "Weiterbildung", GraduationCap], ["standort", "Standortakquise", MapPin], ["karte", "Karte", MapIcon], ["d2d", "Door-to-Door", DoorOpen], ["anrufen", "Anrufen", Phone], ["uebergaben", "Übergaben", ArrowRightLeft], ["mandate", "Mandate", Building2], ["team", "Team & Provisionen", Users]]
    : M.person(ui.ich).rolle === "setter"
    ? [["heute", "Heute", CalendarCheck], ["anrufen", "Anrufen", Phone], ["termine", "Meine Termine", ArrowRightLeft]]
    : [["heute", "Heute", CalendarCheck], ["karte", "Mein Gebiet", MapIcon], ["standort", "Meine Standorte", MapPin], ["verdienst", "Mein Verdienst", Wallet]]
  const geh = (fn: () => void) => { ui.setSuche(false); fn() }
  return (
    <CommandDialog open={ui.suche} onOpenChange={ui.setSuche} title="Suchen" description="Leads, Ansprechpartner und Seiten">
      <CommandInput placeholder="Firma, Ort, Ansprechpartner oder Seite …" />
      <CommandList>
        <CommandEmpty>Nichts gefunden.</CommandEmpty>
        <CommandGroup heading="Seiten">
          {seiten.map(([id, t, I]) => <CommandItem key={id} value={"seite " + t} onSelect={() => geh(() => ui.geheZu(id))}><I />{t}</CommandItem>)}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Offene Leads">
          {offen.map((l: any) => (
            <CommandItem key={l.id} value={`${l.name} ${l.ort} ${M.mandat(l.mandat).name} ${l.kontakte.map((k: any) => k.name).join(" ")} #${l.id}`} onSelect={() => geh(() => ui.oeffne(l.id))}>
              {l.bereich === "werbung" ? <Megaphone /> : l.bereich === "bildung" ? <GraduationCap /> : <MapPin />}
              <span className="truncate">{l.name}</span><span className="ml-auto truncate text-xs text-muted-foreground">{l.ort} · {M.mandat(l.mandat).name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
