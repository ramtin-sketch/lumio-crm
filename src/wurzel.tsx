import * as React from "react"
import App from "@/App"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ECHT, sb, laden, anmelden, abmelden, passwortAendern, offeneAenderungen, syncStatus } from "@/daten/echt"
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
    </div>
  )
}

function Anmelden() {
  const [email, setEmail] = React.useState("")
  const [pw, setPw] = React.useState("")
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [laeuft, setLaeuft] = React.useState(false)
  return (
    <Rahmen>
      <Card>
        <CardHeader><CardTitle className="text-xl">Anmelden</CardTitle><CardDescription>Mit der E-Mail und dem Passwort, die du von der Geschäftsführung bekommen hast.</CardDescription></CardHeader>
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

function Echt() {
  const [session, setSession] = React.useState<any>(undefined)
  const [ich, setIch] = React.useState<string | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const geladenAm = React.useRef(0)

  React.useEffect(() => {
    sb.auth.getSession().then(({ data }: any) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e: string, s: any) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  React.useEffect(() => {
    if (!session) { setIch(null); return }
    if (ich === session.user.id) return
    setFehler(null)
    laden(session).then(() => {
      geladenAm.current = Date.now()
      if (!M.person(session.user.id)) { setFehler("Dein Zugang ist noch nicht freigeschaltet. Bitte bei der Geschäftsführung melden."); return }
      if (M.person(session.user.id).aktiv === false) { setFehler("Dieser Zugang ist gesperrt."); return }
      setIch(session.user.id)
    }).catch((e) => setFehler("Die Daten konnten nicht geladen werden: " + e.message))
  }, [session?.user?.id])

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

  if (session === undefined) return <Rahmen><div className="flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div></Rahmen>
  if (!session) return <Anmelden />
  if (fehler) return (
    <Rahmen><Card><CardHeader><CardTitle>Das hat nicht geklappt</CardTitle><CardDescription>{fehler}</CardDescription></CardHeader>
      <CardFooter className="gap-2"><Button onClick={() => location.reload()}>Neu laden</Button><Button variant="outline" onClick={() => abmelden()}>Abmelden</Button></CardFooter></Card></Rahmen>
  )
  if (!ich) return <Rahmen><div className="flex flex-col items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />Daten werden geladen …</div></Rahmen>
  if (session.user.user_metadata?.passwort_aendern) return (
    <Rahmen><Card><CardHeader><CardTitle className="text-xl">Willkommen, {M.person(ich).name}</CardTitle></CardHeader>
      <CardContent><PasswortFormular pflicht onFertig={() => sb.auth.refreshSession()} /></CardContent></Card></Rahmen>
  )
  return <App start={ich} />
}

export default function Wurzel() {
  return ECHT ? <Echt /> : <App />
}
