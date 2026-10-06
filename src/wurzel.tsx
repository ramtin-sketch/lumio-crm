import * as React from "react"
import App from "@/App"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ECHT, sb, laden, anmelden, abmelden, offeneAenderungen, syncStatus, zweifaktorStand, zweifaktorPflicht, aktivitaetMerken, zuLangeWeg, ABMELDEN_NACH_STUNDEN, liveStarten, liveStoppen } from "@/daten/echt"
import { ZweifaktorCode, ZweifaktorEinrichten } from "@/zweifaktor"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { neuZeichnen } from "@/store"
import * as M from "@/model/model.js"
import { Loader2 } from "lucide-react"
import { PasswortFormular } from "@/passwort"

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-[#0E1523] text-white dark:ring-1 dark:ring-white/15">
        <svg viewBox="0 0 512 512" className="size-6" aria-hidden="true"><path d="M170 128h66v192h118v64H170z" fill="currentColor" /><circle cx="350" cy="168" r="38" fill="#4D6CF0" /></svg>
      </div>
      <div className="leading-tight"><div className="font-semibold tracking-wide">LUMIO</div><div className="text-xs text-muted-foreground">Vertriebszentrale</div></div>
    </div>
  )
}
function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Logo />
      <div className="w-full max-w-sm">{children}</div>
      <Toaster position="bottom-center" />
    </div>
  )
}

function Anmelden() {
  const [email, setEmail] = React.useState("")
  const [pw, setPw] = React.useState("")
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [laeuft, setLaeuft] = React.useState(false)
  const [grund] = React.useState(() => { try { const g = sessionStorage.getItem(GRUND); sessionStorage.removeItem(GRUND); return !!g } catch (e) { return false } })
  return (
    <Rahmen>
      <Card>
        <CardHeader><CardTitle className="text-xl">Anmelden</CardTitle><CardDescription>Mit der E-Mail und dem Passwort, die du von der Geschäftsführung bekommen hast.</CardDescription></CardHeader>
        {grund && <p className="mx-6 -mt-2 mb-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">Zur Sicherheit abgemeldet, weil die App {ABMELDEN_NACH_STUNDEN} Stunden nicht benutzt wurde.</p>}
        <form onSubmit={async (e) => { e.preventDefault(); setLaeuft(true); setFehler(null); try { await anmelden(email, pw) } catch (x: any) { setFehler(x.message) } finally { setLaeuft(false) } }}>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="em">E-Mail</Label><Input id="em" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="grid gap-1.5"><Label htmlFor="pw">Passwort</Label><Input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
            {fehler && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-3">
            <Button type="submit" className="w-full" disabled={laeuft}>{laeuft && <Loader2 className="animate-spin" />}Anmelden</Button>
            <p className="text-center text-xs text-muted-foreground">Passwort vergessen? Kurz bei Ramtin oder Kevin melden, sie setzen es zurück.</p>
          </CardFooter>
        </form>
      </Card>
    </Rahmen>
  )
}

const GRUND = "lumio-abgemeldet"
const grundMerken = () => { try { sessionStorage.setItem(GRUND, "1") } catch (e) {} }

type Tor = "pruefe" | "code" | "einrichten" | "frei"

function Echt() {
  const [session, setSession] = React.useState<any>(undefined)
  const [tor, setTor] = React.useState<Tor>("pruefe")
  const [ich, setIch] = React.useState<string | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const geladenAm = React.useRef(0)

  React.useEffect(() => {
    sb.auth.getSession().then(({ data }: any) => {
      // Zu lange nicht benutzt: abmelden, bevor irgendetwas geladen wird
      if (data.session && zuLangeWeg()) { grundMerken(); abmelden(); setSession(null); return }
      if (data.session) aktivitaetMerken()
      setSession(data.session)
    })
    const { data } = sb.auth.onAuthStateChange((_e: string, s: any) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Nutzung merken; alle 5 Minuten prüfen, ob 12 Stunden nichts passiert ist
  React.useEffect(() => {
    if (!session) return
    let zuletzt = 0
    const merken = () => { if (Date.now() - zuletzt > 60000) { zuletzt = Date.now(); aktivitaetMerken() } }
    const pruefen = () => { if (zuLangeWeg()) { grundMerken(); abmelden() } }
    const sichtbar = () => { if (document.visibilityState === "visible") pruefen() }
    window.addEventListener("pointerdown", merken); window.addEventListener("keydown", merken)
    document.addEventListener("visibilitychange", sichtbar)
    const t = setInterval(pruefen, 5 * 60000)
    return () => { window.removeEventListener("pointerdown", merken); window.removeEventListener("keydown", merken); document.removeEventListener("visibilitychange", sichtbar); clearInterval(t) }
  }, [session?.user?.id])

  // Zwei-Faktor: Code abfragen, einrichten lassen oder durchlassen
  React.useEffect(() => {
    if (!session) { setTor("pruefe"); setIch(null); liveStoppen(); return }
    if (tor !== "pruefe") return
    let ab = false
    ;(async () => {
      try {
        const z = await zweifaktorStand()
        if (z.stufe === "aal2") { !ab && setTor("frei"); return }
        if (z.ziel === "aal2") { !ab && setTor("code"); return }
        const pflicht = await zweifaktorPflicht()
        !ab && setTor(pflicht ? "einrichten" : "frei")
      } catch (e: any) { !ab && setFehler("Die Anmeldung konnte nicht geprüft werden: " + e.message) }
    })()
    return () => { ab = true }
  }, [session?.user?.id, tor])

  React.useEffect(() => {
    if (!session || tor !== "frei") return
    if (ich === session.user.id) return
    setFehler(null)
    laden(session).then(() => {
      geladenAm.current = Date.now()
      if (!M.person(session.user.id)) { setFehler("Dein Zugang ist noch nicht freigeschaltet. Bitte bei der Geschäftsführung melden."); return }
      if (M.person(session.user.id).aktiv === false) { setFehler("Dieser Zugang ist gesperrt."); return }
      setIch(session.user.id)
      liveStarten(session.user.id, neuZeichnen)
    }).catch((e) => setFehler("Die Daten konnten nicht geladen werden: " + e.message))
  }, [session?.user?.id, tor])

  // Beim Zurückkommen in die App neu laden, wenn nichts ungespeichert ist (damit man sieht, was die anderen eingetragen haben)
  React.useEffect(() => {
    const f = () => {
      if (document.visibilityState !== "visible" || !session || !ich) return
      if (Date.now() - geladenAm.current < 60000 || offeneAenderungen() || syncStatus().zustand !== "bereit") return
      laden(session).then(() => { geladenAm.current = Date.now(); neuZeichnen() }).catch(() => {})
    }
    document.addEventListener("visibilitychange", f)
    return () => document.removeEventListener("visibilitychange", f)
  }, [session, ich])

  const abmeldenKnopf = <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => abmelden()}>Abmelden</Button>
  if (session === undefined) return <Rahmen><div className="flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div></Rahmen>
  if (!session) return <Anmelden />
  if (fehler) return (
    <Rahmen><Card><CardHeader><CardTitle>Das hat nicht geklappt</CardTitle><CardDescription>{fehler}</CardDescription></CardHeader>
      <CardFooter className="gap-2"><Button onClick={() => location.reload()}>Neu laden</Button><Button variant="outline" onClick={() => abmelden()}>Abmelden</Button></CardFooter></Card></Rahmen>
  )
  if (tor === "code") return (
    <Rahmen><Card><CardHeader><CardTitle className="text-xl">Noch ein Schritt</CardTitle><CardDescription>Zur Sicherheit brauchen wir den Code aus deiner Authenticator-App.</CardDescription></CardHeader>
      <CardContent><ZweifaktorCode onFertig={() => setTor("frei")} /></CardContent><CardFooter>{abmeldenKnopf}</CardFooter></Card></Rahmen>
  )
  if (tor === "einrichten") return (
    <Rahmen><Card><CardHeader><CardTitle className="text-xl">Zwei-Faktor-Anmeldung einrichten</CardTitle>
      <CardDescription>Für deinen Zugang ist sie Pflicht. Danach brauchst du beim Anmelden neben dem Passwort einen Code vom Handy. So nützt ein geklautes Passwort allein nichts.</CardDescription></CardHeader>
      <CardContent><ZweifaktorEinrichten onFertig={() => { toast("Zwei-Faktor-Anmeldung ist eingerichtet"); setTor("frei") }} /></CardContent><CardFooter>{abmeldenKnopf}</CardFooter></Card></Rahmen>
  )
  if (!ich) return <Rahmen><div className="flex flex-col items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />{tor === "pruefe" ? "Anmeldung wird geprüft …" : "Daten werden geladen …"}</div></Rahmen>
  if (session.user.user_metadata?.passwort_aendern) return (
    <Rahmen><Card><CardHeader><CardTitle className="text-xl">Willkommen, {M.person(ich).name}</CardTitle></CardHeader>
      <CardContent><PasswortFormular pflicht onFertig={() => sb.auth.refreshSession()} /></CardContent></Card></Rahmen>
  )
  return <App start={ich} />
}

export default function Wurzel() {
  return ECHT ? <Echt /> : <App />
}
