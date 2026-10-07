import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sb, abmelden, zweifaktorStand, zweifaktorBestaetigen } from "@/daten/echt"
import * as M from "@/model/model.js"
import { Fingerprint, Loader2, Lock } from "lucide-react"

/* App-Sperre: Auf dem Handy (und in der installierten App) ist die App gesperrt, sobald man sie verlässt.
   Entsperren mit Face ID / Fingerabdruck (Passkey auf diesem Gerät) oder dem 6-stelligen Code bzw. Passwort.
   Am Rechner im Browser wird erst nach 10 Minuten Abwesenheit gesperrt.
   Ausnahme: Wer aus der App heraus anruft, eine Mail öffnet oder ein Foto aufnimmt, kommt ohne Sperre zurück. */
const MOBIL = typeof window !== "undefined" && (
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true ||
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
const DESKTOP_NACH_MS = 10 * 60000
let ausnahmeBis = 0
export const sperreKurzAussetzen = (ms = 5 * 60000) => { ausnahmeBis = Date.now() + ms }

/* ---------- Face ID / Fingerabdruck über Passkey (nur auf diesem Gerät) ---------- */
const schluessel = (ich: string) => "lumio-entsperren-" + ich
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
const zufall = (n = 32) => crypto.getRandomValues(new Uint8Array(n))
async function biometrieMoeglich() {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) } catch (e) { return false }
}
function gespeicherteId(ich: string) { try { return localStorage.getItem(schluessel(ich)) } catch (e) { return null } }
async function biometrieEinrichten(ich: string, email: string, name: string) {
  const c = await navigator.credentials.create({ publicKey: {
    rp: { name: "LUMIO Vertriebszentrale", id: location.hostname },
    user: { id: zufall(16), name: email || name, displayName: name },
    challenge: zufall(),
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
    timeout: 60000, attestation: "none",
  } }) as PublicKeyCredential | null
  if (!c) throw new Error("Abgebrochen")
  try { localStorage.setItem(schluessel(ich), b64(c.rawId)) } catch (e) {}
}
async function biometriePruefen(id: string) {
  const r = await navigator.credentials.get({ publicKey: {
    challenge: zufall(), rpId: location.hostname, timeout: 60000, userVerification: "required",
    allowCredentials: [{ type: "public-key", id: unb64(id) }],
  } })
  return !!r
}

export function AppSperre({ ich, children }: { ich: string; children: React.ReactNode }) {
  const [gesperrt, setGesperrt] = React.useState(() => {
    try { if (sessionStorage.getItem("lumio-frisch")) { sessionStorage.removeItem("lumio-frisch"); return false } } catch (e) {}
    return true
  })
  const inhalt = React.useRef<HTMLDivElement>(null)
  const weg = React.useRef(0)

  React.useEffect(() => {
    // Anrufen, Mail, WhatsApp, Karte, Foto: bewusst die App verlassen, danach ohne Sperre zurück
    const klick = (e: Event) => {
      const t = (e.target as HTMLElement)?.closest?.('a[href^="tel:"],a[href^="mailto:"],a[href^="sms:"],a[target="_blank"],input[type="file"],label')
      if (!t) return
      if (t.tagName === "LABEL") { const f = (t as HTMLLabelElement).control as HTMLInputElement | null; if (!(f?.type === "file" || t.querySelector('input[type="file"]'))) return }
      sperreKurzAussetzen()
    }
    const versteckt = () => {
      weg.current = Date.now()
      if (MOBIL && Date.now() > ausnahmeBis) {
        // sofort unsichtbar machen, damit auch die App-Vorschau im Umschalter nichts zeigt
        if (inhalt.current) inhalt.current.style.visibility = "hidden"
        setGesperrt(true)
      }
    }
    const sichtbar = () => {
      if (!MOBIL && weg.current && Date.now() - weg.current > DESKTOP_NACH_MS) setGesperrt(true)
      ausnahmeBis = 0
    }
    const wechsel = () => (document.visibilityState === "hidden" ? versteckt() : sichtbar())
    document.addEventListener("click", klick, true)
    document.addEventListener("visibilitychange", wechsel)
    window.addEventListener("pagehide", versteckt)
    return () => { document.removeEventListener("click", klick, true); document.removeEventListener("visibilitychange", wechsel); window.removeEventListener("pagehide", versteckt) }
  }, [])

  React.useEffect(() => {
    const el = inhalt.current
    if (!el) return
    el.style.visibility = gesperrt ? "hidden" : ""
    if (gesperrt) el.setAttribute("inert", ""); else el.removeAttribute("inert")
  }, [gesperrt])

  return (
    <>
      <div ref={inhalt} aria-hidden={gesperrt || undefined}>{children}</div>
      {gesperrt && <Sperrbildschirm ich={ich} onFrei={() => setGesperrt(false)} />}
    </>
  )
}

function Sperrbildschirm({ ich, onFrei }: { ich: string; onFrei: () => void }) {
  const p = M.person(ich)
  const [bio, setBio] = React.useState<{ moeglich: boolean; id: string | null }>({ moeglich: false, id: gespeicherteId(ich) })
  const [faktor, setFaktor] = React.useState<any | null | undefined>(undefined)
  const [wert, setWert] = React.useState("")
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [laeuft, setLaeuft] = React.useState(false)
  const [angebot, setAngebot] = React.useState(false)

  React.useEffect(() => {
    biometrieMoeglich().then((m) => setBio((b) => ({ ...b, moeglich: m })))
    zweifaktorStand().then((s) => setFaktor(s.faktoren[0] || null)).catch(() => setFaktor(null))
  }, [])

  const fertig = () => {
    // Nach Code/Passwort einmal anbieten, Face ID einzurichten
    if (bio.moeglich && !bio.id) { setAngebot(true); return }
    onFrei()
  }
  const mitBiometrie = async () => {
    if (!bio.id) return
    setFehler(null); setLaeuft(true)
    try { if (await biometriePruefen(bio.id)) onFrei() } catch (e: any) {
      setFehler(/NotAllowed|abort/i.test(e?.name + e?.message) ? "Nicht erkannt oder abgebrochen. Nochmal versuchen oder den Code nutzen." : "Face ID ging nicht. Bitte den Code nutzen.")
    } finally { setLaeuft(false) }
  }
  const mitCode = async (e: React.FormEvent) => {
    e.preventDefault(); setFehler(null); setLaeuft(true)
    try {
      if (faktor) await zweifaktorBestaetigen(faktor.id, wert)
      else {
        const { data } = await sb.auth.getUser()
        const { error } = await sb.auth.signInWithPassword({ email: data.user?.email || p?.email || "", password: wert })
        if (error) throw new Error("Das Passwort stimmt nicht.")
      }
      setWert(""); fertig()
    } catch (x: any) { setFehler(x.message); setWert("") } finally { setLaeuft(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-6 pt-[max(1.5rem,env(safe-area-inset-top))]" role="dialog" aria-modal="true" aria-labelledby="sperre-titel">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[#2244CC] text-white">
        <svg viewBox="0 0 240 240" className="size-8" aria-hidden="true"><path d="M101 70H170V138M170 70L70 170" fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="text-center">
        <h1 id="sperre-titel" className="flex items-center justify-center gap-2 text-lg font-semibold"><Lock className="size-4" />Gesperrt</h1>
        <p className="text-sm text-muted-foreground">{p?.voll || ""}</p>
      </div>

      {angebot ? (
        <div className="grid w-full max-w-xs gap-3 text-center">
          <p className="text-sm">Beim nächsten Mal mit <b>Face ID bzw. Fingerabdruck</b> entsperren?</p>
          <Button onClick={async () => {
            setFehler(null)
            try { await biometrieEinrichten(ich, p?.email || "", p?.voll || "LUMIO"); onFrei() } catch (e: any) { setFehler("Hat nicht geklappt. Du kannst es beim nächsten Entsperren nochmal versuchen."); setTimeout(onFrei, 1500) }
          }}><Fingerprint />Ja, einrichten</Button>
          <Button variant="ghost" onClick={onFrei}>Später</Button>
          {fehler && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
        </div>
      ) : (
        <div className="grid w-full max-w-xs gap-4">
          {bio.id && bio.moeglich && (
            <Button size="lg" onClick={mitBiometrie} disabled={laeuft} autoFocus>{laeuft ? <Loader2 className="animate-spin" /> : <Fingerprint />}Mit Face ID entsperren</Button>
          )}
          {faktor === undefined ? <div className="flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : (
            <form onSubmit={mitCode} className="grid gap-2">
              <Label htmlFor="sperre-wert" className="text-sm">{faktor ? "Code aus der Authenticator-App" : "Dein Passwort"}</Label>
              {faktor
                ? <Input id="sperre-wert" value={wert} onChange={(e) => setWert(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
                    placeholder="123456" className="h-12 text-center font-mono text-2xl tracking-[0.4em]" autoFocus={!bio.id} />
                : <Input id="sperre-wert" type="password" value={wert} onChange={(e) => setWert(e.target.value)} autoComplete="current-password" autoFocus={!bio.id} />}
              <Button type="submit" variant={bio.id ? "outline" : "default"} disabled={laeuft || (faktor ? wert.length !== 6 : !wert)}>Entsperren</Button>
            </form>
          )}
          {fehler && <p className="text-center text-sm text-destructive" role="alert">{fehler}</p>}
          <Button variant="ghost" className="text-muted-foreground" onClick={() => abmelden()}>Abmelden</Button>
        </div>
      )}
    </div>
  )
}
