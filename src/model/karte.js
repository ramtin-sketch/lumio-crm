/* Karte: Gebiete aus Stadtteilen, Koordinaten der Standorte, Erfassung vor Ort.
   Stadtteilgrenzen: Hamburg und Berlin je Stadtteil/Ortsteil, Kiel als Stadt plus Umland-Kreise. */
import GEO from './geo.json';
import * as M from './model.js';

export const STAEDTE = [
  { id: 'hamburg', name: 'Hamburg' },
  { id: 'berlin', name: 'Berlin' },
  { id: 'kiel', name: 'Kiel' }
];

/* ---------- Gebietsbausteine ---------- */
const KIEL_UMLAND = u => u.stadt === 'kiel' && u.name !== 'Kiel';
export const UNITS = GEO.units.filter(u => !KIEL_UMLAND(u)).map(u => {
  let s = 90, w = 180, n = -90, e = -180;
  u.g.forEach(poly => poly[0].forEach(([la, lo]) => { if (la < s) s = la; if (la > n) n = la; if (lo < w) w = lo; if (lo > e) e = lo; }));
  return Object.assign(u, { bbox: [s, w, n, e] });
});
export const KONTEXT = GEO.ctx.concat(GEO.units.filter(KIEL_UMLAND).map(u => ({ name: u.name, g: u.g })));
export const unit = id => UNITS.find(u => u.id === id);

function inRing(lat, lng, ring){
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++){
    const [y1, x1] = ring[i], [y2, x2] = ring[j];
    if ((y1 > lat) !== (y2 > lat) && lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) ins = !ins;
  }
  return ins;
}
function inUnit(lat, lng, u){
  const [s, w, n, e] = u.bbox;
  if (lat < s || lat > n || lng < w || lng > e) return false;
  return u.g.some(poly => inRing(lat, lng, poly[0]) && !poly.slice(1).some(h => inRing(lat, lng, h)));
}
export function unitAt(lat, lng){ return UNITS.find(u => inUnit(lat, lng, u)) || null; }

/* Wer hat welches Gebiet. Die Geschäftsführung kann das auf der Karte ändern. */
export const GEBIET = {};
const HH_FREI = ['Altengamme', 'Neuengamme', 'Kirchwerder', 'Ochsenwerder', 'Reitbrook', 'Curslack', 'Spadenland', 'Tatenberg', 'Neuenfelde', 'Cranz', 'Francop'];
UNITS.forEach(u => {
  if (u.stadt === 'hamburg'){
    if (HH_FREI.includes(u.name)) return;
    GEBIET[u.id] = ['Hamburg-Nord', 'Eimsbüttel', 'Wandsbek'].includes(u.bezirk) ? 'jonas' : 'leyla';
  }
  if (u.stadt === 'berlin' && ['Mitte', 'Friedrichshain-Kreuzberg', 'Neukölln', 'Tempelhof-Schöneberg'].includes(u.bezirk)) GEBIET[u.id] = 'deniz';
  if (u.stadt === 'kiel') GEBIET[u.id] = 'tim';
});
export function gebieteSetzen(zeilen){
  Object.keys(GEBIET).forEach(k => delete GEBIET[k]);
  zeilen.forEach(z => { if (z.profil_id) GEBIET[z.unit] = z.profil_id; });
}
export function alleVerorten(){ M.LEADS.filter(l => l.bereich === 'standort').forEach(verorten); }
export const besitzer = u => (u && GEBIET[u.id]) || null;
export function zuweisen(unitId, hv, wer){
  if (hv) GEBIET[unitId] = hv; else delete GEBIET[unitId];
  return unit(unitId).name + (hv ? ' gehört jetzt zu ' + M.person(hv).name : ' ist jetzt frei') + '.';
}
export const farbe = hv => (hv && M.person(hv) && M.person(hv).farbe) || null;

/* ---------- Abstände und Zufallspunkte ---------- */
export function abstandM(a, b){
  const r = 6371000, t = Math.PI / 180;
  const dLa = (b.lat - a.lat) * t, dLo = (b.lng - a.lng) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
function rng(seed){ let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const RK = rng(6006);
function punktIn(u, rnd){
  const [s, w, n, e] = u.bbox;
  for (let i = 0; i < 400; i++){
    const lat = s + (n - s) * rnd(), lng = w + (e - w) * rnd();
    if (inUnit(lat, lng, u)) return { lat, lng };
  }
  return { lat: (s + n) / 2, lng: (w + e) / 2 };
}
/* Kiel: Stadtteile ohne amtliche Grenzen in der Demo, darum Mittelpunkte */
export const KIEL = {
  'Kiel-Altstadt': [54.3233, 10.1394], 'Kiel-Gaarden': [54.3135, 10.1465], 'Kiel-Mettenhof': [54.3095, 10.0805], 'Kiel-Wik': [54.3500, 10.1250],
  'Kiel-Holtenau': [54.3700, 10.1480], 'Kiel-Hassee': [54.3010, 10.1050], 'Kiel-Elmschenhagen': [54.2890, 10.1720], 'Kiel-Ravensberg': [54.3335, 10.1180],
  'Kiel-Düsternbrook': [54.3330, 10.1500], 'Kiel-Friedrichsort': [54.3900, 10.1620], 'Kiel-Suchsdorf': [54.3530, 10.0900], 'Kiel-Schilksee': [54.4250, 10.1700]
};
function punktFuerOrt(ort, rnd){
  if (KIEL[ort]){
    const [la, lo] = KIEL[ort];
    for (let i = 0; i < 50; i++){
      const p = { lat: la + (rnd() - 0.5) * 0.012, lng: lo + (rnd() - 0.5) * 0.02 };
      const u = unitAt(p.lat, p.lng); if (u && u.name === 'Kiel') return p;
    }
    return { lat: la, lng: lo };
  }
  const u = UNITS.find(x => x.name === ort && x.stadt !== 'kiel');
  return u ? punktIn(u, rnd) : null;
}

/* Alle Standort-Leads bekommen Koordinaten, Stadt und Gebietsbaustein */
export function verorten(l){
  if (!l.geo && !M.MODUS.echt){ const p = punktFuerOrt(l.ort, RK); if (p) l.geo = p; }
  if (l.geo){ const u = unitAt(l.geo.lat, l.geo.lng); l.unit = u ? u.id : null; l.stadt = u ? u.stadt : null; }
}
M.LEADS.filter(l => l.bereich === 'standort').forEach(verorten);

export function leadsIn(stadt){ return M.LEADS.filter(l => l.bereich === 'standort' && l.geo && l.stadt === stadt); }
export function naheLeads(p, r){ return M.LEADS.filter(l => l.bereich === 'standort' && l.geo && abstandM(p, l.geo) <= (r || 60)); }

/* ---------- Links aus Google Maps oder Apple Karten ---------- */
export function linkLesen(text){
  if (!text) return null;
  const t = text.trim();
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(t)) return { kurz: true };
  let m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
       || t.match(/[?&](?:ll|q|query|daddr|destination|sll)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i)
       || t.match(/^\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\s*$/);
  if (!m) return null;
  const out = { lat: Number(m[1]), lng: Number(m[2]) };
  try {
    const u = new URL(t);
    const q = u.searchParams.get('q'), a = u.searchParams.get('address');
    if (q && !/^-?\d/.test(q)) out.name = q;
    if (a) out.adresse = a;
    const place = u.pathname.match(/\/place\/([^/]+)/);
    if (!out.name && place) out.name = decodeURIComponent(place[1].replace(/\+/g, ' ')).split(',')[0];
  } catch (e) {}
  return out;
}

/* ---------- Adresse zum Punkt (echte App: OpenStreetMap) ---------- */
export async function adresseZu(p){
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=de&lat=${p.lat}&lon=${p.lng}`, { signal: ctl.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    const j = await r.json(), a = j.address || {};
    const strasse = [a.road, a.house_number].filter(Boolean).join(' ');
    const plzOrt = [a.postcode, a.city || a.town || a.village].filter(Boolean).join(' ');
    return { name: j.name || null, adresse: [strasse, plzOrt].filter(Boolean).join(', ') || null, stadtteil: a.suburb || a.city_district || null };
  } catch (e) { return null; }
}

/* ---------- Beispiel-Standorte für die Vorschau (GPS ist dort gesperrt) ---------- */
export const BEISPIELE = [
  { name: 'Kiosk am Mühlenkamp', adresse: 'Mühlenkamp 31, 22303 Hamburg', lat: 53.5846, lng: 10.0122 },
  { name: 'Getränkemarkt Osterstraße', adresse: 'Osterstraße 120, 20255 Hamburg', lat: 53.5770, lng: 9.9505 },
  { name: 'Tankstelle Fuhlsbüttler Straße', adresse: 'Fuhlsbüttler Str. 412, 22309 Hamburg', lat: 53.6008, lng: 10.0460 },
  { name: 'Parkplatz Wandsbeker Marktstraße', adresse: 'Wandsbeker Marktstr. 70, 22041 Hamburg', lat: 53.5725, lng: 10.0700 },
  { name: 'Späti Große Bergstraße', adresse: 'Große Bergstraße 160, 22767 Hamburg', lat: 53.5510, lng: 9.9370 },
  { name: 'Bäckerei Lüneburger Straße', adresse: 'Lüneburger Str. 18, 21073 Hamburg', lat: 53.4605, lng: 9.9850 },
  { name: 'Supermarkt Veringstraße', adresse: 'Veringstraße 60, 21107 Hamburg', lat: 53.5010, lng: 9.9930 },
  { name: 'Kiosk Sachsentor', adresse: 'Sachsentor 40, 21029 Hamburg', lat: 53.4885, lng: 10.2160 },
  { name: 'Späti Oranienstraße', adresse: 'Oranienstraße 180, 10999 Berlin', lat: 52.5010, lng: 13.4190 },
  { name: 'Kiosk Karl-Marx-Straße', adresse: 'Karl-Marx-Straße 90, 12043 Berlin', lat: 52.4800, lng: 13.4380 },
  { name: 'Tankstelle Tempelhofer Damm', adresse: 'Tempelhofer Damm 150, 12099 Berlin', lat: 52.4650, lng: 13.3850 },
  { name: 'Bäckerei Grünberger Straße', adresse: 'Grünberger Str. 80, 10245 Berlin', lat: 52.5105, lng: 13.4590 },
  { name: 'Kiosk Holstenstraße', adresse: 'Holstenstraße 50, 24103 Kiel', lat: 54.3205, lng: 10.1345 },
  { name: 'Apotheke Elisabethstraße', adresse: 'Elisabethstraße 60, 24143 Kiel', lat: 54.3120, lng: 10.1455 },
  { name: 'Supermarkt Vaasastraße', adresse: 'Vaasastraße 40, 24109 Kiel', lat: 54.3080, lng: 10.0800 },
  { name: 'Tankstelle Prinz-Heinrich-Straße', adresse: 'Prinz-Heinrich-Straße 20, 24159 Kiel', lat: 54.3720, lng: 10.1520 }
];
let beispielZaehler = 0;
export function beispielPunkt(stadt, hv){
  const inStadt = BEISPIELE.filter(b => { const u = unitAt(b.lat, b.lng); return u && u.stadt === stadt; });
  let auswahl = hv ? inStadt.filter(b => besitzer(unitAt(b.lat, b.lng)) === hv) : inStadt;
  if (!auswahl.length) auswahl = inStadt;
  const frei = auswahl.filter(b => !naheLeads(b, 40).length);
  const liste = frei.length ? frei : auswahl;
  return liste[(beispielZaehler++) % liste.length];
}

/* ---------- Neuen Standort vor Ort anlegen ---------- */
export function standortAnlegen(o, wer){
  const u = unitAt(o.geo.lat, o.geo.lng);
  const l = M.neuerLead({
    mandat: o.mandat, name: o.name, ort: u ? u.name : (o.ort || null), adresse: o.adresse || null, stufe: o.stufe || 'recherche',
    betreuer: o.betreuer, angelegt: M.HEUTE, geo: o.geo, fotos: o.fotos || [],
    kontakte: o.kontakt && o.kontakt.name ? [o.kontakt] : [],
    next: { datum: M.tag(1), zeit: null, text: o.stufe === 'eigentuemer' ? 'Eigentümer nachfassen' : 'Eigentümer ansprechen' },
    erfasst: { wer, zeit: new Date().toTimeString().slice(0, 5), datum: M.HEUTE, quelle: o.quelle, genau: o.genau || null }
  });
  verorten(l);
  const wie = o.quelle === 'gps' ? 'per GPS' + (o.genau ? ' ±' + Math.round(o.genau) + ' m' : '') : o.quelle === 'link' ? 'per Karten-Link' : 'Beispiel-Standort (Vorschau)';
  l.verlauf.push({ datum: M.HEUTE, wer, art: 'anlage', titel: 'Vor Ort erfasst', text: wie + (o.notiz ? ' · ' + o.notiz : '') });
  return l;
}

export const googleLink = p => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
export const routeLink = p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
