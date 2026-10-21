import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BereichBadge, Seitenkopf } from "@/bits"
import { neuZeichnen, useUI } from "@/store"
import { endgueltigLoeschen, papierkorb, PAPIERKORB_TAGE, wiederherstellen, type PapierkorbEintrag } from "@/daten/papierkorb"
import { toast } from "sonner"
import { Loader2, RotateCcw, RefreshCw, Trash2, X } from "lucide-react"

const datum = (z: string) => new Date(z).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
const zeit = (z: string) => new Date(z).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
const restTage = (z: string) => Math.max(0, Math.ceil((new Date(z).getTime() - Date.now()) / 86400000))

export function Papierkorb() {
  const ui = useUI()
  const [liste, setListe] = React.useState<PapierkorbEintrag[] | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [auswahl, setAuswahl] = React.useState<Set<string>>(() => new Set())
  const [laeuft, setLaeuft] = React.useState(false)
  const [frage, setFrage] = React.useState(false)

  const laden = React.useCallback(() => {
    setFehler(null)
    papierkorb().then((l) => { setListe(l); setAuswahl((a) => new Set([...a].filter((id) => l.some((x) => x.id === id)))) }).catch((e) => setFehler(e.message || String(e)))
  }, [])
  React.useEffect(() => { laden() }, [laden])

  if (!ui.istGF) return <p className="py-10 text-center text-sm text-muted-foreground">Den Papierkorb sieht nur die Geschäftsführung.</p>

  const gewaehlt = (liste || []).filter((e) => auswahl.has(e.id))
  const alle = !!liste?.length && liste.every((e) => auswahl.has(e.id))
  const umschalten = (id: string, an: boolean) => setAuswahl((a) => { const n = new Set(a); if (an) n.add(id); else n.delete(id); return n })

  const zurueck = async (ids: string[]) => {
    setLaeuft(true)
    try {
      const n = await wiederherstellen(ids)
      neuZeichnen(); setAuswahl(new Set()); laden()
      toast(n === 1 ? "1 Eintrag ist wieder da" : `${n} Einträge sind wieder da`)
    } catch (e: any) { toast(e.message || String(e)) } finally { setLaeuft(false) }
  }
  const weg = async () => {
    setLaeuft(true)
    try {
      const n = await endgueltigLoeschen(gewaehlt.map((e) => e.id))
      setFrage(false); setAuswahl(new Set()); laden()
      toast(n === 1 ? "1 Eintrag endgültig gelöscht" : `${n} Einträge endgültig gelöscht`)
    } catch (e: any) { toast(e.message || String(e)) } finally { setLaeuft(false) }
  }

  return (
    <>
      <Seitenkopf titel="Papierkorb" text={`Gelöschte Leads mit Ansprechpartnern, Verlauf und Terminen. Nach ${PAPIERKORB_TAGE} Tagen werden sie endgültig gelöscht.`}>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={laden}><RefreshCw />Aktualisieren</Button>
      </Seitenkopf>

      {gewaehlt.length > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
          <span className="text-sm font-medium tabular">{gewaehlt.length} ausgewählt</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAuswahl(new Set())}><X />Aufheben</Button>
            <Button size="sm" variant="outline" disabled={laeuft} onClick={() => zurueck(gewaehlt.map((e) => e.id))}><RotateCcw />Wiederherstellen</Button>
            <Button size="sm" variant="destructive" disabled={laeuft} onClick={() => setFrage(true)}><Trash2 />Endgültig löschen</Button>
          </div>
        </div>
      )}

      <Card className="py-0">
        {fehler ? <p className="px-4 py-10 text-center text-sm text-destructive">{fehler}</p>
          : !liste ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10 pl-4"><Checkbox checked={alle} disabled={!liste.length} onCheckedChange={(v) => setAuswahl(v ? new Set(liste.map((e) => e.id)) : new Set())} aria-label="Alle auswählen" /></TableHead>
                <TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Mandat</TableHead>
                <TableHead className="hidden sm:table-cell">Gelöscht</TableHead><TableHead>Endgültig weg</TableHead><TableHead className="pr-4 text-right"><span className="sr-only">Aktion</span></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {liste.map((e) => (
                  <TableRow key={e.id} data-state={auswahl.has(e.id) ? "selected" : undefined}>
                    <TableCell className="w-10 pl-4"><Checkbox checked={auswahl.has(e.id)} onCheckedChange={(v) => umschalten(e.id, !!v)} aria-label={e.name + " auswählen"} /></TableCell>
                    <TableCell><div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{[e.ort, e.kontakte ? (e.kontakte === 1 ? "1 Ansprechpartner" : e.kontakte + " Ansprechpartner") : null].filter(Boolean).join(" · ")}</div></TableCell>
                    <TableCell className="hidden md:table-cell"><div className="flex items-center gap-2"><BereichBadge b={e.bereich} /><span className="truncate">{e.mandat}</span></div></TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">{zeit(e.geloescht_am)}<div className="text-xs text-muted-foreground">{e.geloescht_von || "—"}</div></TableCell>
                    <TableCell className="text-sm tabular">{datum(e.endgueltig_am)}<div className="text-xs text-muted-foreground">in {restTage(e.endgueltig_am)} Tagen</div></TableCell>
                    <TableCell className="pr-4 text-right"><Button size="sm" variant="ghost" disabled={laeuft} onClick={() => zurueck([e.id])}><RotateCcw /><span className="hidden sm:inline">Wiederherstellen</span></Button></TableCell>
                  </TableRow>
                ))}
                {liste.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Der Papierkorb ist leer.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
      </Card>

      <Dialog open={frage} onOpenChange={(o) => !laeuft && setFrage(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{gewaehlt.length === 1 ? `„${gewaehlt[0]?.name}“ endgültig löschen?` : `${gewaehlt.length} Einträge endgültig löschen?`}</DialogTitle>
            <DialogDescription>Das lässt sich nicht rückgängig machen. Lead, Ansprechpartner, Verlauf, Termine und Abschluss sind danach weg.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFrage(false)} disabled={laeuft}>Abbrechen</Button>
            <Button variant="destructive" onClick={weg} disabled={laeuft}>{laeuft ? <Loader2 className="animate-spin" /> : <Trash2 />}Endgültig löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
