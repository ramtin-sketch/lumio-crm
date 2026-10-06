/* Echter Betrieb: Login, Daten laden, Änderungen automatisch speichern.
   Die App arbeitet weiter auf den Arrays im Modell. Nach jeder Änderung vergleicht flush()
   den Stand mit dem zuletzt gespeicherten und schickt nur das Geänderte an Supabase. */
import { createClient, type Session } from "@supabase/supabase-js"
import * as M from "@/model/model.js"
import * as K from "@/model/karte.js"
import * as D from "@/model/d2d.js"

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
  const [profile, mandate, leads, termine, anrufe, gebiete, sperren, objekte, auftraege, besuche, privat] = await Promise.all([
    alle("profil", "id, name, rolle, aktiv, erstellt_am, kurz, farbe, stadt, gebiet"),
    alle("mandat", "*", (q) => q.order("id")),
    alle("lead", "*, kontakt(*), verlauf(*), abschluss(*)"),
    alle("termin"),
    alle("anruf", "*", (q) => q.gte("zeit", seit)),
    alle("gebiet"),
    alle("sperrliste"),
    alle("objekt", "*, wohnung(*)"),
    alle("auftrag"),
    alle("besuch", "*", (q) => q.gte("zeit", seit)),
    // E-Mail, Telefon, Provision und D2D-Ausweis: nur eigene, die Geschäftsführung sieht alle
    sb.rpc("profil_privat").then(({ data, error }: any) => { if (error) throw new Error("profil: " + error.message); return data || [] }),
  ])
  const privatVon = new Map((privat as any[]).map((x: any) => [x.id, x]))
  profile.forEach((p: any) => Object.assign(p, privatVon.get(p.id) || {}))
  gespeichert.clear()

  const personen = profile.map((p: any, i: number) => ({
    id: p.id, name: (p.name || p.email || "?").split(" ")[0], voll: p.name || p.email, rolle: ROLLE_APP[p.rolle] || "setter", dbRolle: p.rolle,
    kurz: p.kurz || (p.name || "?").split(/\s+/).map((t: string) => t[0]).join("").slice(0, 2).toUpperCase(),
    farbe: p.farbe || FARBEN[i % FARBEN.length], stadt: p.stadt || null, gebiet: p.gebiet || "", email: p.email, aktiv: p.aktiv,
    seit: (p.erstellt_am || "").slice(0, 10), provisionsanteil: p.provisionsanteil, d2d: p.d2d || {},
  }))
  const mandatListe = mandate.map(mandatAus)
  const leadListe = leads.map(leadAus).filter((l: any) => mandatListe.some((m: any) => m.id === l.mandat))
  const terminListe = termine.map(terminAus)
  const tage = new Map<string, any>()
  anrufe.forEach((a: any) => {
    const d = a.zeit.slice(0, 10), key = a.profil_id + d
    if (!tage.has(key)) tage.set(key, { person: a.profil_id, datum: d, wahl: 0, erreicht: 0, termine: 0, einwaende: {} })
    const t = tage.get(key); t.wahl++
    if (a.ergebnis !== "nicht") t.erreicht++
    if (a.ergebnis === "termin") t.termine++
    if (a.einwand) t.einwaende[a.einwand] = (t.einwaende[a.einwand] || 0) + 1
  })
  const sperrListe = sperren.map(sperreAus)

  M.datenErsetzen({ personen, mandate: mandatListe, leads: leadListe, termine: terminListe, anrufTage: [...tage.values()], sperrliste: sperrListe })
  K.gebieteSetzen(gebiete)
  K.alleVerorten()
  D.datenErsetzen({
    objekte: objekte.map(objektAus),
    auftraege: auftraege.map(auftragAus),
    besuche: besuche.map(besuchAus),
  })

  // Stand merken, damit nur echte Änderungen gespeichert werden
  M.LEADS.forEach((l: any) => {
    merke("lead:" + l.id, leadZeile(l))
    l.kontakte.forEach((k: any) => merke("kontakt:" + k.id, kontaktZeile(l, k)))
    if (l.abschluss) merke("abschluss:" + l.id, abschlussZeile(l))
  })
  M.TERMINE.forEach((t: any) => merke("termin:" + t.id, terminZeile(t)))
  D.OBJEKTE.forEach((o: any) => { merke("objekt:" + o.id, objektZeile(o)); o.wohnungen.forEach((w: any) => merke("wohnung:" + w.id, wohnungZeile(o, w))) })
  D.AUFTRAEGE.forEach((a: any) => merke("auftrag:" + a.id, auftragZeile(a)))
  M.PERSONEN.forEach((p: any) => merke("d2d:" + p.id, p.d2d || {}))
  Object.keys(K.GEBIET).forEach((u) => merke("gebiet:" + u, K.GEBIET[u]))
  gebiete.forEach((g: any) => merke("gebiet:" + g.unit, g.profil_id))
  setStatus({ zustand: "bereit", fehler: undefined, zuletzt: new Date() })
  return { ich: session.user.id }
}
const num = (x: any) => (x === null || x === undefined ? undefined : Number(x))

/* ---------- Abbildung Datenbank → App ---------- */
const einzeln = (x: any) => (Array.isArray(x) ? x[0] : x) || null
const mandatAus = (m: any) => ({
  id: String(m.id), dbId: m.id, bereich: m.bereich, name: m.name, produkt: m.produkt || "", status: m.status, seit: m.seit,
  k: m.kondition || { typ: "offen" }, ktext: m.verguetung_text || "", hv: Number(m.hv_anteil) || 0,
  ap: m.ansprechpartner || {}, felder: Array.isArray(m.felder_schema) ? m.felder_schema : [],
})
function leadAus(r: any) {
  const ab = einzeln(r.abschluss)
  return {
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
}
const terminAus = (t: any) => ({ id: t.id, lead: t.lead_id, setter: t.setter_id, closer: t.closer_id, datum: t.datum, zeit: t.zeit, status: t.status, ergebnis: t.ergebnis })
const sperreAus = (e: any) => ({ id: e.id, telefon: e.telefon, email: e.email, firma: e.firma, grund: e.grund, lead: e.lead_id, datum: (e.erstellt_am || "").slice(0, 10), wer: e.erstellt_von })
const objektAus = (o: any) => ({
  id: o.id, mandat: String(o.mandat_id), strasse: o.strasse, hausnr: o.hausnr || "", plz: o.plz || "", ort: o.ort || "", stadt: o.stadt, unit: o.unit,
  geo: o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null, typ: o.typ, betreuer: o.betreuer_id, gesperrt: o.gesperrt, notiz: o.notiz,
  wohnungen: (o.wohnung || []).sort((a: any, b: any) => a.erstellt_am.localeCompare(b.erstellt_am) || a.name.localeCompare(b.name, "de", { numeric: true }))
    .map((w: any) => ({ id: w.id, name: w.name, status: w.status, versuche: w.versuche, wiederAm: w.wieder_am, notiz: w.notiz, letzterBesuch: w.letzter_besuch })),
})
const auftragAus = (a: any) => ({ id: a.id, objekt: a.objekt_id, wohnung: a.wohnung_id, mandat: String(a.mandat_id), wer: a.vertriebler_id, datum: a.datum, produkt: a.produkt,
  kunde: { name: a.kunde_name || "", tel: a.kunde_tel || "", mail: a.kunde_mail || "" }, felder: a.felder || {}, status: a.status, statusDatum: a.status_datum,
  partnerNr: a.partner_nr, provision: a.provision == null ? null : Number(a.provision), ausgezahlt: a.ausgezahlt, notiz: a.notiz })
const besuchAus = (b: any) => ({ id: b.id, wohnung: b.wohnung_id, objekt: b.objekt_id, wer: b.profil_id, zeit: b.zeit, ergebnis: b.ergebnis })

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

const objektZeile = (o: any) => ({ id: o.id, mandat_id: Number(o.mandat) || null, strasse: o.strasse, hausnr: o.hausnr || null, plz: o.plz || null, ort: o.ort || null,
  stadt: o.stadt || null, unit: o.unit || null, lat: o.geo?.lat ?? null, lng: o.geo?.lng ?? null, typ: o.typ || "mfh", betreuer_id: o.betreuer || null, gesperrt: !!o.gesperrt, notiz: o.notiz || null })
const wohnungZeile = (o: any, w: any) => ({ id: w.id, objekt_id: o.id, name: w.name, status: w.status, versuche: w.versuche || 0, wieder_am: w.wiederAm || null, notiz: w.notiz || null, letzter_besuch: w.letzterBesuch || null })
const auftragZeile = (a: any) => ({ id: a.id, objekt_id: a.objekt || null, wohnung_id: a.wohnung || null, mandat_id: Number(a.mandat), vertriebler_id: a.wer, datum: a.datum, produkt: a.produkt || null,
  kunde_name: a.kunde?.name || null, kunde_tel: a.kunde?.tel || null, kunde_mail: a.kunde?.mail || null, felder: a.felder || {}, status: a.status, status_datum: a.statusDatum || a.datum,
  partner_nr: a.partnerNr || null, provision: a.provision ?? null, ausgezahlt: !!a.ausgezahlt, notiz: a.notiz || null })

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
  return M.LEADS.some((l: any) => anders("lead:" + l.id, leadZeile(l))) || M.ANRUF_LOG.length > 0 || M.SPERRLISTE.some((e: any) => e.neu) || D.BESUCHE.some((b: any) => b.neu)
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
    // 9. Door-to-Door: Häuser, Wohnungen, Türbesuche, Aufträge, Freigaben
    const objekte = D.OBJEKTE.filter((o: any) => anders("objekt:" + o.id, objektZeile(o))).map(objektZeile)
    if (objekte.length) {
      const { error } = await sb.from("objekt").upsert(objekte)
      if (error) throw new Error(error.message)
      objekte.forEach((z: any) => merke("objekt:" + z.id, z))
    }
    const wohnungen: any[] = []
    D.OBJEKTE.forEach((o: any) => o.wohnungen.forEach((w: any) => { const z = wohnungZeile(o, w); if (anders("wohnung:" + w.id, z)) wohnungen.push(z) }))
    if (wohnungen.length) {
      const { error } = await sb.from("wohnung").upsert(wohnungen)
      if (error) throw new Error(error.message)
      wohnungen.forEach((z) => merke("wohnung:" + z.id, z))
    }
    const besuche = D.BESUCHE.filter((b: any) => b.neu)
    if (besuche.length) {
      const { error } = await sb.from("besuch").insert(besuche.map((b: any) => ({ id: b.id, wohnung_id: b.wohnung, objekt_id: b.objekt, profil_id: b.wer, zeit: b.zeit, ergebnis: b.ergebnis })))
      if (error) throw new Error(error.message)
      besuche.forEach((b: any) => (b.neu = false))
    }
    const auftraege = D.AUFTRAEGE.filter((a: any) => anders("auftrag:" + a.id, auftragZeile(a))).map(auftragZeile)
    if (auftraege.length) {
      // Einzeln speichern: Ein gesperrter (schon bestätigter) Auftrag soll die anderen nicht aufhalten
      let auftragFehler: string | null = null
      for (const z of auftraege) {
        const { error } = await sb.from("auftrag").upsert(z)
        if (error) { auftragFehler = /Geschäftsführung/.test(error.message) ? error.message : "Auftrag: " + error.message; merke("auftrag:" + z.id, z); continue }
        merke("auftrag:" + z.id, z)
      }
      if (auftragFehler) throw new Error(auftragFehler)
    }
    for (const p of M.PERSONEN as any[]) {
      if (!anders("d2d:" + p.id, p.d2d || {})) continue
      const { error } = await sb.from("profil").update({ d2d: p.d2d || {} }).eq("id", p.id)
      if (error) throw new Error(error.message)
      merke("d2d:" + p.id, p.d2d || {})
    }
    // 10. Sperrliste
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
  if (error) throw new Error(/invalid/i.test(error.message) ? "E-Mail oder Passwort stimmt nicht." : /banned/i.test(error.message) ? "Dieser Zugang ist gesperrt." : /rate|too many/i.test(error.message) ? "Zu viele Versuche. Bitte ein paar Minuten warten." : error.message)
  aktivitaetMerken()
  return data.session
}
export async function abmelden() { await sb.auth.signOut() }
/* Auf allen Handys und Rechnern abmelden (z. B. wenn ein Gerät verloren ging) */
export async function ueberallAbmelden() { await sb.auth.signOut({ scope: "global" }) }

/* ---------- Automatisch abmelden nach 12 Stunden ohne Nutzung ---------- */
const ZULETZT = "lumio-zuletzt"
export const ABMELDEN_NACH_STUNDEN = 12
export function aktivitaetMerken() { try { localStorage.setItem(ZULETZT, String(Date.now())) } catch (e) {} }
export function zuLangeWeg() {
  try { const z = Number(localStorage.getItem(ZULETZT) || 0); return z > 0 && Date.now() - z > ABMELDEN_NACH_STUNDEN * 3600 * 1000 } catch (e) { return false }
}

/* ---------- Zwei-Faktor-Anmeldung (Code aus einer Authenticator-App) ---------- */
export async function zweifaktorStand() {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return { stufe: null, ziel: null, faktoren: [] as any[] }
  const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
  if (error) throw new Error(error.message)
  const { data: f } = await sb.auth.mfa.listFactors()
  return { stufe: data.currentLevel, ziel: data.nextLevel, faktoren: (f?.totp || []) as any[] }
}
export async function zweifaktorPflicht() {
  const { data, error } = await sb.rpc("zweifaktor_pflicht")
  if (error) throw new Error(error.message)
  return !!data
}
export async function zweifaktorStarten() {
  const { data: f } = await sb.auth.mfa.listFactors()
  for (const x of (f?.all || []).filter((x: any) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: x.id })
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", issuer: "LUMIO", friendlyName: "Handy " + new Date().toISOString().slice(0, 16).replace("T", " ") })
  if (error) throw new Error(error.message)
  return { id: data.id as string, qr: data.totp.qr_code as string, geheim: data.totp.secret as string, uri: data.totp.uri as string }
}
export async function zweifaktorBestaetigen(factorId: string, code: string) {
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, "") })
  if (error) throw new Error(/invalid|expired|code/i.test(error.message) ? "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben." : /rate|too many/i.test(error.message) ? "Zu viele Versuche. Bitte kurz warten." : error.message)
  aktivitaetMerken()
}
/* Alte Handys entfernen, nachdem ein neues eingerichtet wurde */
export async function andereFaktorenEntfernen(behalten: string) {
  const { data: f } = await sb.auth.mfa.listFactors()
  for (const x of (f?.all || []).filter((x: any) => x.id !== behalten)) await sb.auth.mfa.unenroll({ factorId: x.id })
}
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

/* ---------- Sicherheit (nur Geschäftsführung) ---------- */
export async function teamSicherheit() {
  const { data, error } = await sb.rpc("team_sicherheit")
  if (error) throw new Error(uebersetzen(error.message))
  return (data || []) as { id: string; hat_faktor: boolean; pflicht: boolean; letzte_anmeldung: string | null; sitzungen: number }[]
}
export async function pflichtSetzen(id: string, wert: boolean) {
  const { error } = await sb.from("profil").update({ zweifaktor_pflicht: wert }).eq("id", id)
  if (error) throw new Error(uebersetzen(error.message))
}
export async function hinweiseLaden(tage = 30) {
  const { data, error } = await sb.rpc("sicherheit_hinweise", { p_tage: tage })
  if (error) throw new Error(uebersetzen(error.message))
  return (data || []) as { zeit: string; stufe: "info" | "warnung"; art: string; profil_id: string | null; text: string }[]
}
export async function anmeldungenLaden() {
  const { data, error } = await sb.from("anmeldung").select("*").order("zeit", { ascending: false }).limit(100)
  if (error) throw new Error(uebersetzen(error.message))
  return data as any[]
}
export async function sicherungenLaden() {
  const { data, error } = await sb.from("sicherung").select("id, erstellt_am, art, erstellt_von, tabellen, groesse_kb").order("erstellt_am", { ascending: false }).limit(30)
  if (error) throw new Error(uebersetzen(error.message))
  return data as any[]
}
export async function sicherungErstellen() {
  const { error } = await sb.rpc("sicherung_erstellen")
  if (error) throw new Error(uebersetzen(error.message))
}
export async function sicherungHerunterladen(id: number) {
  const { data, error } = await sb.from("sicherung").select("erstellt_am, daten").eq("id", id).single()
  if (error) throw new Error(uebersetzen(error.message))
  if (!data?.daten) throw new Error("Diese Sicherung ist schon älter als 14 Tage und nicht mehr vollständig vorhanden.")
  const name = "LUMIO-Sicherung-" + String(data.erstellt_am).slice(0, 16).replace(/[T:]/g, "-") + ".json"
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ erstellt_am: data.erstellt_am, ...data.daten }, null, 1)], { type: "application/json" }))
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export async function exportMelden(art: string, anzahl: number) {
  if (!ECHT) return
  try { await sb.rpc("export_melden", { p_art: art, p_anzahl: anzahl }) } catch (e) {}
}

/* ---------- Live: Änderungen der anderen sofort übernehmen ----------
   Supabase schickt jede Änderung an alle offenen Geräte, aber nur an die, die den Datensatz sehen dürfen.
   Eigene Änderungen werden übersprungen (sind schon da). Leads und Häuser werden komplett frisch geholt,
   damit Ansprechpartner, Verlauf und Wohnungen stimmen. */
const LIVE_TABELLEN = ["lead", "kontakt", "verlauf", "abschluss", "termin", "anruf", "gebiet", "sperrliste", "objekt", "wohnung", "besuch", "auftrag", "mandat"]
let kanal: any = null, liveIch = "", liveZeichnen: () => void = () => {}, liveTimer: any = null, warGetrennt = false, nachladenTimer: any = null
let liveZustand: "aus" | "verbinde" | "live" | "getrennt" = "aus"
export const liveStand = () => liveZustand
const setLive = (z: typeof liveZustand) => { liveZustand = z; hoerer.forEach((f) => f()) }
const leadWarteschlange = new Map<string, Set<string>>()
const objektWarteschlange = new Map<string, Set<string>>()
const einzelne: { t: string; r: any; wer: string | null; art: string }[] = []

export function liveStarten(ich: string, zeichnen: () => void) {
  liveStoppen()
  liveIch = ich; liveZeichnen = zeichnen
  sb.auth.getSession().then(({ data }: any) => {
    if (!data.session) return
    sb.realtime.setAuth(data.session.access_token)
    kanal = sb.channel("lumio-live")
    for (const t of LIVE_TABELLEN) kanal.on("postgres_changes", { event: "*", schema: "public", table: t }, (p: any) => eingang(t, p))
    setLive("verbinde")
    kanal.subscribe((st: string) => {
      if (st === "SUBSCRIBED") {
        const nachholen = warGetrennt; warGetrennt = false
        setLive("live")
        if (nachholen) allesNachladen()   // was während der Funkstille passiert ist
      } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
        if (kanal) { warGetrennt = true; setLive("getrennt") }
      }
    })
    // Sicherheitsnetz: alle 15 Minuten alles frisch laden, wenn nichts Ungespeichertes offen ist
    clearInterval(nachladenTimer)
    nachladenTimer = setInterval(allesNachladen, 15 * 60000)
  })
}
export function liveStoppen() {
  clearInterval(nachladenTimer); clearTimeout(liveTimer); liveTimer = null
  const k = kanal; kanal = null
  if (k) sb.removeChannel(k)
  leadWarteschlange.clear(); objektWarteschlange.clear(); einzelne.length = 0
  if (liveZustand !== "aus") setLive("aus")
}
async function allesNachladen() {
  if (laeuft || offeneAenderungen() || status.zustand !== "bereit") return
  const { data } = await sb.auth.getSession()
  if (!data.session) return
  try { await laden(data.session); liveZeichnen() } catch (e) {}
}

function eingang(t: string, p: any) {
  const neu = p.new && Object.keys(p.new).length ? p.new : null
  const r = neu || p.old || {}
  const wer: string | null = r.geaendert_von || r.profil_id || r.erstellt_von || null
  const merkeIn = (m: Map<string, Set<string>>, id: string) => { if (!m.has(id)) m.set(id, new Set()); m.get(id)!.add(wer || "?") }
  if (t === "lead" || t === "kontakt" || t === "verlauf" || t === "abschluss") { const id = t === "lead" ? r.id : r.lead_id; if (id) merkeIn(leadWarteschlange, id) }
  else if (t === "objekt" || t === "wohnung") { const id = t === "objekt" ? r.id : r.objekt_id; if (id) merkeIn(objektWarteschlange, id) }
  else if (neu) einzelne.push({ t, r: neu, wer, art: p.eventType })
  if (!liveTimer) liveTimer = setTimeout(verarbeiten, 300)
}
const fremdeVon = (s: Set<string>) => [...s].filter((w) => w !== liveIch)
const hinweis = (art: string, id: string, wer: string) => { try { window.dispatchEvent(new CustomEvent("lumio-live", { detail: { art, id, wer } })) } catch (e) {} }

async function verarbeiten() {
  liveTimer = null
  if (laeuft) { liveTimer = setTimeout(verarbeiten, 500); return }   // erst die eigenen Änderungen fertig speichern
  let geaendert = false
  const spaeter = (m: Map<string, Set<string>>, id: string, s: Set<string>) => { m.set(id, s); if (!liveTimer) liveTimer = setTimeout(verarbeiten, 800) }

  // Leads (mit Ansprechpartnern, Verlauf, Abschluss)
  const leads = [...leadWarteschlange].filter(([, s]) => fremdeVon(s).length); leadWarteschlange.clear()
  if (leads.length) {
    const { data, error } = await sb.from("lead").select("*, kontakt(*), verlauf(*), abschluss(*)").in("id", leads.map(([id]) => id))
    if (!error) for (const [id, s] of leads) {
      const vorhanden = M.LEADS.find((l: any) => l.id === id)
      if (vorhanden && (anders("lead:" + id, leadZeile(vorhanden)) || vorhanden.kontakte.some((k: any) => anders("kontakt:" + k.id, kontaktZeile(vorhanden, k))))) { spaeter(leadWarteschlange, id, s); continue }
      const r = (data || []).find((x: any) => x.id === id)
      const i = M.LEADS.findIndex((l: any) => l.id === id)
      if (!r || !M.MANDATE.some((m: any) => m.id === String(r.mandat_id))) { if (i >= 0) { M.LEADS.splice(i, 1); geaendert = true } continue }
      const l: any = leadAus(r)
      if (l.bereich === "standort") K.verorten(l)
      if (i >= 0) Object.assign(M.LEADS[i], l); else (M.LEADS as any[]).push(l)
      merke("lead:" + id, leadZeile(l)); l.kontakte.forEach((k: any) => merke("kontakt:" + k.id, kontaktZeile(l, k)))
      if (l.abschluss) merke("abschluss:" + id, abschlussZeile(l))
      geaendert = true
      hinweis("lead", id, fremdeVon(s)[0])
    }
  }

  // Häuser mit Wohnungen
  const objekte = [...objektWarteschlange].filter(([, s]) => fremdeVon(s).length); objektWarteschlange.clear()
  if (objekte.length) {
    const { data, error } = await sb.from("objekt").select("*, wohnung(*)").in("id", objekte.map(([id]) => id))
    if (!error) for (const [id, s] of objekte) {
      const vorhanden = D.OBJEKTE.find((o: any) => o.id === id)
      if (vorhanden && (anders("objekt:" + id, objektZeile(vorhanden)) || vorhanden.wohnungen.some((w: any) => anders("wohnung:" + w.id, wohnungZeile(vorhanden, w))))) { spaeter(objektWarteschlange, id, s); continue }
      const r = (data || []).find((x: any) => x.id === id)
      const i = D.OBJEKTE.findIndex((o: any) => o.id === id)
      if (!r) { if (i >= 0) { D.OBJEKTE.splice(i, 1); geaendert = true } continue }
      const o: any = objektAus(r); D.verorten(o)
      if (i >= 0) Object.assign(D.OBJEKTE[i], o); else (D.OBJEKTE as any[]).push(o)
      merke("objekt:" + id, objektZeile(o)); o.wohnungen.forEach((w: any) => merke("wohnung:" + w.id, wohnungZeile(o, w)))
      geaendert = true
      hinweis("objekt", id, fremdeVon(s)[0])
    }
  }

  // Alles andere direkt aus der Nachricht
  for (const { t, r, wer, art } of einzelne.splice(0)) {
    if (wer && wer === liveIch) continue
    if (t === "termin") {
      const x = terminAus(r), i = M.TERMINE.findIndex((y: any) => y.id === x.id)
      if (i >= 0) Object.assign(M.TERMINE[i], x); else (M.TERMINE as any[]).push(x)
      merke("termin:" + x.id, terminZeile(x))
    } else if (t === "mandat") {
      const x = mandatAus(r), i = M.MANDATE.findIndex((y: any) => y.id === x.id)
      if (i >= 0) Object.assign(M.MANDATE[i], x); else (M.MANDATE as any[]).push(x)
    } else if (t === "gebiet") {
      if (r.profil_id) K.GEBIET[r.unit] = r.profil_id; else delete K.GEBIET[r.unit]
      merke("gebiet:" + r.unit, r.profil_id || undefined)
    } else if (t === "sperrliste") {
      if (!M.SPERRLISTE.some((e: any) => e.id === r.id)) (M.SPERRLISTE as any[]).push(sperreAus(r))
    } else if (t === "anruf" && art === "INSERT") {
      const tg = M.anrufTag(r.profil_id, String(r.zeit).slice(0, 10)); tg.wahl++
      if (r.ergebnis !== "nicht") tg.erreicht++
      if (r.ergebnis === "termin") tg.termine++
      if (r.einwand) tg.einwaende[r.einwand] = (tg.einwaende[r.einwand] || 0) + 1
    } else if (t === "besuch") {
      if (!D.BESUCHE.some((b: any) => b.id === r.id)) (D.BESUCHE as any[]).push(besuchAus(r))
    } else if (t === "auftrag") {
      const x = auftragAus(r), i = D.AUFTRAEGE.findIndex((y: any) => y.id === x.id)
      if (i >= 0) Object.assign(D.AUFTRAEGE[i], x); else (D.AUFTRAEGE as any[]).push(x)
      merke("auftrag:" + x.id, auftragZeile(x))
      hinweis("auftrag", x.id, wer || "")
    } else continue
    geaendert = true
  }
  if (geaendert) liveZeichnen()
}
