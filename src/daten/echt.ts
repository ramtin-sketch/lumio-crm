/* Echter Betrieb: Login, Daten laden, Änderungen automatisch speichern.
   Die App arbeitet weiter auf den Arrays im Modell. Nach jeder Änderung vergleicht flush()
   den Stand mit dem zuletzt gespeicherten und schickt nur das Geänderte an Supabase. */
import { createClient, type Session } from "@supabase/supabase-js"
import * as M from "@/model/model.js"
import * as K from "@/model/karte.js"

export const SUPABASE_URL = "https://ehgjsvpbzgmlcgingkel.supabase.co"
export const SUPABASE_KEY = "sb_publishable_GVNRUlS24_FvyG_PpsfRSw_GqpQQiaj" // öffentlicher Schlüssel, Rechte regelt die Datenbank

/* Echt auf GitHub Pages (und lokal mit ?echt), sonst Demo mit erfundenen Daten */
export const ECHT = typeof location !== "undefined" &&
  (location.hostname.endsWith("github.io") || new URLSearchParams(location.search).has("echt"))

export const sb = ECHT ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : (null as any)

const FARBEN = ["#3b5bdb", "#0ca678", "#e8590c", "#c2255c", "#7048e8", "#1098ad", "#f59f00", "#5c940d"]
const ROLLE_APP: Record<string, string> = { gf: "gf", setter: "setter", closer: "setter", handelsvertreter: "hv" }

/* ---------- Status für die Anzeige oben ---------- */
type Status = { zustand: "bereit" | "speichert" | "fehler"; fehler?: string; zuletzt?: Date }
let status: Status = { zustand: "bereit" }
const hoerer = new Set<() => void>()
const setStatus = (s: Partial<Status>) => { status = { ...status, ...s }; hoerer.forEach((f) => f()) }
export const syncStatus = () => status
export const aufStatus = (f: () => void) => { hoerer.add(f); return () => { hoerer.delete(f) } }

/* ---------- Laden ---------- */
async function alle(tabelle: string, select = "*", filter?: (q: any) => any) {
  const zeilen: any[] = []
  for (let von = 0; ; von += 1000) {
    let q = sb.from(tabelle).select(select).range(von, von + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(tabelle + ": " + error.message)
    zeilen.push(...data)
    if (data.length < 1000) break
  }
  return zeilen
}

const gespeichert = new Map<string, string>()
const merke = (schluessel: string, zeile: any) => gespeichert.set(schluessel, JSON.stringify(zeile))
const anders = (schluessel: string, zeile: any) => gespeichert.get(schluessel) !== JSON.stringify(zeile)

export async function laden(session: Session) {
  const seit = M.ymAdd(M.MONAT, -6) + "-01"
  const [profile, mandate, leads, termine, anrufe, gebiete, sperren] = await Promise.all([
    alle("profil"),
    alle("mandat", "*", (q) => q.neq("bereich", "d2d").order("id")),
    alle("lead", "*, kontakt(*), verlauf(*), abschluss(*)"),
    alle("termin"),
    alle("anruf", "*", (q) => q.gte("zeit", seit)),
    alle("gebiet"),
    alle("sperrliste"),
  ])
  gespeichert.clear()

  const personen = profile.map((p: any, i: number) => ({
    id: p.id, name: (p.name || p.email || "?").split(" ")[0], voll: p.name || p.email, rolle: ROLLE_APP[p.rolle] || "setter", dbRolle: p.rolle,
    kurz: p.kurz || (p.name || "?").split(/\s+/).map((t: string) => t[0]).join("").slice(0, 2).toUpperCase(),
    farbe: p.farbe || FARBEN[i % FARBEN.length], stadt: p.stadt || null, gebiet: p.gebiet || "", email: p.email, aktiv: p.aktiv,
    seit: (p.erstellt_am || "").slice(0, 10), provisionsanteil: p.provisionsanteil,
  }))
  const mandatListe = mandate.map((m: any) => ({
    id: String(m.id), dbId: m.id, bereich: m.bereich, name: m.name, produkt: m.produkt || "", status: m.status, seit: m.seit,
    k: m.kondition || { typ: "offen" }, ktext: m.verguetung_text || "", hv: Number(m.hv_anteil) || 0,
    ap: m.ansprechpartner || {}, felder: Array.isArray(m.felder_schema) ? m.felder_schema : [],
  }))
  const einzeln = (x: any) => (Array.isArray(x) ? x[0] : x) || null
  const leadListe = leads.map((r: any) => {
    const ab = einzeln(r.abschluss)
    const l = {
      id: r.id, mandat: String(r.mandat_id), bereich: r.bereich, name: r.name, ort: r.ort, adresse: r.adresse, stadt: r.stadt, unit: r.unit,
      geo: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
      stufe: r.stufe, temp: r.temp, betreuer: r.betreuer_id, setter: r.setter_id, closer: r.closer_id,
      next: r.next_datum ? { datum: r.next_datum, zeit: r.next_zeit, text: r.next_text || "" } : null,
      felder: r.felder || {}, verlustgrund: r.verlustgrund, terminStatus: r.termin_status, noShows: r.no_shows || 0,
      uebergabe: r.uebergabe, erfasst: r.erfasst, fotos: r.fotos || [], angelegt: r.angelegt, quelle: r.quelle,
      kontakte: (r.kontakt || []).sort((a: any, b: any) => a.erstellt_am.localeCompare(b.erstellt_am))
        .map((k: any) => ({ id: k.id, name: k.name, funktion: k.funktion, tel: k.telefon, mail: k.email, notiz: k.notiz })),
      verlauf: (r.verlauf || []).sort((a: any, b: any) => a.erstellt_am.localeCompare(b.erstellt_am))
        .map((v: any) => ({ id: v.id, datum: v.datum, wer: v.profil_id, art: v.art, titel: v.titel, text: v.text, _s: true })),
      abschluss: ab ? { datum: ab.datum, status: ab.status, laufzeit: num(ab.laufzeit), monatsbeitrag: num(ab.monatsbeitrag), volumen: num(ab.volumen), teilnehmer: num(ab.teilnehmer), dealgroesse: num(ab.dealgroesse) } : null,
    }
    return l
  }).filter((l: any) => mandatListe.some((m: any) => m.id === l.mandat))
  const terminListe = termine.map((t: any) => ({ id: t.id, lead: t.lead_id, setter: t.setter_id, closer: t.closer_id, datum: t.datum, zeit: t.zeit, status: t.status, ergebnis: t.ergebnis }))
  const tage = new Map<string, any>()
  anrufe.forEach((a: any) => {
    const d = a.zeit.slice(0, 10), key = a.profil_id + d
    if (!tage.has(key)) tage.set(key, { person: a.profil_id, datum: d, wahl: 0, erreicht: 0, termine: 0, einwaende: {} })
    const t = tage.get(key); t.wahl++
    if (a.ergebnis !== "nicht") t.erreicht++
    if (a.ergebnis === "termin") t.termine++
    if (a.einwand) t.einwaende[a.einwand] = (t.einwaende[a.einwand] || 0) + 1
  })
  const sperrListe = sperren.map((e: any) => ({ id: e.id, telefon: e.telefon, email: e.email, firma: e.firma, grund: e.grund, lead: e.lead_id, datum: e.erstellt_am.slice(0, 10), wer: e.erstellt_von }))

  M.datenErsetzen({ personen, mandate: mandatListe, leads: leadListe, termine: terminListe, anrufTage: [...tage.values()], sperrliste: sperrListe })
  K.gebieteSetzen(gebiete)
  K.alleVerorten()

  // Stand merken, damit nur echte Änderungen gespeichert werden
  M.LEADS.forEach((l: any) => {
    merke("lead:" + l.id, leadZeile(l))
    l.kontakte.forEach((k: any) => merke("kontakt:" + k.id, kontaktZeile(l, k)))
    if (l.abschluss) merke("abschluss:" + l.id, abschlussZeile(l))
  })
  M.TERMINE.forEach((t: any) => merke("termin:" + t.id, terminZeile(t)))
  Object.keys(K.GEBIET).forEach((u) => merke("gebiet:" + u, K.GEBIET[u]))
  gebiete.forEach((g: any) => merke("gebiet:" + g.unit, g.profil_id))
  setStatus({ zustand: "bereit", fehler: undefined, zuletzt: new Date() })
  return { ich: session.user.id }
}
const num = (x: any) => (x === null || x === undefined ? undefined : Number(x))

/* ---------- Abbildung App → Datenbank ---------- */
const leadZeile = (l: any) => ({
  id: l.id, mandat_id: Number(l.mandat), name: l.name, ort: l.ort ?? null, adresse: l.adresse ?? null, stadt: l.stadt ?? null, unit: l.unit ?? null,
  lat: l.geo?.lat ?? null, lng: l.geo?.lng ?? null, stufe: l.stufe, temp: l.temp || 0,
  betreuer_id: l.betreuer || null, setter_id: l.setter || null, closer_id: l.closer || null,
  next_datum: l.next?.datum || null, next_zeit: l.next?.zeit || null, next_text: l.next?.text || null,
  felder: l.felder || {}, verlustgrund: l.verlustgrund || null, termin_status: l.terminStatus || null, no_shows: l.noShows || 0,
  uebergabe: l.uebergabe || null, erfasst: l.erfasst || null, fotos: (l.fotos || []).filter((f: string) => !f.startsWith("data:")),
  quelle: l.quelle || null, angelegt: l.angelegt || M.HEUTE,
})
const kontaktZeile = (l: any, k: any) => ({ id: k.id, lead_id: l.id, name: k.name, funktion: k.funktion || null, telefon: k.tel || null, email: k.mail || null, notiz: k.notiz || null })
const abschlussZeile = (l: any) => {
  const a = l.abschluss
  return { lead_id: l.id, datum: a.datum, status: a.status, laufzeit: a.laufzeit ?? null, monatsbeitrag: a.monatsbeitrag ?? null, volumen: a.volumen ?? null, teilnehmer: a.teilnehmer ?? null, dealgroesse: a.dealgroesse ?? null }
}
const terminZeile = (t: any) => ({ id: t.id, lead_id: t.lead || null, setter_id: t.setter || null, closer_id: t.closer || null, datum: t.datum, zeit: t.zeit || null, status: t.status, ergebnis: t.ergebnis || "offen" })

/* ---------- Fotos ---------- */
async function fotosHochladen(l: any) {
  const neu = (l.fotos || []).filter((f: string) => f.startsWith("data:"))
  if (!neu.length) return false
  const pfade: string[] = []
  for (const f of neu) {
    const blob = await (await fetch(f)).blob()
    const pfad = `${l.id}/${crypto.randomUUID()}.jpg`
    const { error } = await sb.storage.from("fotos").upload(pfad, blob, { contentType: blob.type || "image/jpeg" })
    if (error) throw new Error("Foto: " + error.message)
    fotoCache.set(pfad, f)
    pfade.push(pfad)
  }
  l.fotos = (l.fotos || []).filter((f: string) => !f.startsWith("data:")).concat(pfade)
  return true
}
const fotoCache = new Map<string, string>()
export async function fotoUrls(pfade: string[]) {
  const fehlen = pfade.filter((p) => !p.startsWith("data:") && !fotoCache.has(p))
  if (ECHT && fehlen.length) {
    const { data } = await sb.storage.from("fotos").createSignedUrls(fehlen, 3600)
    ;(data || []).forEach((d: any) => d.signedUrl && fotoCache.set(d.path, d.signedUrl))
  }
  return pfade.map((p) => (p.startsWith("data:") ? p : fotoCache.get(p) || ""))
}

/* ---------- Speichern ---------- */
let laeuft = false, nochmal = false, zeitgeber: any = null
export function spaeterSpeichern() {
  if (!ECHT) return
  clearTimeout(zeitgeber)
  zeitgeber = setTimeout(flush, 400)
}
export function offeneAenderungen() {
  return M.LEADS.some((l: any) => anders("lead:" + l.id, leadZeile(l))) || M.ANRUF_LOG.length > 0 || M.SPERRLISTE.some((e: any) => e.neu)
}

async function flush() {
  if (laeuft) { nochmal = true; return }
  laeuft = true; setStatus({ zustand: "speichert" })
  try {
    // 1. Leads (zuerst, wegen der Verweise)
    const leads = M.LEADS.filter((l: any) => anders("lead:" + l.id, leadZeile(l)))
    if (leads.length) {
      const zeilen = leads.map(leadZeile)
      const { error } = await sb.from("lead").upsert(zeilen)
      if (error) throw new Error(error.message)
      zeilen.forEach((z: any) => merke("lead:" + z.id, z))
    }
    // 2. Fotos nach dem Lead, dann Lead mit Pfaden nachziehen
    for (const l of M.LEADS as any[]) {
      if (await fotosHochladen(l)) {
        const z = leadZeile(l)
        const { error } = await sb.from("lead").update({ fotos: z.fotos }).eq("id", l.id)
        if (error) throw new Error(error.message)
        merke("lead:" + l.id, z)
      }
    }
    // 3. Kontakte
    const kontakte: any[] = []
    M.LEADS.forEach((l: any) => l.kontakte.forEach((k: any) => {
      if (!k.id) k.id = crypto.randomUUID()
      const z = kontaktZeile(l, k)
      if (anders("kontakt:" + k.id, z)) kontakte.push(z)
    }))
    if (kontakte.length) {
      const { error } = await sb.from("kontakt").upsert(kontakte)
      if (error) throw new Error(error.message)
      kontakte.forEach((z) => merke("kontakt:" + z.id, z))
    }
    // 4. Verlauf (nur neue Einträge)
    const verlauf: any[] = [], quelle: any[] = []
    M.LEADS.forEach((l: any) => l.verlauf.forEach((v: any) => {
      if (v._s) return
      if (!v.id) v.id = crypto.randomUUID()
      verlauf.push({ id: v.id, lead_id: l.id, profil_id: v.wer, datum: v.datum, art: v.art || "notiz", titel: v.titel, text: v.text || null }); quelle.push(v)
    }))
    if (verlauf.length) {
      const { error } = await sb.from("verlauf").upsert(verlauf)
      if (error) throw new Error(error.message)
      quelle.forEach((v) => (v._s = true))
    }
    // 5. Abschlüsse (darf nur die Geschäftsführung)
    const abschluesse = M.LEADS.filter((l: any) => l.abschluss && anders("abschluss:" + l.id, abschlussZeile(l))).map(abschlussZeile)
    if (abschluesse.length) {
      const { error } = await sb.from("abschluss").upsert(abschluesse)
      if (error) throw new Error(error.message)
      abschluesse.forEach((z: any) => merke("abschluss:" + z.lead_id, z))
    }
    // 6. Termine
    const termine = M.TERMINE.filter((t: any) => anders("termin:" + t.id, terminZeile(t))).map(terminZeile)
    if (termine.length) {
      const { error } = await sb.from("termin").upsert(termine)
      if (error) throw new Error(error.message)
      termine.forEach((z: any) => merke("termin:" + z.id, z))
    }
    // 7. Anrufe
    if (M.ANRUF_LOG.length) {
      const neu = M.ANRUF_LOG.splice(0, M.ANRUF_LOG.length)
      const { error } = await sb.from("anruf").insert(neu.map((a: any) => ({ id: a.id, lead_id: a.lead, profil_id: a.wer, zeit: a.zeit, ergebnis: a.ergebnis, einwand: a.einwand })))
      if (error) { M.ANRUF_LOG.unshift(...neu); throw new Error(error.message) }
    }
    // 8. Gebiete
    const units = new Set([...Object.keys(K.GEBIET), ...[...gespeichert.keys()].filter((k) => k.startsWith("gebiet:")).map((k) => k.slice(7))])
    const gebiete = [...units].map((u) => ({ unit: u, profil_id: K.GEBIET[u] || null })).filter((g) => anders("gebiet:" + g.unit, g.profil_id))
    if (gebiete.length) {
      const { error } = await sb.from("gebiet").upsert(gebiete)
      if (error) throw new Error(error.message)
      gebiete.forEach((g) => merke("gebiet:" + g.unit, g.profil_id))
    }
    // 9. Sperrliste
    for (const e of M.SPERRLISTE.filter((e: any) => e.neu) as any[]) {
      const { error } = await sb.rpc("sperre_eintragen", { p_telefon: e.telefon, p_email: e.email, p_firma: e.firma, p_grund: e.grund, p_lead: typeof e.lead === "string" ? e.lead : null })
      if (error) throw new Error(error.message)
      e.neu = false
    }
    setStatus({ zustand: "bereit", fehler: undefined, zuletzt: new Date() })
  } catch (e: any) {
    setStatus({ zustand: "fehler", fehler: uebersetzen(e.message || String(e)) })
  } finally {
    laeuft = false
    if (nochmal) { nochmal = false; flush() }
  }
}
function uebersetzen(m: string) {
  if (/row-level security|permission denied/i.test(m)) return "Dafür fehlen dir die Rechte."
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Keine Verbindung. Wird gespeichert, sobald du wieder online bist."
  if (/gewonnen/i.test(m)) return "Nur die Geschäftsführung kann einen Lead auf gewonnen setzen."
  return m
}
if (ECHT && typeof window !== "undefined") {
  window.addEventListener("online", () => spaeterSpeichern())
  window.addEventListener("beforeunload", (e) => { if (status.zustand !== "bereit" || offeneAenderungen()) { e.preventDefault() } })
}

/* ---------- Anmelden ---------- */
export async function anmelden(email: string, passwort: string) {
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: passwort })
  if (error) throw new Error(/invalid/i.test(error.message) ? "E-Mail oder Passwort stimmt nicht." : /banned/i.test(error.message) ? "Dieser Zugang ist gesperrt." : error.message)
  return data.session
}
export async function abmelden() { await sb.auth.signOut() }
export async function passwortAendern(neu: string) {
  const { error } = await sb.auth.updateUser({ password: neu, data: { passwort_aendern: false } })
  if (error) throw new Error(/should be different/i.test(error.message) ? "Bitte ein anderes Passwort als das bisherige nehmen." : /weak|at least/i.test(error.message) ? "Das Passwort ist zu schwach. Mindestens 8 Zeichen." : error.message)
}

/* ---------- Zugänge (Edge Function, nur Geschäftsführung) ---------- */
export async function zugang(body: any) {
  const { data, error } = await sb.functions.invoke("zugang", { body })
  if (error) {
    let m = error.message
    try { const j = await error.context?.json?.(); if (j?.fehler) m = j.fehler } catch (e) {}
    throw new Error(m)
  }
  if (data?.fehler) throw new Error(data.fehler)
  return data
}

/* ---------- Mandate ---------- */
export async function mandatSpeichern(m: any) {
  const zeile = {
    name: m.name, bereich: m.bereich, produkt: m.produkt || null, status: m.status, kondition: m.k, verguetung_text: m.ktext || null,
    hv_anteil: m.hv || 0, ansprechpartner: m.ap || {}, felder_schema: m.felder || [], seit: m.seit || null,
  }
  if (m.dbId) {
    const { error } = await sb.from("mandat").update(zeile).eq("id", m.dbId)
    if (error) throw new Error(uebersetzen(error.message))
    return m
  }
  const { data, error } = await sb.from("mandat").insert(zeile).select().single()
  if (error) throw new Error(uebersetzen(error.message))
  return { ...m, id: String(data.id), dbId: data.id }
}

/* ---------- Datenschutz ---------- */
export async function protokollLaden(filter: { tabelle?: string; datensatz?: string } = {}) {
  let q = sb.from("aenderung").select("*").order("zeit", { ascending: false }).limit(200)
  if (filter.tabelle) q = q.eq("tabelle", filter.tabelle)
  if (filter.datensatz) q = q.eq("datensatz", filter.datensatz)
  const { data, error } = await q
  if (error) throw new Error(uebersetzen(error.message))
  return data
}
export async function anonymisieren(art: "lead" | "kontakt", id: string, grund: string) {
  const { error } = await sb.rpc(art === "lead" ? "lead_anonymisieren" : "kontakt_anonymisieren", art === "lead" ? { p_lead: id, p_grund: grund } : { p_kontakt: id, p_grund: grund })
  if (error) throw new Error(uebersetzen(error.message))
}
