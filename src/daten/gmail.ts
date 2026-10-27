import { ECHT } from "@/daten/echt"
import { rufen } from "@/daten/kalender"

/* Gmail über dieselbe Server-Funktion wie der Kalender. Jeder sieht nur sein eigenes Postfach. */

export type MailVerlauf = { id: string; betreff: string; von: string; an: string; datum: string | null; auszug: string; anzahl: number; ungelesen: boolean; gesendet: boolean; link: string; adressen?: string[] }
export type MailNachricht = { id: string; von: string; an: string; cc: string; datum: string | null; text: string; anhaenge: string[]; kennung: string; gesendet: boolean }
export type MailVoll = MailVerlauf & { nachrichten: MailNachricht[] }
export type PostfachStand = { verbunden: boolean; email?: string; verlaeufe: MailVerlauf[]; weiter?: string | null; ungelesen?: number | null; demo?: boolean }
export type MailStand = { verbunden: boolean; email?: string; verlaeufe: MailVerlauf[]; demo?: boolean }

const DEMO: MailVerlauf[] = [
  { id: "d1", betreff: "Unterlagen zum Standort", von: "Ramtin Shahpary <ramtin@lumiogroup.de>", an: "inhaber@beispiel.de", datum: new Date(Date.now() - 86400000).toISOString(),
    auszug: "Wie besprochen schicke ich Ihnen die Unterlagen zur Aufstellung …", anzahl: 2, ungelesen: false, gesendet: true, link: "https://mail.google.com" },
  { id: "d2", betreff: "Re: Termin vor Ort", von: "Inhaber <inhaber@beispiel.de>", an: "ramtin@lumiogroup.de", datum: new Date(Date.now() - 3 * 86400000).toISOString(),
    auszug: "Donnerstag um 10 Uhr passt mir gut, ich bin dann im Laden …", anzahl: 3, ungelesen: true, gesendet: false, link: "https://mail.google.com" },
]

const cache = new Map<string, { wert: MailStand; zeit: number }>()
export async function mailsZu(adressen: string[], frisch = false): Promise<MailStand> {
  if (!adressen.length) return { verbunden: true, verlaeufe: [] }
  if (!ECHT) return { verbunden: true, demo: true, verlaeufe: DEMO }
  const k = adressen.slice().sort().join(",")
  const c = cache.get(k)
  if (!frisch && c && Date.now() - c.zeit < 60000) return c.wert
  const wert = await rufen({ aktion: "mails", adressen })
  cache.set(k, { wert, zeit: Date.now() })
  return wert
}

export async function mailSenden(m: { an: string; betreff: string; text: string; verlauf?: string; antwortAuf?: string }): Promise<{ id: string; verlauf: string }> {
  if (!ECHT) throw new Error("Im Demo-Modus wird nichts verschickt.")
  const r = await rufen({ aktion: "senden", ...m })
  cache.clear(); melden()
  return r
}

/* ---------- Postfach ---------- */
const hoerer = new Set<() => void>()
export function aufPostfach(f: () => void) { hoerer.add(f); return () => { hoerer.delete(f) } }
function melden() { hoerer.forEach((f) => f()) }

const DEMO_POST: MailVerlauf[] = [
  { id: "p1", betreff: "Re: Standort Campus Mensa", von: "Ioannis Voudouris <ioannis@hochschulwerbung.example>", an: "ramtin@lumiogroup.de", datum: new Date(Date.now() - 2 * 3600000).toISOString(),
    auszug: "Danke für die Fotos, die Aufbaustelle passt so. Können wir Donnerstag …", anzahl: 4, ungelesen: true, gesendet: false, link: "https://mail.google.com", adressen: ["ioannis@hochschulwerbung.example"] },
  { id: "p2", betreff: "Unterlagen zum Standort", von: "Ramtin Shahpary <ramtin@lumiogroup.de>", an: "petersen@autohaus.example", datum: new Date(Date.now() - 86400000).toISOString(),
    auszug: "Wie besprochen schicke ich Ihnen die Unterlagen zur Aufstellung …", anzahl: 2, ungelesen: false, gesendet: true, link: "https://mail.google.com", adressen: ["petersen@autohaus.example"] },
  { id: "p3", betreff: "Ihre Rechnung Oktober", von: "Qonto <noreply@qonto.example>", an: "ramtin@lumiogroup.de", datum: new Date(Date.now() - 3 * 86400000).toISOString(),
    auszug: "Ihre Rechnung für Oktober steht bereit …", anzahl: 1, ungelesen: false, gesendet: false, link: "https://mail.google.com", adressen: ["noreply@qonto.example"] },
]
export async function postfach(o: { ordner: "eingang" | "gesendet" | "alle"; suche?: string; seite?: string | null }): Promise<PostfachStand> {
  if (!ECHT) {
    const q = (o.suche || "").toLowerCase()
    const v = DEMO_POST.filter((m) => (o.ordner === "gesendet" ? m.gesendet : o.ordner === "eingang" ? !m.gesendet : true) && (!q || (m.betreff + m.von + m.auszug).toLowerCase().includes(q)))
    return { verbunden: true, demo: true, email: "ramtin@lumiogroup.de", verlaeufe: v, ungelesen: 1 }
  }
  return rufen({ aktion: "postfach", ordner: o.ordner, suche: o.suche || "", seite: o.seite || undefined })
}
export async function verlaufLesen(id: string): Promise<MailVoll> {
  if (!ECHT) {
    const v = DEMO_POST.find((m) => m.id === id) || DEMO_POST[0]
    return { ...v, ungelesen: false, nachrichten: [
      { id: id + "a", von: v.von, an: v.an, cc: "", datum: v.datum, kennung: "<demo@lumio>", gesendet: v.gesendet, anhaenge: id === "p1" ? ["Aufbaustelle.jpg"] : [],
        text: v.auszug.replace(" …", ".") + "\n\nViele Grüße" },
    ] }
  }
  const r = await rufen({ aktion: "verlauf", id })
  melden()
  return r
}
export async function ungelesenZahl(): Promise<number> {
  if (!ECHT) return 1
  const r = await rufen({ aktion: "ungelesen" })
  return r.ungelesen || 0
}
export const nurName = (x: string) => (x.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] || x).trim()
export const nurAdresse = (x: string) => (x.match(/<([^>]+)>/)?.[1] || x).trim()
