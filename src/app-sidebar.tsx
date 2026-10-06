import * as React from "react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useUI, useDaten, type Ansicht } from "@/store"
import * as M from "@/model/model.js"
import * as D from "@/model/d2d.js"
import { abmelden, ueberallAbmelden, zweifaktorStand, hinweiseLaden } from "@/daten/echt"
import { ZweifaktorEinrichten } from "@/zweifaktor"
import { Button } from "@/components/ui/button"
import { PasswortFormular } from "@/passwort"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  ArrowRightLeft, Building2, DoorOpen, FileSpreadsheet, GraduationCap, KeyRound, LogOut, Smartphone, MonitorSmartphone, Loader2, CheckCircle2, Map as MapIcon, ShieldCheck, CalendarCheck, ChevronsUpDown, LayoutDashboard, MapPin, Megaphone, Moon, Phone, Sun, Users, Wallet, Check,
} from "lucide-react"

type Punkt = { id: Ansicht; titel: string; icon: any; zahl?: number }

export function AppSidebar() {
  useDaten()
  const ui = useUI()
  const { setOpenMobile, isMobile } = useSidebar()
  const ich = M.person(ui.ich)
  const meine = M.LEADS.filter((l: any) => l.betreuer === ui.ich)
  const faelligHeute = meine.filter((l: any) => M.faellig(l)).length
  const meineUebergaben = M.TERMINE.filter((t: any) => t.status === "geplant" && t.closer === ui.ich).length
  const neuTerminieren = M.LEADS.filter((l: any) => l.terminStatus === "noshow" && M.istOffen(l) && l.betreuer === ui.ich).length
  const anrufListe = M.LEADS.filter((l: any) => M.istTel(l) && M.istOffen(l) && (l.stufe === "recherche" || l.stufe === "setting") && l.betreuer === ui.ich && !M.istGesperrt(l)).length

  // Neue Warnungen (letzte 7 Tage, noch nicht angesehen) als Zahl am Menüpunkt
  const [warnungen, setWarnungen] = React.useState(0)
  React.useEffect(() => {
    if (!ui.echt || !ui.istGF) return
    const zaehlen = () => hinweiseLaden(7).then((h) => {
      let gesehen = 0; try { gesehen = Number(localStorage.getItem("lumio-hinweise-gesehen") || 0) } catch (e) {}
      setWarnungen(h.filter((x) => x.stufe === "warnung" && new Date(x.zeit).getTime() > gesehen).length)
    }).catch(() => {})
    zaehlen()
    window.addEventListener("lumio-hinweise-gesehen", zaehlen)
    const t = setInterval(zaehlen, 10 * 60000)
    return () => { window.removeEventListener("lumio-hinweise-gesehen", zaehlen); clearInterval(t) }
  }, [ui.echt, ui.istGF])

  const gruppen: { label: string; punkte: Punkt[] }[] = ui.istGF
    ? [
        { label: "Übersicht", punkte: [
          { id: "heute", titel: "Heute", icon: CalendarCheck, zahl: faelligHeute },
          { id: "dashboard", titel: "Dashboard", icon: LayoutDashboard },
        ] },
        { label: "Vertrieb", punkte: [
          { id: "werbung", titel: "Werbemandate", icon: Megaphone },
          { id: "bildung", titel: "Weiterbildung", icon: GraduationCap },
          { id: "standort", titel: "Standortakquise", icon: MapPin },
          { id: "karte", titel: "Karte", icon: MapIcon },
          { id: "d2d", titel: "Door-to-Door", icon: DoorOpen },
          { id: "anrufen", titel: "Anrufen", icon: Phone, zahl: anrufListe },
          { id: "uebergaben", titel: "Übergaben", icon: ArrowRightLeft, zahl: meineUebergaben },
        ] },
        { label: "Verwaltung", punkte: [
          { id: "mandate", titel: "Mandate", icon: Building2 },
          { id: "team", titel: "Team & Provisionen", icon: Users },
          { id: "import", titel: "Import & Export", icon: FileSpreadsheet },
          { id: "datenschutz", titel: "Datenschutz", icon: ShieldCheck, zahl: warnungen },
        ] },
      ]
    : ich.rolle === "setter" ? [
        { label: "Setting", punkte: [
          { id: "heute", titel: "Heute", icon: CalendarCheck, zahl: faelligHeute },
          { id: "anrufen", titel: "Anrufen", icon: Phone, zahl: anrufListe },
          { id: "termine", titel: "Meine Termine", icon: ArrowRightLeft, zahl: neuTerminieren },
        ] },
      ]
    : [
        { label: "Mein Bereich", punkte: [
          { id: "heute", titel: "Heute", icon: CalendarCheck, zahl: faelligHeute },
          { id: "karte", titel: "Mein Gebiet", icon: MapIcon },
          { id: "standort", titel: "Meine Standorte", icon: MapPin },
          ...(ich.d2d?.freigaben?.length || D.OBJEKTE.some((o: any) => o.betreuer === ui.ich) ? [{ id: "d2d" as Ansicht, titel: "Door-to-Door", icon: DoorOpen }] : []),
          { id: "verdienst", titel: "Mein Verdienst", icon: Wallet },
        ] },
      ]

  const [dunkel, setDunkel] = React.useState(() => document.documentElement.classList.contains("dark"))
  const umschalten = () => {
    const d = !dunkel
    document.documentElement.classList.toggle("dark", d)
    try { localStorage.setItem("lumio-theme", d ? "dark" : "light") } catch (e) {}
    setDunkel(d)
  }
  const [pwOffen, setPwOffen] = React.useState(false)
  const [zfOffen, setZfOffen] = React.useState(false)
  const [ueberallOffen, setUeberallOffen] = React.useState(false)
  const gehe = (a: Ansicht) => { ui.geheZu(a); if (isMobile) setOpenMobile(false) }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#2244CC] text-white">
                <svg viewBox="0 0 240 240" className="size-5" aria-hidden="true"><path d="M101 70H170V138M170 70L70 170" fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-[0.12em]">LUMIO GROUP</span>
                <span className="truncate text-xs text-muted-foreground">Vertriebszentrale</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {gruppen.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.punkte.map((p) => (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton isActive={ui.ansicht === p.id} tooltip={p.titel} onClick={() => gehe(p.id)}>
                      <p.icon />
                      <span>{p.titel}</span>
                    </SidebarMenuButton>
                    {!!p.zahl && <SidebarMenuBadge className="tabular">{p.zahl}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={dunkel ? "Helles Design" : "Dunkles Design"} onClick={umschalten}>
              {dunkel ? <Sun /> : <Moon />}<span>{dunkel ? "Helles Design" : "Dunkles Design"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Angemeldet als, Rolle wechseln">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">{ich.kurz}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{ich.voll}</span>
                    <span className="truncate text-xs text-muted-foreground">{ich.rolle === "gf" ? "Geschäftsführung" : ich.rolle === "setter" ? "Setter · Telefon" : "Handelsvertreter · " + ich.gebiet}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-60 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
                {ui.echt ? (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{ich.email}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setPwOffen(true)}><KeyRound />Passwort ändern</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setZfOffen(true)}><Smartphone />Zwei-Faktor-Anmeldung</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => abmelden()}><LogOut />Abmelden</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setUeberallOffen(true)}><MonitorSmartphone />Auf allen Geräten abmelden</DropdownMenuItem>
                  </>
                ) : (<>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Demo: Ansicht wechseln als</DropdownMenuLabel>
                {M.PERSONEN.map((p: any, i: number) => (
                  <React.Fragment key={p.id}>
                    {(i === 2 || i === 3) && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={() => { ui.setIch(p.id); if (isMobile) setOpenMobile(false) }} className="gap-2">
                      <Avatar className="size-6"><AvatarFallback className="text-[10px]">{p.kurz}</AvatarFallback></Avatar>
                      <div className="flex-1"><div>{p.voll}</div><div className="text-xs text-muted-foreground">{p.rolle === "gf" ? "Geschäftsführung" : p.rolle === "setter" ? "Setter" : "Handelsvertreter"}</div></div>
                      {p.id === ui.ich && <Check className="size-4" />}
                    </DropdownMenuItem>
                  </React.Fragment>
                ))}
                </>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <Dialog open={pwOffen} onOpenChange={setPwOffen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Passwort ändern</DialogTitle><DialogDescription>Mindestens 8 Zeichen.</DialogDescription></DialogHeader>
          <PasswortFormular onFertig={() => { setPwOffen(false); toast("Neues Passwort gespeichert") }} />
        </DialogContent>
      </Dialog>
      <Dialog open={zfOffen} onOpenChange={setZfOffen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Zwei-Faktor-Anmeldung</DialogTitle><DialogDescription>Beim Anmelden zusätzlich ein Code vom Handy. Ein geklautes Passwort allein reicht dann nicht mehr.</DialogDescription></DialogHeader>
          {zfOffen && <ZweifaktorVerwalten onFertig={() => setZfOffen(false)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={ueberallOffen} onOpenChange={setUeberallOffen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Auf allen Geräten abmelden?</DialogTitle><DialogDescription>Du wirst auf jedem Handy und Rechner abgemeldet, auch hier. Sinnvoll, wenn ein Gerät verloren gegangen ist.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setUeberallOffen(false)}>Abbrechen</Button>
            <Button onClick={async () => { try { await ueberallAbmelden() } catch (e: any) { toast(e.message) } }}><MonitorSmartphone />Überall abmelden</Button></div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}

function ZweifaktorVerwalten({ onFertig }: { onFertig: () => void }) {
  const [stand, setStand] = React.useState<{ faktoren: any[] } | null>(null)
  const [neu, setNeu] = React.useState(false)
  React.useEffect(() => { zweifaktorStand().then(setStand).catch((e) => { toast(e.message); setStand({ faktoren: [] }) }) }, [])
  if (!stand) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
  const fertig = () => { toast("Zwei-Faktor-Anmeldung ist eingerichtet"); onFertig() }
  if (!stand.faktoren.length || neu) return <ZweifaktorEinrichten ersetzen={neu} onFertig={fertig} />
  const f = stand.faktoren[0]
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-lg border p-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
        <div className="text-sm"><div className="font-medium">Ist eingerichtet</div><div className="text-muted-foreground">Seit {new Date(f.created_at).toLocaleDateString("de-DE")}. Beim Anmelden fragt die App nach dem Code.</div></div></div>
      <Button variant="outline" onClick={() => setNeu(true)}><Smartphone />Neues Handy einrichten</Button>
      <p className="text-xs text-muted-foreground">Das alte Handy funktioniert danach nicht mehr. Handy verloren und kein Zugang mehr? Die Geschäftsführung kann die Zwei-Faktor-Anmeldung unter Team → Zugänge zurücksetzen.</p>
    </div>
  )
}
