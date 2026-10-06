/* Door-to-Door: Gebäude mit Wohnungen, Besuche an der Tür, Aufträge mit Statuskette und Provision.
   PŸUR: Mehrfamilienhäuser, jede Wohnung zählt. TNG: Einfamilienhäuser, Ansprechpartner ist der Eigentümer. */
import * as M from './model.js';
import * as K from './karte.js';

export const OBJEKTE = [];   // { id, mandat, strasse, hausnr, plz, ort, stadt, unit, geo, typ, betreuer, gesperrt, notiz, wohnungen: [...] }
export const AUFTRAEGE = []; // { id, objekt, wohnung, mandat, wer, datum, produkt, kunde:{name,tel,mail}, felder, status, statusDatum, partnerNr, provision, ausgezahlt, notiz }
export const BESUCHE = [];   // { id, wohnung, objekt, wer, zeit, ergebnis, neu }

export const TUER = [
  { id: 'offen',   name: 'Noch nicht besucht', kurz: 'offen',       farbe: '#94a3b8' },
  { id: 'nicht',   name: 'Nicht angetroffen',  kurz: 'nicht da',    farbe: '#f59f00' },
  { id: 'wieder',  name: 'Wiederkommen',       kurz: 'wiederkommen', farbe: '#3b5bdb' },
  { id: 'kein',    name: 'Kein Interesse',     kurz: 'kein Interesse', farbe: '#868e96' },
  { id: 'kunde',   name: 'Schon Kunde',        kurz: 'schon Kunde', farbe: '#12b886' },
  { id: 'auftrag', name: 'Auftrag',            kurz: 'Auftrag',     farbe: '#2f9e44' },
  { id: 'sperre',  name: 'Keine Vertreter',    kurz: 'gesperrt',    farbe: '#e03131' },
];
export const tuer = id => TUER.find(t => t.id === id);

/* Statuskette eines Auftrags. Provision wird mit "geschaltet" fällig. */
export const STATUS = [
  { id: 'erfasst',     name: 'Erfasst',               schritt: 1 },
  { id: 'bestaetigt',  name: 'Bestätigungsanruf ok',  schritt: 2 },
  { id: 'eingereicht', name: 'Beim Partner',          schritt: 3 },
  { id: 'geschaltet',  name: 'Geschaltet',            schritt: 4 },
  { id: 'widerrufen',  name: 'Widerrufen',            ende: true },
  { id: 'storniert',   name: 'Storniert',             ende: true },
];
export const statusVon = id => STATUS.find(s => s.id === id);
export const WIDERRUF_TAGE = 14;

const neueId = (p) => (M.MODUS.echt ? crypto.randomUUID() : p + Math.random().toString(36).slice(2, 9));
export const mandateD2D = () => M.MANDATE.filter(m => m.bereich === 'd2d');
export const objekt = id => OBJEKTE.find(o => o.id === id);
export const adresse = o => [o.strasse, o.hausnr].filter(Boolean).join(' ') + (o.ort ? ', ' + (o.plz ? o.plz + ' ' : '') + o.ort : '');
export const widerrufBis = a => { const d = new Date(a.datum); d.setDate(d.getDate() + WIDERRUF_TAGE); return M.iso(d); };

/* Provision je Auftrag aus dem Mandat: fix je Auftrag, Anteil Vertriebler, Rückhalt bis Ende Stornofrist */
export function provisionVon(a) {
  const m = M.mandat(a.mandat); if (!m) return { lumio: 0, hv: 0, rueckhalt: 0, auszahlbar: 0 };
  const lumio = a.provision ?? (m.k && m.k.typ === 'fix' ? (m.k.betrag || 0) : 0);
  const hv = lumio * (m.hv || 0) / 100;
  const quote = (m.k && m.k.rueckhalt != null ? m.k.rueckhalt : 20) / 100;
  const fristMon = m.k && m.k.stornofrist != null ? m.k.stornofrist : 6;
  const ende = new Date(a.statusDatum || a.datum); ende.setMonth(ende.getMonth() + fristMon);
  const fristVorbei = M.iso(ende) <= M.HEUTE;
  const rueckhalt = fristVorbei ? 0 : hv * quote;
  return { lumio, hv, rueckhalt, auszahlbar: hv - rueckhalt, fristEnde: M.iso(ende) };
}

/* ---------- Aktionen ---------- */
export function tuerErgebnis(o, w, wer, erg, x) {
  x = x || {};
  w.status = erg === 'nicht' ? 'nicht' : erg;
  if (erg === 'nicht') w.versuche = (w.versuche || 0) + 1;
  w.letzterBesuch = new Date().toISOString();
  w.wiederAm = erg === 'wieder' ? x.wiederAm || null : null;
  if (x.notiz) w.notiz = x.notiz;
  BESUCHE.push({ id: neueId('b'), wohnung: w.id, objekt: o.id, wer, zeit: new Date().toISOString(), ergebnis: erg, neu: true });
  if (erg === 'sperre') {
    M.sperreHinzu({ firma: adresse(o) + ' · ' + w.name, grund: 'Keine Vertreter', wer });
    return 'Gesperrt. Hier klingelt niemand mehr.';
  }
  return ({ nicht: 'Nicht angetroffen (' + w.versuche + '. Versuch).', kein: 'Kein Interesse notiert.', wieder: 'Wiederkommen eingetragen.', kunde: 'Schon Kunde notiert.' })[erg] || 'Gespeichert.';
}

export function auftragAnlegen(o, w, wer, d) {
  const a = {
    id: neueId('a'), objekt: o.id, wohnung: w ? w.id : null, mandat: d.mandat || o.mandat, wer, datum: M.HEUTE,
    produkt: d.produkt || null, kunde: { name: d.name || '', tel: d.tel || '', mail: d.mail || '' }, felder: d.felder || {},
    status: 'erfasst', statusDatum: M.HEUTE, partnerNr: null, provision: null, ausgezahlt: false, notiz: d.notiz || null,
  };
  AUFTRAEGE.push(a);
  if (w) {
    w.status = 'auftrag'; w.letzterBesuch = new Date().toISOString(); w.wiederAm = null;
    BESUCHE.push({ id: neueId('b'), wohnung: w.id, objekt: o.id, wer, zeit: new Date().toISOString(), ergebnis: 'auftrag', neu: true });
  }
  return a;
}

export function auftragStatus(a, status, x) {
  a.status = status; a.statusDatum = M.HEUTE;
  if (x && x.partnerNr != null) a.partnerNr = x.partnerNr;
  if (status === 'widerrufen' || status === 'storniert') {
    const w = objekt(a.objekt)?.wohnungen.find(w => w.id === a.wohnung);
    if (w) w.status = 'kein';
  }
  return 'Auftrag: ' + statusVon(status).name;
}

export function objektAnlegen(d, wer) {
  const o = {
    id: neueId('o'), mandat: d.mandat, strasse: d.strasse, hausnr: d.hausnr || '', plz: d.plz || '', ort: d.ort || '',
    geo: d.geo || null, typ: d.typ || (Number(d.we) > 2 ? 'mfh' : 'efh'), betreuer: d.betreuer || wer, gesperrt: false, notiz: d.notiz || null,
    wohnungen: [], neu: true,
  };
  const n = Math.max(1, Number(d.we) || 1);
  for (let i = 0; i < n; i++) o.wohnungen.push({ id: neueId('w'), name: n === 1 ? 'Haus' : 'Wohnung ' + (i + 1), status: 'offen', versuche: 0 });
  verorten(o);
  OBJEKTE.push(o);
  return o;
}
export function wohnungDazu(o, name) {
  const w = { id: neueId('w'), name: name || 'Wohnung ' + (o.wohnungen.length + 1), status: 'offen', versuche: 0 };
  o.wohnungen.push(w);
  return w;
}
export function verorten(o) {
  if (o.geo) { const u = K.unitAt(o.geo.lat, o.geo.lng); o.unit = u ? u.id : null; o.stadt = u ? u.stadt : null; }
}

/* ---------- Kennzahlen ---------- */
const istGespraech = e => ['kein', 'wieder', 'kunde', 'auftrag'].includes(e);
export function kennzahlen(filter) {
  const bs = BESUCHE.filter(b => !filter || filter(b));
  const tueren = bs.length, gespraeche = bs.filter(b => istGespraech(b.ergebnis)).length;
  const auftraege = bs.filter(b => b.ergebnis === 'auftrag').length;
  const tage = new Set(bs.map(b => b.wer + b.zeit.slice(0, 10))).size || 1;
  // Türen pro Stunde: je Person und Tag die Spanne zwischen erstem und letztem Klingeln
  const spannen = {}; bs.forEach(b => { const k = b.wer + b.zeit.slice(0, 10); const t = new Date(b.zeit).getTime(); spannen[k] = spannen[k] ? [Math.min(spannen[k][0], t), Math.max(spannen[k][1], t), spannen[k][2] + 1] : [t, t, 1]; });
  const stunden = Object.values(spannen).reduce((s, [a, b]) => s + Math.max(0.5, (b - a) / 3600000), 0);
  return { tueren, gespraeche, auftraege, proStunde: stunden ? tueren / stunden : 0, pro100: tueren ? auftraege / tueren * 100 : 0, tage };
}
export function abdeckung(os) {
  const w = os.flatMap(o => o.wohnungen);
  return { gesamt: w.length, besucht: w.filter(x => x.status !== 'offen').length, kunden: w.filter(x => x.status === 'kunde' || x.status === 'auftrag').length };
}
export function stornoQuote(wer) {
  const as = AUFTRAEGE.filter(a => !wer || a.wer === wer);
  const fertig = as.filter(a => ['geschaltet', 'widerrufen', 'storniert'].includes(a.status));
  return fertig.length ? fertig.filter(a => a.status !== 'geschaltet').length / fertig.length : null;
}
export const istFreigegeben = (p, mandatId) => !!(p && p.d2d && (p.d2d.freigaben || []).includes(String(mandatId)));

/* ---------- Echte Daten übernehmen ---------- */
export function datenErsetzen(d) {
  OBJEKTE.splice(0, OBJEKTE.length, ...d.objekte);
  AUFTRAEGE.splice(0, AUFTRAEGE.length, ...d.auftraege);
  BESUCHE.splice(0, BESUCHE.length, ...d.besuche);
  OBJEKTE.forEach(verorten);
}

/* ---------- Demo: PŸUR in Berlin (Mehrfamilienhäuser), TNG in Kiel (Einfamilienhäuser) ---------- */
function demo() {
  if (M.MODUS.echt || OBJEKTE.length) return;
  if (typeof location !== 'undefined' && (location.hostname.endsWith('github.io') || /[?&]echt\b/.test(location.search))) return;
  let seed = 4711; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = a => a[Math.floor(r() * a.length)];
  M.MANDATE.push(
    { id: 'm8', bereich: 'd2d', name: 'PŸUR', produkt: 'Internet, TV und Telefon im Mehrfamilienhaus', status: 'aktiv', seit: M.tag(-21),
      k: { typ: 'fix', betrag: 90, rueckhalt: 20, stornofrist: 6, produkte: ['Pure Speed 250', 'Pure Speed 500', 'Pure Speed 1000', 'TV-Paket', 'Kombi Internet + TV'] }, ktext: 'Demo-Werte: 90 € je geschaltetem Auftrag, 20 % Rückhalt bis 6 Monate nach Schaltung.', hv: 50,
      ap: { name: 'Agenturvertrieb Field Sales', funktion: 'PŸUR' },
      felder: [{ key: 'anbieter', label: 'Bisheriger Anbieter', typ: 'text' }, { key: 'mitnahme', label: 'Rufnummer mitnehmen', typ: 'text' }, { key: 'etage', label: 'Etage / Lage', typ: 'text' }] },
    { id: 'm9', bereich: 'd2d', name: 'TNG Stadtnetz', produkt: 'Glasfaser im Einfamilienhaus', status: 'verhandlung', seit: null,
      k: { typ: 'fix', betrag: 150, rueckhalt: 20, stornofrist: 6, produkte: ['Glasfaser 300', 'Glasfaser 600', 'Glasfaser 1000'] }, ktext: 'Demo-Werte: 150 € je geschaltetem Anschluss. Konditionen noch offen.', hv: 50,
      ap: { name: 'Vertrieb Norddeutschland', funktion: 'TNG' },
      felder: [{ key: 'eigentuemer', label: 'Eigentümer (ja/nein)', typ: 'text' }, { key: 'hausanschluss', label: 'Hausanschluss vorhanden', typ: 'text' }, { key: 'leitung', label: 'Leitungslänge m', typ: 'zahl' }] },
  );
  const deniz = M.person('deniz'), tim = M.person('tim');
  if (deniz) deniz.d2d = { ausweis: 'LU-0042', schulung: M.tag(-30), freigaben: ['m8'] };
  if (tim) tim.d2d = { ausweis: 'LU-0017', schulung: M.tag(-40), freigaben: ['m9'] };

  const strassenB = [['Koppenstraße', 52.5110, 13.4330], ['Singerstraße', 52.5140, 13.4235], ['Lichtenberger Straße', 52.5145, 13.4280], ['Holzmarktstraße', 52.5112, 13.4250],
    ['Fischerinsel', 52.5110, 13.4060], ['Annenstraße', 52.5090, 13.4160], ['Wallstraße', 52.5120, 13.4080], ['Neue Grünstraße', 52.5100, 13.4070]];
  const strassenK = [['Wiker Straße', 54.3480, 10.1300], ['Holtenauer Straße', 54.3420, 10.1330], ['Projensdorfer Straße', 54.3520, 10.1180], ['Feldstraße', 54.3360, 10.1360], ['Düppelstraße', 54.3300, 10.1300]];
  const jetzt = Date.now();
  const besuchen = (o, w, tageZurueck, erg) => {
    const tag = new Date(jetzt - tageZurueck * 86400000); tag.setHours(16, 0, 0, 0);
    const zeit = new Date(Math.min(jetzt - 60000, tag.getTime() + Math.floor(r() * 70) * 60000)).toISOString();
    BESUCHE.push({ id: neueId('b'), wohnung: w.id, objekt: o.id, wer: o.betreuer, zeit, ergebnis: erg });
    w.status = erg; w.letzterBesuch = zeit;
    if (erg === 'nicht') w.versuche = (w.versuche || 0) + 1;
    if (erg === 'wieder') { const d = new Date(jetzt + Math.floor(r() * 3) * 86400000); d.setHours(17 + Math.floor(r() * 3), 0, 0, 0); w.wiederAm = d.toISOString(); }
  };
  const ergebnisse = ['nicht', 'nicht', 'nicht', 'kein', 'kein', 'wieder', 'kunde', 'kunde', 'auftrag'];
  const produkte = { m8: ['Pure Speed 250', 'Pure Speed 500', 'Kombi Internet + TV'], m9: ['Glasfaser 300', 'Glasfaser 600'] };
  const namen = ['Schulz', 'Yilmaz', 'Nowak', 'Becker', 'Fischer', 'Kowalski', 'Wagner', 'Hoffmann', 'Kaya', 'Richter', 'Petrović', 'Klein'];
  const anlegen = (mid, betreuer, strassen, mfh) => strassen.forEach(([s, la, lo], si) => {
    const anzahl = mfh ? 2 : 4;
    for (let h = 0; h < anzahl; h++) {
      const o = objektAnlegen({ mandat: mid, strasse: s, hausnr: String(1 + si * 3 + h * 2), plz: mfh ? '10179' : '24106', ort: mfh ? 'Berlin' : 'Kiel',
        geo: { lat: la + (r() - 0.5) * 0.002, lng: lo + (r() - 0.5) * 0.003 }, we: mfh ? 8 + Math.floor(r() * 24) : 1, betreuer }, betreuer);
      o.neu = false;
      const besuchtBis = mfh ? Math.floor(o.wohnungen.length * (0.2 + r() * 0.7)) : (r() < 0.75 ? 1 : 0);
      o.wohnungen.forEach((w, i) => {
        w.name = mfh ? (['EG', '1. OG', '2. OG', '3. OG', '4. OG', '5. OG', '6. OG'][Math.floor(i / 4)] || (Math.floor(i / 4)) + '. OG') + ' ' + ['links', 'Mitte links', 'Mitte rechts', 'rechts'][i % 4] : 'Haus';
        if (i >= besuchtBis) return;
        const erg = pick(ergebnisse);
        besuchen(o, w, Math.floor(r() * 5), erg === 'auftrag' ? 'kein' : erg);
        if (erg === 'auftrag') {
          const tz = Math.floor(r() * 40);
          const a = auftragAnlegen(o, w, betreuer, { mandat: mid, produkt: pick(produkte[mid]), name: 'Frau/Herr ' + pick(namen) });
          a.datum = M.tag(-tz); a.statusDatum = a.datum;
          const st = tz > 25 ? pick(['geschaltet', 'geschaltet', 'geschaltet', 'geschaltet', 'geschaltet', 'storniert']) : tz > 14 ? pick(['eingereicht', 'geschaltet', 'geschaltet', 'eingereicht', 'widerrufen']) : tz > 3 ? pick(['bestaetigt', 'eingereicht']) : 'erfasst';
          a.status = st; a.statusDatum = M.tag(-Math.max(0, tz - 10));
          if (st !== 'erfasst' && st !== 'bestaetigt') a.partnerNr = (mid === 'm8' ? 'PY-' : 'TNG-') + (100000 + Math.floor(r() * 899999));
          BESUCHE[BESUCHE.length - 1].zeit = new Date(jetzt - tz * 86400000 - 3 * 3600000).toISOString();
          if (st === 'widerrufen' || st === 'storniert') w.status = 'kein';
        }
      });
    }
  });
  anlegen('m8', 'deniz', strassenB, true);
  anlegen('m9', 'tim', strassenK, false);
  // Ein Haus mit "Keine Werbung"
  const g = OBJEKTE[3]; if (g) { g.wohnungen[0].status = 'sperre'; }
  OBJEKTE.forEach(o => { o.neu = false; o.wohnungen.forEach(w => { w.neu = false; }); });
  BESUCHE.forEach(b => { b.neu = false; });
  AUFTRAEGE.forEach(a => { a.neu = false; });
}
demo();
