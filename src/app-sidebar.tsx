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
import { abmelden } from "@/daten/echt"
import { PasswortFormular } from "@/passwort"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  ArrowRightLeft, Building2, DoorOpen, FileSpreadsheet, GraduationCap, KeyRound, LogOut, Map as MapIcon, ShieldCheck, CalendarCheck, ChevronsUpDown, LayoutDashboard, MapPin, Megaphone, Moon, Phone, Sun, Users, Wallet, Check,
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
          { id: "datenschutz", titel: "Datenschutz", icon: ShieldCheck },
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
  const gehe = (a: Ansicht) => { ui.geheZu(a); if (isMobile) setOpenMobile(false) }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#0E1523] text-white dark:ring-1 dark:ring-white/15">
                <svg viewBox="0 0 512 512" className="size-5" aria-hidden="true"><path d="M170 128h66v192h118v64H170z" fill="currentColor" /><circle cx="350" cy="168" r="38" fill="#4D6CF0" /></svg>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-wide">LUMIO</span>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => abmelden()}><LogOut />Abmelden</DropdownMenuItem>
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
    </Sidebar>
  )
}
