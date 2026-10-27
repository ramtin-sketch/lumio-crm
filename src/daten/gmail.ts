import { ECHT } from "@/daten/echt"
import { rufen } from "@/daten/kalender"

/* Gmail über dieselbe Server-Funktion wie der Kalender. Jeder sieht nur sein eigenes Postfach. */

export type MailVerlauf = { id: string; betreff: string; von: string; an: string; datum: string | null; auszug: string; anzahl: number; ungelesen: boolean; gesendet: boolean; link: string }
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

export async function mailSenden(m: { an: string; betreff: string; text: string; verlauf?: string }): Promise<{ id: string; verlauf: string }> {
  if (!ECHT) throw new Error("Im Demo-Modus wird nichts verschickt.")
  const r = await rufen({ aktion: "senden", ...m })
  cache.clear()
  return r
}
