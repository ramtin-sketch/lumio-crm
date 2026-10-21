import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { neuZeichnen, useUI } from "@/store"
import { inPapierkorb, PAPIERKORB_TAGE } from "@/daten/papierkorb"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"

/* Rückfrage vor dem Verschieben in den Papierkorb (ein oder mehrere Leads) */
export function PapierkorbDialog({ leads, offen, onOffen, onFertig }: { leads: any[]; offen: boolean; onOffen: (o: boolean) => void; onFertig?: () => void }) {
  const ui = useUI()
  const [laeuft, setLaeuft] = React.useState(false)
  const n = leads.length
  const gewonnen = leads.filter((l) => l.stufe === "gewonnen" || l.abschluss).length
  const los = async () => {
    setLaeuft(true)
    try {
      const weg = await inPapierkorb(leads.map((l) => l.id), ui.ich)
      if (leads.some((l) => l.id === ui.detail)) ui.oeffne(null)
      neuZeichnen(); onOffen(false); onFertig?.()
      toast(weg === 1 ? "1 Eintrag liegt im Papierkorb" : `${weg} Einträge liegen im Papierkorb`, {
        action: { label: "Zum Papierkorb", onClick: () => ui.geheZu("papierkorb") },
      })
    } catch (e: any) { toast(e.message || String(e)) } finally { setLaeuft(false) }
  }
  return (
    <Dialog open={offen} onOpenChange={(o) => !laeuft && onOffen(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{n === 1 ? `„${leads[0]?.name}“ in den Papierkorb?` : `${n} Einträge in den Papierkorb?`}</DialogTitle>
          <DialogDescription>
            Mit Ansprechpartnern, Verlauf und Terminen. Für alle sofort unsichtbar, {PAPIERKORB_TAGE} Tage lang im Papierkorb wiederherstellbar, danach endgültig gelöscht.
          </DialogDescription>
        </DialogHeader>
        {n > 1 && (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {leads.slice(0, 50).map((l) => <li key={l.id} className="truncate">{l.name}{l.ort ? <span className="text-muted-foreground"> · {l.ort}</span> : null}</li>)}
            {n > 50 && <li className="text-muted-foreground">und {n - 50} weitere</li>}
          </ul>
        )}
        {gewonnen > 0 && <p className="rounded-md bg-warn/15 px-3 py-2 text-sm text-warn">{gewonnen === 1 ? "Ein Eintrag ist gewonnen." : `${gewonnen} Einträge sind gewonnen.`} Umsatz und Provision dazu verschwinden dann auch aus den Auswertungen.</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOffen(false)} disabled={laeuft}>Abbrechen</Button>
          <Button variant="destructive" onClick={los} disabled={laeuft || n === 0}>{laeuft ? <Loader2 className="animate-spin" /> : <Trash2 />}In den Papierkorb</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
