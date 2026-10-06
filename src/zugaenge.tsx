import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PersonAvatar } from "@/bits"
import { bump, useUI } from "@/store"
import { zugang } from "@/daten/echt"
import * as K from "@/model/karte.js"
import * as M from "@/model/model.js"
import { toast } from "sonner"
import { Copy, KeyRound, Loader2, MoreHorizontal, UserPlus, UserX, UserCheck } from "lucide-react"

const ROLLEN = [["setter", "Setter (Telefon)"], ["hv", "Handelsvertreter (draußen)"], ["closer", "Closer"], ["gf", "Geschäftsführung"]]
const FARBEN = ["#3b5bdb", "#0ca678", "#e8590c", "#c2255c", "#7048e8", "#1098ad", "#f59f00", "#5c940d"]
const rolleText = (p: any) => p.dbRolle === "closer" ? "Closer" : ({ gf: "Geschäftsführung", setter: "Setter", hv: "Handelsvertreter" } as any)[p.rolle]

/* Zugänge der Mitarbeiter (nur Geschäftsführung) */
export function Zugaenge() {
  const ui = useUI()
  const [neu, setNeu] = React.useState(false)
  const [ergebnis, setErgebnis] = React.useState<{ name: string; email: string; passwort: string } | null>(null)
  const nichtDemo = () => { if (!ui.echt) { toast("In der Demo werden keine echten Zugänge angelegt."); return false } return true }

  async function passwort(p: any) {
    if (!nichtDemo()) return
    try { const r = await zugang({ aktion: "passwort", id: p.id }); setErgebnis({ name: p.voll, email: p.email, passwort: r.passwort }) } catch (e: any) { toast(e.message) }
  }
  async function aktiv(p: any, a: boolean) {
    if (!nichtDemo()) return
    try { await zugang({ aktion: "aktiv", id: p.id, aktiv: a }); p.aktiv = a; bump(); toast(a ? p.voll + " ist wieder freigeschaltet" : p.voll + " ist gesperrt und kann sich nicht mehr anmelden") } catch (e: any) { toast(e.message) }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1.5"><CardTitle>Zugänge</CardTitle><CardDescription>Wer sich anmelden darf und mit welcher Rolle.</CardDescription></div>
        <Button size="sm" onClick={() => nichtDemo() && setNeu(true)}><UserPlus />Zugang anlegen</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Person</TableHead><TableHead className="hidden sm:table-cell">Rolle</TableHead><TableHead className="hidden md:table-cell">E-Mail</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
          <TableBody>
            {M.PERSONEN.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell><div className="flex items-center gap-2"><PersonAvatar id={p.id} /><div><div className="font-medium">{p.voll}</div><div className="text-xs text-muted-foreground sm:hidden">{rolleText(p)}</div></div></div></TableCell>
                <TableCell className="hidden sm:table-cell">{rolleText(p)}{p.gebiet ? <span className="text-muted-foreground"> · {p.gebiet}</span> : null}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{p.email || "—"}</TableCell>
                <TableCell>{p.aktiv === false ? <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">gesperrt</Badge> : <Badge variant="outline" className="border-transparent bg-ok/15 text-ok">aktiv</Badge>}</TableCell>
                <TableCell>
                  {p.id !== ui.ich && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={"Aktionen für " + p.voll}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => passwort(p)}><KeyRound />Neues Startpasswort</DropdownMenuItem>
                        {p.aktiv === false
                          ? <DropdownMenuItem onClick={() => aktiv(p, true)}><UserCheck />Wieder freischalten</DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => aktiv(p, false)} className="text-destructive"><UserX />Zugang sperren</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <NeuDialog offen={neu} onClose={() => setNeu(false)} onFertig={(r) => { setNeu(false); setErgebnis(r) }} />
      <Dialog open={!!ergebnis} onOpenChange={(o) => !o && setErgebnis(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Zugang für {ergebnis?.name}</DialogTitle><DialogDescription>Das Passwort wird nur jetzt angezeigt. Beim ersten Anmelden legt {ergebnis?.name.split(" ")[0]} ein eigenes fest.</DialogDescription></DialogHeader>
          {ergebnis && (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
              <div><span className="text-muted-foreground">App: </span>{location.origin + location.pathname}</div>
              <div><span className="text-muted-foreground">E-Mail: </span>{ergebnis.email}</div>
              <div><span className="text-muted-foreground">Startpasswort: </span><b>{ergebnis.passwort}</b></div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={async () => {
              if (!ergebnis) return
              const t = `Dein Zugang zur LUMIO Vertriebszentrale:\n${location.origin + location.pathname}\nE-Mail: ${ergebnis.email}\nStartpasswort: ${ergebnis.passwort}\nBeim ersten Anmelden legst du ein eigenes Passwort fest. Auf dem iPhone in Safari öffnen, Teilen → Zum Home-Bildschirm.`
              try { await navigator.clipboard.writeText(t); toast("Kopiert. Am besten per WhatsApp oder SMS schicken, nicht per E-Mail.") } catch (e) { toast("Kopieren ging nicht. Bitte abschreiben.") }
            }}><Copy />Text zum Weiterschicken kopieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function NeuDialog({ offen, onClose, onFertig }: { offen: boolean; onClose: () => void; onFertig: (r: { name: string; email: string; passwort: string }) => void }) {
  const [w, setW] = React.useState({ name: "", email: "", rolle: "setter", stadt: "hamburg", gebiet: "", farbe: FARBEN[M.PERSONEN.length % FARBEN.length] })
  const [laeuft, setLaeuft] = React.useState(false)
  const [fehler, setFehler] = React.useState<string | null>(null)
  React.useEffect(() => { if (offen) { setFehler(null); setW({ name: "", email: "", rolle: "setter", stadt: "hamburg", gebiet: "", farbe: FARBEN[M.PERSONEN.length % FARBEN.length] }) } }, [offen])
  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Zugang anlegen</DialogTitle><DialogDescription>Du bekommst danach ein Startpasswort, das du weitergibst.</DialogDescription></DialogHeader>
        <form className="grid gap-3" onSubmit={async (e) => {
          e.preventDefault(); setLaeuft(true); setFehler(null)
          try {
            const r = await zugang({ aktion: "anlegen", ...w })
            const kurz = w.name.trim().split(/\s+/).map((t) => t[0]).join("").slice(0, 2).toUpperCase()
            ;(M.PERSONEN as any[]).push({ id: r.id, name: w.name.trim().split(" ")[0], voll: w.name.trim(), rolle: w.rolle === "closer" ? "setter" : w.rolle, dbRolle: w.rolle === "hv" ? "handelsvertreter" : w.rolle,
              kurz, farbe: w.farbe, stadt: w.stadt, gebiet: w.gebiet, email: r.email, aktiv: true, seit: M.HEUTE })
            bump(); onFertig({ name: w.name.trim(), email: r.email, passwort: r.passwort })
          } catch (x: any) { setFehler(x.message) } finally { setLaeuft(false) }
        }}>
          <div className="grid gap-1.5"><Label htmlFor="zn" className="text-xs text-muted-foreground">Vor- und Nachname</Label><Input id="zn" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} required /></div>
          <div className="grid gap-1.5"><Label htmlFor="ze" className="text-xs text-muted-foreground">E-Mail (zum Anmelden)</Label><Input id="ze" type="email" value={w.email} onChange={(e) => setW({ ...w, email: e.target.value })} required /></div>
          <div className="grid gap-1.5"><Label htmlFor="zr" className="text-xs text-muted-foreground">Rolle</Label>
            <NativeSelect id="zr" value={w.rolle} onChange={(e) => setW({ ...w, rolle: e.target.value })}>{ROLLEN.map(([v, t]) => <NativeSelectOption key={v} value={v}>{t}</NativeSelectOption>)}</NativeSelect></div>
          {w.rolle === "hv" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label htmlFor="zs" className="text-xs text-muted-foreground">Stadt</Label>
                <NativeSelect id="zs" value={w.stadt} onChange={(e) => setW({ ...w, stadt: e.target.value })}>{K.STAEDTE.map((s: any) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}</NativeSelect></div>
              <div className="grid gap-1.5"><Label htmlFor="zg" className="text-xs text-muted-foreground">Gebiet (Name)</Label><Input id="zg" value={w.gebiet} onChange={(e) => setW({ ...w, gebiet: e.target.value })} placeholder="z. B. Hamburg Nord" /></div>
            </div>
          )}
          <div className="grid gap-1.5"><span className="text-xs text-muted-foreground">Farbe auf der Karte</span>
            <div className="flex gap-2">{FARBEN.map((f) => <button key={f} type="button" onClick={() => setW({ ...w, farbe: f })} aria-label={"Farbe " + f} className={"size-7 rounded-full ring-offset-2 ring-offset-background " + (w.farbe === f ? "ring-2 ring-foreground" : "")} style={{ background: f }} />)}</div></div>
          {fehler && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
          <DialogFooter><Button type="submit" disabled={laeuft}>{laeuft && <Loader2 className="animate-spin" />}Anlegen</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
