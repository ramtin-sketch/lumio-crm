import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { passwortAendern } from "@/daten/echt"
import { Loader2 } from "lucide-react"

export function PasswortFormular({ pflicht, onFertig }: { pflicht?: boolean; onFertig: () => void }) {
  const [a, setA] = React.useState("")
  const [b, setB] = React.useState("")
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [laeuft, setLaeuft] = React.useState(false)
  return (
    <form className="grid gap-4" onSubmit={async (e) => {
      e.preventDefault(); setFehler(null)
      if (a.length < 8) return setFehler("Mindestens 8 Zeichen.")
      if (a !== b) return setFehler("Die beiden Passwörter sind nicht gleich.")
      setLaeuft(true)
      try { await passwortAendern(a); onFertig() } catch (x: any) { setFehler(x.message) } finally { setLaeuft(false) }
    }}>
      {pflicht && <p className="text-sm text-muted-foreground">Du hast ein Startpasswort bekommen. Bitte leg jetzt dein eigenes fest.</p>}
      <div className="grid gap-1.5"><Label htmlFor="p1">Neues Passwort</Label><Input id="p1" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} required /></div>
      <div className="grid gap-1.5"><Label htmlFor="p2">Noch einmal</Label><Input id="p2" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} required /></div>
      {fehler && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
      <Button type="submit" disabled={laeuft}>{laeuft && <Loader2 className="animate-spin" />}Passwort speichern</Button>
    </form>
  )
}

