import { ECHT, sb } from "@/daten/echt"
import { sperreKurzAussetzen } from "@/app-sperre"

/* Google-Kalender über die Server-Funktion "google-kalender". Die App sieht nie einen Google-Schlüssel. */

export type KalTermin = { id: string; titel: string; start: string; ende: string; ganztags: boolean; ort?: string | null; link?: string | null; meet?: string | null; teilnehmer?: string[]; belegt?: boolean }
export type KalStand = { eingerichtet: boolean; team: { id: string; name: string; rolle: string; verbunden: boolean; email: string | null }[] }

async function rufen(body: any) {
  if (!ECHT) throw new Error("Im Demo-Modus gibt es keine Kalender-Verbindung.")
  const { data, error } = await sb.functions.invoke("google-kalender", { body })
  if (error) {
    let text = "Kalender gerade nicht erreichbar."
    try { const j = await (error as any).context?.json?.(); if (j?.fehler) text = j.fehler } catch (e) {}
    throw new Error(text)
  }
  if (data?.fehler) throw new Error(data.fehler)
  return data
}

let standCache: { wert: KalStand; zeit: number } | null = null
const hoerer = new Set<() => void>()
export function aufKalender(f: () => void) { hoerer.add(f); return () => { hoerer.delete(f) } }
function melden() { hoerer.forEach((f) => f()) }

export async function kalenderStand(frisch = false): Promise<KalStand> {
  if (!ECHT) return { eingerichtet: false, team: [] }
  if (!frisch && standCache && Date.now() - standCache.zeit < 60000) return standCache.wert
  const wert = await rufen({ aktion: "stand" })
  standCache = { wert, zeit: Date.now() }
  return wert
}
export function standVergessen() { standCache = null; terminCache.clear(); melden() }

/* Google-Anmeldung in einem neuen Fenster. Das Fenster wird sofort geöffnet (sonst blockt der Browser es). */
export async function verbinden() {
  sperreKurzAussetzen()
  const w = window.open("", "_blank")
  try {
    const { url } = await rufen({ aktion: "start" })
    if (w) w.location.href = url
    else window.location.href = url
  } catch (e) { w?.close(); throw e }
}
export async function trennen(profil?: string) { await rufen({ aktion: "trennen", profil }); standVergessen() }

const terminCache = new Map<string, { wert: any; zeit: number }>()
export async function teamTermine(von: Date, bis: Date, personen?: string[]): Promise<{ profil: string; termine: KalTermin[]; fehler?: string }[]> {
  const schluessel = von.toISOString() + bis.toISOString() + (personen || []).join(",")
  const c = terminCache.get(schluessel)
  if (c && Date.now() - c.zeit < 120000) return c.wert
  const { kalender } = await rufen({ aktion: "termine", von: von.toISOString(), bis: bis.toISOString(), personen })
  terminCache.set(schluessel, { wert: kalender, zeit: Date.now() })
  return kalender
}

export async function belegtAm(closer: string, datum: string): Promise<{ verbunden: boolean; belegt: { start: string; end: string }[] }> {
  const von = new Date(datum + "T00:00:00"), bis = new Date(datum + "T23:59:59")
  return rufen({ aktion: "frei", closer, von: von.toISOString(), bis: bis.toISOString() })
}

export async function terminEintragen(t: {
  closer: string; datum: string; zeit: string; dauer: number; titel: string; beschreibung: string; ort?: string
  meet: boolean; einladen: boolean; kunde_email?: string; termin_id?: string
}): Promise<{ id: string; link: string; meet: string | null }> {
  const r = await rufen({ aktion: "anlegen", ...t })
  terminCache.clear(); melden()
  return r
}
export async function terminAbsagen(closer: string, event: string, benachrichtigen = false) {
  const r = await rufen({ aktion: "absagen", closer, event, benachrichtigen })
  terminCache.clear(); melden()
  return r
}

/* Freie Halbstunden zwischen 8 und 19 Uhr (Ortszeit), ohne Überschneidung mit "belegt" */
export function freieZeiten(datum: string, belegt: { start: string; end: string }[], dauer = 30, von = 8, bis = 19) {
  const slots: string[] = []
  const jetzt = Date.now()
  for (let min = von * 60; min + dauer <= bis * 60; min += 30) {
    const hh = String(Math.floor(min / 60)).padStart(2, "0"), mm = String(min % 60).padStart(2, "0")
    const a = new Date(`${datum}T${hh}:${mm}:00`).getTime(), e = a + dauer * 60000
    if (a < jetzt) continue
    if (belegt.some((b) => a < Date.parse(b.end) && e > Date.parse(b.start))) continue
    slots.push(`${hh}:${mm}`)
  }
  return slots
}
