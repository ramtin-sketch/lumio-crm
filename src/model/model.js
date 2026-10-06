/* =====================================================================
   LUMIO Vertriebszentrale · Demo-Daten
   Alles erfunden. Struktur entspricht 1:1 dem späteren Supabase-Schema.
   ===================================================================== */

/* ---------- Zeit (alles relativ zu heute, damit die Demo nie veraltet) ---------- */
const T0 = new Date(); T0.setHours(0, 0, 0, 0);
function addTage(n){ const d = new Date(T0); d.setDate(d.getDate() + n); return d; }
function iso(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function tag(n){ return iso(addTage(n)); }
const HEUTE = iso(T0);
function ym(s){ return s.slice(0, 7); }
function ymAdd(s, n){
  let y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)) + n;
  while (m > 12){ m -= 12; y++; }
  while (m < 1){ m += 12; y--; }
  return y + '-' + String(m).padStart(2, '0');
}
const MONAT = ym(HEUTE);
function tageZwischen(a, b){ return Math.round((new Date(b) - new Date(a)) / 86400000); }

/* ---------- fester Zufall: gleiche Demo bei jedem Laden ---------- */
function rng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const R = rng(20261006);
const pick = a => a[Math.floor(R() * a.length)];
const zw = (a, b) => a + Math.floor(R() * (b - a + 1));

/* ---------- Team ---------- */
const PERSONEN = [
  { id: 'ramtin', name: 'Ramtin', voll: 'Ramtin S.',   rolle: 'gf', kurz: 'RS' },
  { id: 'kevin',  name: 'Kevin',  voll: 'Kevin M.',    rolle: 'gf', kurz: 'KM' },
  { id: 'fritz',  name: 'Fritz',  voll: 'Fritz B.',    rolle: 'setter', kurz: 'FB', seit: tag(-60) },
  { id: 'jonas',  name: 'Jonas',  voll: 'Jonas Brandt', rolle: 'hv', kurz: 'JB', gebiet: 'Hamburg Nord', stadt: 'hamburg', farbe: '#3b5bdb', seit: tag(-200) },
  { id: 'leyla',  name: 'Leyla',  voll: 'Leyla Aksoy',  rolle: 'hv', kurz: 'LA', gebiet: 'Hamburg Süd und West', stadt: 'hamburg', farbe: '#0ca678', seit: tag(-170) },
  { id: 'tim',    name: 'Tim',    voll: 'Tim Vogt',     rolle: 'hv', kurz: 'TV', gebiet: 'Kiel', stadt: 'kiel', farbe: '#e8590c', seit: tag(-80) },
  { id: 'deniz',  name: 'Deniz',  voll: 'Deniz Kaya',   rolle: 'hv', kurz: 'DK', gebiet: 'Berlin Mitte und Süd', stadt: 'berlin', farbe: '#c2255c', seit: tag(-45) }
];
const ZIEL_HV = { min: 2000, max: 3000 };

/* ---------- Mandate ----------
   bereich: werbung (Werbekunden am Telefon) | bildung (Arbeitgeber für geförderte Weiterbildung, am Telefon)
            | standort (Handelsvertreter draußen)
   k.typ:   fix      = fester Betrag je freigegebenem Standort
            marge    = Laufzeitvertrag, LUMIO behält satz % vom Monatsbeitrag
            prozent  = satz % vom Kampagnenvolumen, einmalig
            kopf     = satz % der Dealgröße je Teilnehmer, mindestens min
   hv:      Anteil des Handelsvertreters an der LUMIO-Vergütung in %        */
const MANDATE = [
  { id: 'm1', bereich: 'werbung', name: 'Skyline Media', produkt: 'DOOH-Screens bundesweit', status: 'aktiv', seit: tag(-175),
    k: { typ: 'marge', satz: 50 }, ktext: 'CPM-Marge: Einkauf 6 €, Verkauf 12 €. LUMIO behält 50 % vom Monatsbeitrag des Kunden, über die ganze Laufzeit.', hv: 0,
    ap: { name: 'Sven Ritter', funktion: 'Head of Partner Sales', tel: '+49 40 555 0101', mail: 'ritter@skyline.example' },
    felder: [{ key: 'screens', label: 'Screens', typ: 'zahl' }, { key: 'region', label: 'Region', typ: 'text' }] },
  { id: 'm2', bereich: 'werbung', name: 'Streamwerk', produkt: 'Werbung auf Streaming-Plattformen', status: 'aktiv', seit: tag(-40),
    k: { typ: 'prozent', satz: 15 }, ktext: '15 % vom gebuchten Kampagnenvolumen, einmalig bei Buchung.', hv: 0,
    ap: { name: 'Clara Engel', funktion: 'Partner Manager DACH', tel: '+44 20 555 0102', mail: 'engel@streamwerk.example' },
    felder: [{ key: 'zielgruppe', label: 'Zielgruppe', typ: 'text' }, { key: 'region', label: 'Region', typ: 'text' }] },
  { id: 'm3', bereich: 'bildung', name: 'Lernwerk Akademie', produkt: 'Geförderte Weiterbildung', status: 'aktiv', seit: tag(-8),
    k: { typ: 'kopf', satz: 15, min: 1000 }, ktext: '15 % der Dealgröße, mindestens 1.000 € je Teilnehmer. Abrechnung pro Kopf, fällig nach dem ersten Monat.', hv: 0,
    ap: { name: 'Max Berger', funktion: 'Key-Account-Manager', tel: '+49 341 555 0103', mail: 'berger@lernwerk.example' },
    felder: [{ key: 'bundesland', label: 'Bundesland', typ: 'text' }, { key: 'branche', label: 'Branche', typ: 'text' }] },
  { id: 'm7', bereich: 'bildung', name: 'Campus Bildungswerk', produkt: 'Weiterbildung für Arbeitgeber', status: 'verhandlung', seit: null,
    k: { typ: 'kopf', satz: 12, min: 800 }, ktext: '12 % der Dealgröße, mindestens 800 € je Teilnehmer. Konditionen noch in Verhandlung.', hv: 0,
    ap: { name: 'Jens Albrecht', funktion: 'Vertriebsleitung', tel: '+49 40 555 0107', mail: 'albrecht@campus-bildung.example' },
    felder: [{ key: 'bundesland', label: 'Bundesland', typ: 'text' }, { key: 'branche', label: 'Branche', typ: 'text' }] },
  { id: 'm4', bereich: 'standort', name: 'Nordlicht Energie', produkt: 'HPC-Ladeparks', status: 'aktiv', seit: tag(-200),
    k: { typ: 'fix', betrag: 250 }, ktext: '250 € je vom Mandanten freigegebenem Standort.', hv: 50,
    ap: { name: 'Anja Wolters', funktion: 'Key Account Manager DACH', tel: '+49 89 555 0104', mail: 'wolters@nordlicht.example' },
    felder: [{ key: 'stellplaetze', label: 'Stellplätze', typ: 'zahl' }, { key: 'netz', label: 'Netzanschluss', typ: 'text' }, { key: 'flaeche', label: 'Fläche m²', typ: 'zahl' }] },
  { id: 'm5', bereich: 'standort', name: 'PaketPoint DACH', produkt: 'Paketstationen', status: 'aktiv', seit: tag(-200),
    k: { typ: 'fix', betrag: 180 }, ktext: '180 € je freigegebenem Standort.', hv: 50,
    ap: { name: 'Daniel Haupt', funktion: 'Expansion Manager', tel: '+49 30 555 0105', mail: 'haupt@paketpoint.example' },
    felder: [{ key: 'flaeche', label: 'Fläche m²', typ: 'zahl' }, { key: 'strom', label: 'Stromanschluss', typ: 'text' }] },
  { id: 'm6', bereich: 'standort', name: 'Praxis-TV', produkt: 'Screens in Wartezimmern', status: 'verhandlung', seit: null,
    k: { typ: 'fix', betrag: 120 }, ktext: '120 € je Praxis. Konditionen noch in Verhandlung, Termin am ' + tag(31).split('-').reverse().slice(0, 2).join('.') + '.', hv: 50,
    ap: { name: 'Tom Reimers', funktion: 'Geschäftsleitung', tel: '+49 8161 555 0106', mail: 'reimers@praxis-tv.example' },
    felder: [{ key: 'fachrichtung', label: 'Fachrichtung', typ: 'text' }, { key: 'plaetze', label: 'Wartezimmerplätze', typ: 'zahl' }] }
];

/* ---------- Phasen je Geschäftsbereich ---------- */
const STUFEN = {
  werbung: [
    { id: 'recherche', name: 'Recherchiert',  p: 5 },
    { id: 'setting',   name: 'Im Setting',    p: 15 },
    { id: 'termin',    name: 'Termin steht',  p: 30 },
    { id: 'closing',   name: 'Im Closing',    p: 60 },
    { id: 'gewonnen',  name: 'Abgeschlossen', ende: true },
    { id: 'verloren',  name: 'Verloren',      ende: true }
  ],
  bildung: [
    { id: 'recherche', name: 'Recherchiert',           p: 5 },
    { id: 'setting',   name: 'Im Setting',             p: 15 },
    { id: 'termin',    name: 'Termin steht',           p: 30 },
    { id: 'closing',   name: 'Beim Bildungsträger',    p: 55 },
    { id: 'gewonnen',  name: 'Teilnehmer angemeldet',  ende: true },
    { id: 'verloren',  name: 'Verloren',               ende: true }
  ],
  standort: [
    { id: 'recherche',    name: 'Recherchiert',        p: 10 },
    { id: 'eigentuemer',  name: 'Eigentümer erreicht', p: 25 },
    { id: 'besichtigung', name: 'Besichtigung',        p: 45 },
    { id: 'eingereicht',  name: 'Beim Mandanten',      p: 75 },
    { id: 'gewonnen',     name: 'Freigegeben',         ende: true },
    { id: 'verloren',     name: 'Abgelehnt',           ende: true }
  ]
};
/* Werbung und Weiterbildung laufen am Telefon über Setter und Closer, Standorte draußen */
function istTel(l){ return l.bereich === 'werbung' || l.bereich === 'bildung'; }
const BEREICHE = [
  { id: 'werbung',  name: 'Werbemandate',   kurz: 'Werbung' },
  { id: 'bildung',  name: 'Weiterbildung',  kurz: 'Weiterbildung' },
  { id: 'standort', name: 'Standortakquise', kurz: 'Standorte' },
  { id: 'd2d',      name: 'Door-to-Door',    kurz: 'Door-to-Door' }
];
const EINWAENDE = ['Kein Budget', 'Kein Bedarf', 'Schon versorgt', 'Keine Zeit', 'Erst intern abstimmen', 'Zu teuer', 'Schlechte Erfahrung'];
const ERGEBNISSE = [
  { id: 'nicht',    name: 'Nicht erreicht' },
  { id: 'rueckruf', name: 'Rückruf' },
  { id: 'kein',     name: 'Kein Interesse' },
  { id: 'termin',   name: 'Termin' }
];

/* ---------- Leads ---------- */
let NEXT_ID = 1;
const LEADS = [];
/* Echter Betrieb: IDs als UUID, damit die App offline anlegen und später speichern kann */
const MODUS = { echt: false };
const neueId = () => (MODUS.echt ? crypto.randomUUID() : NEXT_ID++);
function mandat(id){ return MANDATE.find(m => m.id === id); }
/* Systemkonten (z. B. Claude-Verbindung): nur für Namen im Verlauf, nicht in Auswahllisten */
const SYSTEM_PERSONEN = [];
function person(id){ return PERSONEN.find(p => p.id === id) || SYSTEM_PERSONEN.find(p => p.id === id) || null; }
function lead(o){
  const l = Object.assign({
    id: neueId(), felder: {}, kontakte: [], verlauf: [], next: null, temp: 0,
    setter: null, closer: null, betreuer: null, abschluss: null, verlustgrund: null, angelegt: tag(-12)
  }, o);
  l.bereich = mandat(l.mandat).bereich;
  LEADS.push(l);
  return l;
}
const N = (d, z, t) => ({ datum: tag(d), zeit: z || null, text: t });
const V = (d, wer, art, titel, text) => ({ datum: tag(d), wer, art, titel, text: text || null });

/* Werbemandate · offen */
lead({ mandat: 'm1', name: 'Hanse Fitness Gruppe', ort: 'Hamburg', stufe: 'closing', temp: 2, setter: 'ramtin', closer: 'kevin', betreuer: 'kevin', terminStatus: 'gelaufen',
  uebergabe: { datum: tag(-9), von: 'ramtin', an: 'kevin', termin: { datum: tag(-5), zeit: '11:00' }, entscheider: 'ja', bedarf: 'Neue Studios in Barmbek und Altona sollen bekannt werden.', budget: '500_1000', einwaende: ['Erst intern abstimmen'], notiz: 'Will Zahlen zu Kontakten pro Woche sehen.' },
  felder: { screens: '12', region: 'Hamburg' }, next: N(1, '10:30', 'Angebot nachtelefonieren'),
  kontakte: [{ name: 'Sonja Kruse', funktion: 'Marketingleitung', tel: '+49 40 555 2201', mail: 'kruse@hanse-fitness.example' }],
  verlauf: [V(-9, 'ramtin', 'anruf', 'Erreicht, Termin gesetzt'), V(-5, 'kevin', 'termin', 'Termin gelaufen', 'Budget um 1.000 € im Monat, zwei Standorte gewünscht.'), V(-1, 'kevin', 'notiz', 'Angebot raus', '24 Monate, 890 € monatlich.')] });
lead({ mandat: 'm1', name: 'Autohaus Petersen', ort: 'Lüneburg', stufe: 'termin', temp: 1, setter: 'kevin', closer: 'ramtin', betreuer: 'ramtin',
  uebergabe: { datum: tag(-6), von: 'kevin', an: 'ramtin', termin: { datum: tag(0), zeit: '14:00' }, entscheider: 'ja', bedarf: 'Neuwagen-Aktion im November, will regional sichtbar sein.', budget: 'ueber_1000', einwaende: [], notiz: 'Inhaber entscheidet allein. Kennt DOOH schon von der Konkurrenz.' },
  felder: { screens: '6', region: 'Lüneburg' }, next: N(0, '14:00', 'Videocall: Mediaplan vorstellen'),
  kontakte: [{ name: 'Lars Petersen', funktion: 'Inhaber', tel: '+49 4131 555 2202', mail: 'petersen@autohaus.example' }],
  verlauf: [V(-6, 'kevin', 'anruf', 'Erreicht, Termin für heute')] });
lead({ mandat: 'm1', name: 'Möbel Hansen', ort: 'Pinneberg', stufe: 'setting', setter: 'ramtin', betreuer: 'ramtin', next: N(0, null, 'Rückruf Geschäftsführer'),
  verlauf: [V(-2, 'ramtin', 'anruf', 'Sekretariat, Rückruf heute zugesagt')] });
lead({ mandat: 'm1', name: 'Immobilien Nordstern', ort: 'Hamburg', stufe: 'setting', setter: 'kevin', betreuer: 'kevin', next: N(-1, null, 'Zweiter Anrufversuch'),
  verlauf: [V(-4, 'kevin', 'anruf', 'Nicht erreicht')] });
lead({ mandat: 'm1', name: 'Gartencenter Grün', ort: 'Norderstedt', stufe: 'recherche', betreuer: 'ramtin', next: N(2, null, 'Entscheider recherchieren') });
lead({ mandat: 'm1', name: 'Hörgeräte Kaiser', ort: 'Kiel', stufe: 'closing', temp: 1, setter: 'kevin', closer: 'kevin', betreuer: 'kevin', terminStatus: 'gelaufen',
  uebergabe: { datum: tag(-8), von: 'kevin', an: 'kevin', termin: { datum: tag(-4), zeit: '10:00' }, entscheider: 'ja', bedarf: 'Zielgruppe 60+, will in Arztnähe werben.', budget: 'unter_500', einwaende: ['Zu teuer'], notiz: '' },
  felder: { screens: '4', region: 'Kiel' }, next: N(3, '11:00', 'Vertrag besprechen'),
  kontakte: [{ name: 'Birgit Kaiser', funktion: 'Geschäftsführerin', tel: '+49 431 555 2206', mail: null }] });
lead({ mandat: 'm2', name: 'Brauhaus Elbe', ort: 'Hamburg', stufe: 'termin', temp: 1, setter: 'ramtin', closer: 'ramtin', betreuer: 'ramtin',
  uebergabe: { datum: tag(-3), von: 'ramtin', an: 'ramtin', termin: { datum: tag(2), zeit: '15:00' }, entscheider: 'unklar', bedarf: 'Sommerbier-Kampagne im nächsten Jahr, will früh planen.', budget: 'unklar', einwaende: [], notiz: 'Marketingleiterin war dran, Geschäftsführer soll dazukommen.' },
  felder: { zielgruppe: '25–45, Hamburg', region: 'Hamburg' }, next: N(2, '15:00', 'Termin vor Ort') });
lead({ mandat: 'm2', name: 'Reisebüro Sonnenweg', ort: 'Bremen', stufe: 'setting', setter: 'kevin', betreuer: 'kevin', next: N(0, null, 'Rückruf zugesagt') });
lead({ mandat: 'm2', name: 'Weinhandel Lorenz', ort: 'Lübeck', stufe: 'recherche', betreuer: 'kevin' });
lead({ mandat: 'm3', name: 'Lagerlogistik Pfeiffer', ort: 'Dresden', stufe: 'closing', temp: 2, setter: 'kevin', closer: 'ramtin', betreuer: 'ramtin', terminStatus: 'gelaufen',
  uebergabe: { datum: tag(-4), von: 'kevin', an: 'ramtin', termin: { datum: tag(-2), zeit: '09:00' }, entscheider: 'ja', bedarf: 'Drei Mitarbeiter sollen sich weiterbilden, Förderung ist gewünscht.', budget: 'unklar', einwaende: [], notiz: '' },
  felder: { bundesland: 'Sachsen', branche: 'Logistik' }, next: N(0, '16:00', 'Bewilligung nachfragen'),
  kontakte: [{ name: 'Udo Pfeiffer', funktion: 'Geschäftsführer', tel: '+49 351 555 2210', mail: 'pfeiffer@lager.example' }],
  verlauf: [V(-3, 'kevin', 'anruf', 'Setting gelaufen', 'Drei Teilnehmer, alle in Lager und Disposition.'), V(-1, 'ramtin', 'notiz', 'An Lernwerk übergeben', 'Antrag ist eingereicht.')] });
lead({ mandat: 'm3', name: 'Pflegedienst Morgenrot', ort: 'Leipzig', stufe: 'termin', setter: 'ramtin', closer: 'ramtin', betreuer: 'ramtin',
  uebergabe: { datum: tag(-2), von: 'ramtin', an: 'ramtin', termin: { datum: tag(1), zeit: '09:30' }, entscheider: 'ja', bedarf: 'Zwei Pflegehelfer sollen zur Fachkraft werden.', budget: 'unklar', einwaende: ['Keine Zeit'], notiz: '' },
  felder: { bundesland: 'Sachsen', branche: 'Pflege' }, next: N(1, '09:30', 'Setting-Gespräch') });
lead({ mandat: 'm3', name: 'Metallbau Reinecke', ort: 'Köln', stufe: 'setting', setter: 'ramtin', betreuer: 'ramtin', felder: { bundesland: 'NRW' }, next: N(-2, null, 'Rückruf Personalleitung') });
lead({ mandat: 'm3', name: 'Elektro Schulte', ort: 'Stuttgart', stufe: 'recherche', betreuer: 'kevin', felder: { bundesland: 'Baden-Württemberg' } });
lead({ mandat: 'm3', name: 'Spedition Albers', ort: 'Berlin', stufe: 'setting', setter: 'kevin', betreuer: 'kevin', felder: { bundesland: 'Berlin' }, next: N(1, null, 'Zweiter Versuch') });
lead({ mandat: 'm1', name: 'Steuerkanzlei Wiese', ort: 'Hamburg', stufe: 'verloren', setter: 'ramtin', betreuer: 'ramtin', verlustgrund: 'Kein Budget', angelegt: tag(-20) });
lead({ mandat: 'm2', name: 'Fahrschule Stadtmitte', ort: 'Kiel', stufe: 'verloren', setter: 'kevin', betreuer: 'kevin', verlustgrund: 'Schon versorgt', angelegt: tag(-15) });

/* Reiner Setter (Fritz): eigene Anrufliste, eine Übergabe, ein No-Show */
lead({ mandat: 'm1', name: 'Physio Elbufer', ort: 'Hamburg', stufe: 'termin', temp: 1, setter: 'fritz', closer: 'kevin', betreuer: 'kevin',
  felder: { screens: '3', region: 'Hamburg-Ottensen' }, next: N(1, '11:00', 'Termin von Fritz'),
  kontakte: [{ name: 'Lena Voss', funktion: 'Inhaberin', tel: '+49 40 555 5101', mail: 'voss@physio-elbufer.example' }],
  uebergabe: { datum: tag(-1), von: 'fritz', an: 'kevin', termin: { datum: tag(1), zeit: '11:00' }, entscheider: 'ja', bedarf: 'Zweite Praxis eröffnet im Januar, braucht Patienten im Viertel.', budget: '500_1000', einwaende: ['Kein Budget'], notiz: 'Einwand Budget war weich. Hat bei regional sofort zugehört.' },
  verlauf: [V(-3, 'fritz', 'anruf', 'Nicht erreicht'), V(-1, 'fritz', 'anruf', 'Termin vereinbart', 'Übergabe an Kevin')] });
lead({ mandat: 'm1', name: 'Optik Brillenwerk', ort: 'Norderstedt', stufe: 'setting', setter: 'fritz', closer: 'ramtin', betreuer: 'fritz', noShows: 1, terminStatus: 'noshow',
  next: N(0, null, 'Nicht erschienen – neu terminieren'),
  kontakte: [{ name: 'Jan Petersen', funktion: 'Geschäftsführer', tel: '+49 40 555 5102', mail: null }],
  uebergabe: { datum: tag(-6), von: 'fritz', an: 'ramtin', termin: { datum: tag(-1), zeit: '16:00' }, entscheider: 'ja', bedarf: 'Will die neue Filiale bekannt machen.', budget: 'unter_500', einwaende: [], notiz: '' },
  verlauf: [V(-6, 'fritz', 'anruf', 'Termin vereinbart', 'Übergabe an Ramtin'), V(-1, 'ramtin', 'termin', 'Nicht erschienen', 'Zurück an Fritz zum Neuterminieren')] });
['Sanitätshaus Nord', 'Tanzschule Takt', 'Augenarzt Dr. Behn', 'Küchen Kröger', 'Hotel Speicherstadt', 'Fahrradladen Spoke'].forEach((n, i) => {
  lead({ mandat: i % 3 === 2 ? 'm2' : 'm1', name: n, ort: ['Hamburg', 'Pinneberg', 'Hamburg', 'Lübeck', 'Hamburg', 'Kiel'][i], stufe: i < 3 ? 'setting' : 'recherche', setter: i < 3 ? 'fritz' : null, betreuer: 'fritz',
    next: i < 3 ? N(i === 0 ? -1 : 0, null, ['Zweiter Versuch', 'Rückruf zugesagt', 'Entscheider erreichen'][i]) : null });
});

/* Standortakquise · offen */
lead({ mandat: 'm4', name: 'Autohof Nord A7', ort: 'Schnelsen', adresse: 'Holsteiner Chaussee 300', stufe: 'eingereicht', temp: 2, betreuer: 'jonas',
  felder: { stellplaetze: '6', netz: '400 kW liegen an', flaeche: '1200' }, next: N(2, null, 'Freigabe beim Mandanten nachhalten'),
  kontakte: [{ name: 'Hendrik Baasch', funktion: 'Eigentümer', tel: '+49 170 555 3301', mail: 'baasch@autohof.example' }],
  verlauf: [V(-11, 'jonas', 'besuch', 'Eigentümer angetroffen', 'Interesse an Pacht, will Zahlen sehen.'), V(-6, 'jonas', 'termin', 'Besichtigung', 'Fläche passt, Netzanschluss liegt an.'), V(-2, 'jonas', 'notiz', 'Beim Mandanten eingereicht')] });
lead({ mandat: 'm4', name: 'Baumarkt Wandsbek', ort: 'Wandsbek', adresse: 'Friedrich-Ebert-Damm 2', stufe: 'besichtigung', temp: 1, betreuer: 'jonas',
  felder: { stellplaetze: '4' }, next: N(0, '11:00', 'Besichtigung mit Filialleitung') });
lead({ mandat: 'm4', name: 'Parkdeck Altona', ort: 'Ottensen', adresse: 'Ottenser Hauptstr. 10', stufe: 'eigentuemer', betreuer: 'leyla', next: N(1, null, 'Hausverwaltung schickt Lageplan') });
lead({ mandat: 'm4', name: 'Hotel an der Kiellinie', ort: 'Kiel-Düsternbrook', stufe: 'recherche', betreuer: 'tim', next: N(0, null, 'Eigentümer ermitteln') });
lead({ mandat: 'm4', name: 'Einkaufszentrum Mettenhof', ort: 'Kiel-Mettenhof', stufe: 'besichtigung', betreuer: 'tim', felder: { stellplaetze: '10', flaeche: '2400' }, next: N(3, '10:00', 'Begehung Parkplatz') });
lead({ mandat: 'm5', name: 'Kiosk Eppendorf', ort: 'Eppendorf', adresse: 'Eppendorfer Weg 61', stufe: 'eingereicht', temp: 1, betreuer: 'jonas',
  felder: { flaeche: '3', strom: 'ja' }, next: N(1, null, 'Freigabe abwarten'),
  kontakte: [{ name: 'Mehmet Arslan', funktion: 'Inhaber', tel: '+49 171 555 3306', mail: null }] });
lead({ mandat: 'm5', name: 'Bäckerei Lührs', ort: 'Wilhelmsburg', stufe: 'eigentuemer', betreuer: 'leyla', next: N(0, '15:30', 'Zweiter Besuch') });
lead({ mandat: 'm5', name: 'Tankstelle Harburg', ort: 'Harburg', stufe: 'eigentuemer', betreuer: 'leyla', next: N(2, null, 'Pächter zurückrufen') });
lead({ mandat: 'm5', name: 'Apotheke am Vinetaplatz', ort: 'Kiel-Gaarden', stufe: 'recherche', betreuer: 'tim' });
lead({ mandat: 'm5', name: 'Späti Osterstraße', ort: 'Eimsbüttel', stufe: 'besichtigung', betreuer: 'jonas', next: N(-1, null, 'Fotos nachreichen') });
lead({ mandat: 'm5', name: 'Copyshop Uni', ort: 'Kiel-Ravensberg', stufe: 'eigentuemer', betreuer: 'tim', next: N(2, null, 'Inhaber erneut ansprechen') });
lead({ mandat: 'm5', name: 'Supermarkt Hamm', ort: 'Hamm', stufe: 'recherche', betreuer: 'leyla' });
lead({ mandat: 'm5', name: 'Späti Wrangelkiez', ort: 'Kreuzberg', adresse: 'Wrangelstr. 40', stufe: 'besichtigung', temp: 1, betreuer: 'deniz', next: N(0, '16:00', 'Besichtigung mit Inhaber') });
lead({ mandat: 'm5', name: 'Kiosk Hermannplatz', ort: 'Neukölln', stufe: 'eigentuemer', betreuer: 'deniz', next: N(1, null, 'Inhaber nochmal ansprechen') });
lead({ mandat: 'm4', name: 'Parkhaus Tempelhofer Damm', ort: 'Tempelhof', stufe: 'eingereicht', temp: 2, betreuer: 'deniz', felder: { stellplaetze: '8' }, next: N(3, null, 'Freigabe nachhalten') });
lead({ mandat: 'm5', name: 'Copyshop Turmstraße', ort: 'Moabit', stufe: 'recherche', betreuer: 'deniz' });
lead({ mandat: 'm4', name: 'Möbelhaus Bergedorf', ort: 'Bergedorf', stufe: 'verloren', betreuer: 'leyla', verlustgrund: 'Netzanschluss zu schwach', angelegt: tag(-25) });
lead({ mandat: 'm5', name: 'Kiosk Moorfleet', ort: 'Moorfleet', stufe: 'verloren', betreuer: 'leyla', verlustgrund: 'Mandant lehnt Lage ab', angelegt: tag(-18) });

/* Ansprechpartner mit Nummer für alle offenen Werbekunden, damit die Anrufliste echt aussieht */
(function(){
  const vn = ['Thomas', 'Sabine', 'Michael', 'Anja', 'Frank', 'Nadine', 'Stefan', 'Katrin', 'Jörg', 'Melanie'];
  const nn = ['Hoffmeister', 'Brüggemann', 'Schröder', 'Lange', 'Wittkowski', 'Peters', 'Jansen', 'Möller', 'Claßen', 'Behrens'];
  const fk = ['Geschäftsführung', 'Inhaber', 'Marketingleitung', 'Personalleitung', 'Filialleitung'];
  const vw = { 'Hamburg': '40', 'Pinneberg': '4101', 'Norderstedt': '40', 'Kiel': '431', 'Bremen': '421', 'Lübeck': '451', 'Dresden': '351', 'Leipzig': '341', 'Köln': '221', 'Stuttgart': '711', 'Berlin': '30', 'Lüneburg': '4131' };
  LEADS.filter(l => istTel(l) && !l.kontakte.length && l.stufe !== 'verloren').forEach((l, i) => {
    l.kontakte.push({ name: vn[i % vn.length] + ' ' + nn[(i * 3) % nn.length], funktion: fk[i % fk.length],
      tel: '+49 ' + (vw[l.ort] || '40') + ' 555 ' + String(4100 + i * 7), mail: null });
  });
})();

/* ---------- Abschlüsse der letzten Monate (für Dashboard und Verdienst) ---------- */
const ORTE_HV = {
  jonas: ['Eppendorf', 'Winterhude', 'Barmbek-Nord', 'Lokstedt', 'Niendorf', 'Langenhorn', 'Fuhlsbüttel', 'Hummelsbüttel'],
  leyla: ['Harburg', 'Wilhelmsburg', 'Bergedorf', 'Billstedt', 'Rothenburgsort', 'Neugraben-Fischbek', 'Hamm', 'Veddel'],
  tim:   ['Kiel-Altstadt', 'Kiel-Gaarden', 'Kiel-Mettenhof', 'Kiel-Wik', 'Kiel-Holtenau', 'Kiel-Hassee', 'Kiel-Elmschenhagen', 'Kiel-Ravensberg'],
  deniz: ['Kreuzberg', 'Neukölln', 'Friedrichshain', 'Schöneberg', 'Wedding', 'Moabit', 'Tempelhof', 'Mitte']
};
const OBJ = { m4: ['Autohof', 'Baumarkt', 'Logistikpark', 'Einkaufszentrum', 'Hotelparkplatz', 'Möbelhaus', 'Gewerbehof'],
              m5: ['Kiosk', 'Bäckerei', 'Tankstelle', 'Supermarkt', 'Apotheke', 'Späti', 'Copyshop', 'Reinigung'] };
const QUOTE = { jonas: { m4: [4, 6], m5: [15, 19] }, leyla: { m4: [3, 5], m5: [11, 15] }, tim: { m4: [1, 2], m5: [5, 9] } };
const KUNDEN_W = ['Autohaus Petersen Nord', 'Zahnarztpraxis Dr. Krüger', 'Fitnessstudio Elbkraft', 'Optik Sanders', 'Bäckerei Lührs Filialen',
  'Immobilien Westhafen', 'Brillen Wolf', 'Gartencenter Kühl', 'Möbelwerk Stade', 'Physio am Hafen', 'Küchenstudio Meyer', 'Hotel Alsterblick',
  'Autoglas Express', 'Tierarztpraxis Nord', 'Restaurant Fischmarkt', 'Kanzlei Brandt', 'Elektro Lange', 'Sportwelt Harburg', 'Juwelier Stern', 'Malerbetrieb Koch'];
const FIRMEN_L = ['Logistik Wendt', 'Pflege Lindenhof', 'Metall Krause', 'Bau Hollmann', 'Spedition Nord', 'Kliniklogistik Ost', 'Handwerk Bauer'];

function statusFuer(datum){
  const m = ym(datum);
  if (m === MONAT) return 'offen';
  if (m === ymAdd(MONAT, -1)) return 'abgerechnet';
  return 'bezahlt';
}
function tagImMonat(ymStr){
  const y = Number(ymStr.slice(0, 4)), mo = Number(ymStr.slice(5, 7));
  const letzter = ymStr === MONAT ? T0.getDate() : new Date(y, mo, 0).getDate();
  return ymStr + '-' + String(zw(1, Math.max(1, letzter))).padStart(2, '0');
}

for (let back = 5; back >= 0; back--){
  const mo = ymAdd(MONAT, -back);
  const anteil = mo === MONAT ? Math.min(1, T0.getDate() / 30) : 1;
  ['jonas', 'leyla', 'tim'].forEach(hv => {
    if (ym(person(hv).seit) > mo) return;
    ['m4', 'm5'].forEach(mid => {
      const q = QUOTE[hv][mid];
      const n = Math.round(zw(q[0], q[1]) * anteil);
      for (let i = 0; i < n; i++){
        const d = tagImMonat(mo);
        const obj = pick(OBJ[mid]), ort = pick(ORTE_HV[hv]); pick(ORTE_HV[hv]);
        const l = lead({ mandat: mid, name: obj + ' ' + ort.replace('Kiel-', ''), ort, stufe: 'gewonnen', betreuer: hv,
          angelegt: iso(new Date(new Date(d).getTime() - zw(9, 30) * 86400000)) });
        l.abschluss = { datum: d, status: statusFuer(d) };
      }
    });
  });
  // Werbemandate: Abschlüsse durch Ramtin und Kevin
  const wer = () => pick(['ramtin', 'kevin']);
  if (mo >= ym(mandat('m1').seit)){
    const n = mo === MONAT ? 1 : zw(2, 4);
    for (let i = 0; i < n; i++){
      const d = tagImMonat(mo), s = wer(), c = wer();
      const l = lead({ mandat: 'm1', name: pick(KUNDEN_W), ort: pick(['Hamburg', 'Lüneburg', 'Kiel', 'Bremen', 'Lübeck']), stufe: 'gewonnen', setter: s, closer: c, betreuer: c, felder: { screens: String(zw(3, 14)) } });
      l.abschluss = { datum: d, status: statusFuer(d), laufzeit: pick([12, 24, 24, 36]), monatsbeitrag: pick([390, 490, 690, 690, 890, 1190, 1490]) };
    }
  }
  if (mo >= ym(mandat('m2').seit)){
    const n = mo === MONAT ? 1 : zw(1, 2);
    for (let i = 0; i < n; i++){
      const d = tagImMonat(mo), s = wer(), c = wer();
      if (d < mandat('m2').seit) continue;
      const l = lead({ mandat: 'm2', name: pick(KUNDEN_W), ort: pick(['Hamburg', 'Berlin', 'München', 'Köln']), stufe: 'gewonnen', setter: s, closer: c, betreuer: c });
      l.abschluss = { datum: d, status: statusFuer(d), volumen: pick([8000, 12000, 15000, 24000, 30000]) };
    }
  }
}
// Deniz in Berlin: seit sechs Wochen, eigener Zufall, damit die übrigen Zahlen gleich bleiben
(function(){
  const R3 = rng(5150), p3 = a => a[Math.floor(R3() * a.length)], z3 = (a, b) => a + Math.floor(R3() * (b - a + 1));
  [ymAdd(MONAT, -1), MONAT].forEach(mo => {
    const anteil = mo === MONAT ? Math.min(1, T0.getDate() / 30) : 0.7;
    [['m4', 2], ['m5', 8]].forEach(([mid, q]) => {
      const n = Math.round(z3(Math.ceil(q / 2), q) * anteil);
      for (let i = 0; i < n; i++){
        const tage = mo === MONAT ? T0.getDate() : 30;
        const d = mo + '-' + String(z3(Math.max(1, mo === MONAT ? 1 : 16), tage)).padStart(2, '0');
        const ort = p3(ORTE_HV.deniz);
        const l = lead({ mandat: mid, name: p3(OBJ[mid]) + ' ' + ort, ort, stufe: 'gewonnen', betreuer: 'deniz', angelegt: iso(new Date(new Date(d).getTime() - z3(9, 25) * 86400000)) });
        l.abschluss = { datum: d, status: statusFuer(d) };
      }
    });
  });
})();
// Lernwerk: erst seit 8 Tagen, ein Abschluss
(function(){
  const d = tag(-3);
  const l = lead({ mandat: 'm3', name: pick(FIRMEN_L), ort: 'Dresden', stufe: 'gewonnen', setter: 'kevin', closer: 'ramtin', betreuer: 'ramtin', felder: { bundesland: 'Sachsen', branche: 'Logistik' } });
  l.abschluss = { datum: d, status: statusFuer(d), teilnehmer: 2, dealgroesse: 9800 };
})();

/* ---------- Telefonarbeit: Tageszahlen je Person ---------- */
const ANRUF_TAGE = [];
for (let n = -21; n <= 0; n++){
  const d = addTage(n);
  if (d.getDay() === 0 || d.getDay() === 6) continue;
  ['ramtin', 'kevin'].forEach(p => {
    const heute = n === 0;
    const wahl = heute ? (p === 'ramtin' ? 18 : 23) : zw(32, 58);
    const erreicht = Math.round(wahl * (0.24 + R() * 0.12));
    const termine = Math.max(0, Math.round(erreicht * (0.1 + R() * 0.12)));
    const einw = {};
    const kein = Math.round((erreicht - termine) * 0.6);
    for (let i = 0; i < kein; i++){ const e = pick(EINWAENDE); einw[e] = (einw[e] || 0) + 1; }
    ANRUF_TAGE.push({ person: p, datum: iso(d), wahl, erreicht, termine, einwaende: einw });
  });
}

/* ---------- Setter-Closer: Terminhistorie ----------
   status: geplant | gelaufen | noshow    ergebnis: offen | abschluss | verloren */
const R2 = rng(424242);
const pick2 = a => a[Math.floor(R2() * a.length)];
const TERMINE = [];
function terminEintrag(o){ TERMINE.push(Object.assign({ id: MODUS.echt ? crypto.randomUUID() : TERMINE.length + 1, ergebnis: 'offen' }, o)); }
// Fritz hat in den letzten Wochen einen Teil der Abschlüsse gesetzt
LEADS.filter(l => istTel(l) && l.abschluss && l.abschluss.datum >= tag(-55)).forEach(l => { if (R2() < 0.45) l.setter = 'fritz'; });
// Jeder Werbe-Abschluss hatte einen gelaufenen Termin
LEADS.filter(l => istTel(l) && l.abschluss).forEach(l => {
  const d = iso(new Date(new Date(l.abschluss.datum).getTime() - (2 + Math.floor(R2() * 8)) * 86400000));
  terminEintrag({ lead: l.id, setter: l.setter, closer: l.closer, datum: d, status: 'gelaufen', ergebnis: 'abschluss' });
});
// Dazu gelaufene Termine ohne Abschluss und No-Shows, damit Quoten realistisch sind
for (let n = -175; n < 0; n++){
  const d = addTage(n); if (d.getDay() === 0 || d.getDay() === 6) continue;
  const setterPool = n >= -60 ? ['ramtin', 'kevin', 'fritz', 'fritz'] : ['ramtin', 'kevin'];
  const anzahl = R2() < 0.55 ? 1 : 0;
  for (let i = 0; i < anzahl; i++){
    const s = pick2(setterPool), c = pick2(['ramtin', 'kevin']);
    const noshow = R2() < (s === 'fritz' ? 0.27 : 0.17);
    terminEintrag({ lead: null, setter: s, closer: c, datum: iso(d), status: noshow ? 'noshow' : 'gelaufen', ergebnis: noshow ? 'offen' : 'verloren' });
  }
}
// Die ersten Oktobertage, damit "Dieser Monat" nicht leer wirkt
terminEintrag({ lead: null, setter: 'fritz', closer: 'kevin', datum: tag(-5), status: 'gelaufen', ergebnis: 'verloren' });
terminEintrag({ lead: null, setter: 'fritz', closer: 'ramtin', datum: tag(-4), status: 'gelaufen', ergebnis: 'abschluss' });
terminEintrag({ lead: null, setter: 'fritz', closer: 'kevin', datum: tag(-1), status: 'gelaufen', ergebnis: 'offen' });
terminEintrag({ lead: null, setter: 'ramtin', closer: 'ramtin', datum: tag(-1), status: 'gelaufen', ergebnis: 'offen' });
// Offene Leads mit Übergabe
LEADS.filter(l => l.uebergabe).forEach(l => {
  const st = l.terminStatus || (l.uebergabe.termin.datum < HEUTE ? 'gelaufen' : 'geplant');
  terminEintrag({ lead: l.id, setter: l.uebergabe.von, closer: l.uebergabe.an, datum: l.uebergabe.termin.datum, zeit: l.uebergabe.termin.zeit, status: st, ergebnis: 'offen' });
});
// Fritz telefoniert seit 60 Tagen mehr als ihr zwei
for (let n = -21; n <= 0; n++){
  const d = addTage(n); if (d.getDay() === 0 || d.getDay() === 6) continue;
  const heute = n === 0;
  const wahl = heute ? 31 : 60 + Math.floor(R2() * 35);
  const erreicht = Math.round(wahl * (0.22 + R2() * 0.1));
  const termine = Math.max(0, Math.round(erreicht * (0.08 + R2() * 0.08)));
  const einw = {}; const kein = Math.round((erreicht - termine) * 0.6);
  for (let i = 0; i < kein; i++){ const e = pick2(EINWAENDE); einw[e] = (einw[e] || 0) + 1; }
  ANRUF_TAGE.push({ person: 'fritz', datum: iso(d), wahl, erreicht, termine, einwaende: einw });
}

const BUDGETS = [['unter_500', 'unter 500 € im Monat'], ['500_1000', '500–1.000 € im Monat'], ['ueber_1000', 'über 1.000 € im Monat'], ['unklar', 'noch unklar']];
const ENTSCHEIDER = [['ja', 'Ja, Entscheider war dran'], ['nein', 'Nein, nur Vorzimmer/Kollege'], ['unklar', 'Unklar']];

/* =====================================================================
   Rechnen, Formatieren, Zustand
   ===================================================================== */

function stufeVon(l){ return STUFEN[l.bereich].find(s => s.id === l.stufe); }
function istOffen(l){ const s = stufeVon(l); return !!s && !s.ende; }

/* LUMIO-Vergütung aus einem Abschluss, über die ganze Laufzeit */
function lumioGesamt(l){
  const a = l.abschluss; if (!a) return 0;
  const k = mandat(l.mandat).k;
  if (k.typ === 'fix')     return k.betrag || 0;
  if (k.typ === 'marge')   return a.laufzeit * a.monatsbeitrag * k.satz / 100;
  if (k.typ === 'prozent') return a.volumen * k.satz / 100;
  if (k.typ === 'kopf')    return a.teilnehmer * Math.max(k.min || 0, a.dealgroesse * k.satz / 100);
  return 0;
}
/* Was der Kunde insgesamt zahlt (nur bei Werbemandaten sinnvoll) */
function kundenwert(l){
  const a = l.abschluss; if (!a) return null;
  const k = mandat(l.mandat).k;
  if (k.typ === 'marge')   return a.laufzeit * a.monatsbeitrag;
  if (k.typ === 'prozent') return a.volumen;
  if (k.typ === 'kopf')    return a.teilnehmer * a.dealgroesse;
  return null;
}
/* Umsatz, der in einem Monat bei LUMIO ankommt.
   Laufzeitverträge verteilen sich auf ihre Monate, alles andere zählt im Abschlussmonat. */
function umsatzImMonat(l, mo){
  const a = l.abschluss; if (!a) return 0;
  const k = mandat(l.mandat).k, start = ym(a.datum);
  if (k.typ === 'marge'){
    const ende = ymAdd(start, a.laufzeit - 1);
    return (mo >= start && mo <= ende) ? a.monatsbeitrag * k.satz / 100 : 0;
  }
  return start === mo ? lumioGesamt(l) : 0;
}
function hvAnteil(l){
  const m = mandat(l.mandat), b = person(l.betreuer);
  if (!l.abschluss || !b || b.rolle !== 'hv' || !m.hv) return 0;
  return lumioGesamt(l) * m.hv / 100;
}
/* Hochrechnung für den laufenden Monat.
   Laufzeitverträge zählen voll, sie kommen einmal im Monat.
   Einzelne Werbeabschlüsse zählen so, wie sie sind; sie sind kein gleichmäßiger Strom.
   Nur die Standortakquise läuft gleichmäßig und wird nach Kalendertagen hochgerechnet. */
function hochrechnungMonat(filter){
  const tage = new Date(T0.getFullYear(), T0.getMonth() + 1, 0).getDate();
  let fest = 0, strom = 0;
  LEADS.forEach(l => {
    if (!l.abschluss || !filter(l)) return;
    const u = umsatzImMonat(l, MONAT);
    if (l.bereich === 'standort') strom += u; else fest += u;
  });
  return fest + strom / Math.max(1, T0.getDate()) * tage;
}
function laufendImMonat(mo){
  return LEADS.reduce((s, l) => s + (l.abschluss && mandat(l.mandat).k.typ === 'marge' ? umsatzImMonat(l, mo) : 0), 0);
}
/* Grobe Erwartung, was ein offener Lead bringt, gewichtet nach Phase */
function schaetzwert(l){
  const k = mandat(l.mandat).k;
  if (k.typ === 'fix')     return k.betrag || 0;
  if (k.typ === 'marge')   return 24 * 690 * k.satz / 100;
  if (k.typ === 'prozent') return 15000 * k.satz / 100;
  if (k.typ === 'kopf')    return 2 * Math.max(k.min || 0, 8000 * k.satz / 100);
  return 0;
}
function pipelineGewichtet(filter){
  return LEADS.filter(l => istOffen(l) && filter(l)).reduce((s, l) => s + schaetzwert(l) * (stufeVon(l).p || 0) / 100, 0);
}

/* Zeiträume */
const ZEITRAEUME = [['monat', 'Dieser Monat'], ['vormonat', 'Letzter Monat'], ['sechs', 'Letzte 6 Monate']];
function monateVon(z){
  if (z === 'monat') return [MONAT];
  if (z === 'vormonat') return [ymAdd(MONAT, -1)];
  return [5, 4, 3, 2, 1, 0].map(n => ymAdd(MONAT, -n));
}
function imZeitraum(datum, z){ return monateVon(z).indexOf(ym(datum)) !== -1; }
function anrufeImZeitraum(p, z){
  const sum = { wahl: 0, erreicht: 0, termine: 0, einwaende: {} };
  ANRUF_TAGE.filter(a => (!p || a.person === p) && imZeitraum(a.datum, z)).forEach(a => {
    sum.wahl += a.wahl; sum.erreicht += a.erreicht; sum.termine += a.termine;
    Object.keys(a.einwaende).forEach(e => { sum.einwaende[e] = (sum.einwaende[e] || 0) + a.einwaende[e]; });
  });
  return sum;
}
function anrufTag(p, d){
  let t = ANRUF_TAGE.find(a => a.person === p && a.datum === d);
  if (!t){ t = { person: p, datum: d, wahl: 0, erreicht: 0, termine: 0, einwaende: {} }; ANRUF_TAGE.push(t); }
  return t;
}

/* Formate */
const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
function esc(v){
  if (v === null || v === undefined) return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function eur(n){ return (n === null || n === undefined || isNaN(n)) ? '—' : Math.round(n).toLocaleString('de-DE') + ' €'; }
function zahl(n){ return Math.round(n).toLocaleString('de-DE'); }
function prozent(a, b){ return b ? Math.round(a / b * 100) + ' %' : '—'; }
function dKurz(s){ if (!s) return ''; return s.slice(8, 10) + '.' + s.slice(5, 7) + '.'; }
function monatName(mo, kurz){ const n = MONATSNAMEN[Number(mo.slice(5, 7)) - 1]; return kurz ? n.slice(0, 3) : n; }
function wann(n){
  if (!n || !n.datum) return '';
  const diff = tageZwischen(HEUTE, n.datum);
  const z = n.zeit ? ' ' + n.zeit : '';
  if (diff === 0) return 'Heute' + z;
  if (diff === 1) return 'Morgen' + z;
  if (diff === -1) return 'Gestern' + z;
  return dKurz(n.datum) + z;
}
function faellig(l){ return l.next && l.next.datum && l.next.datum <= HEUTE && istOffen(l); }
function ueberfaellig(l){ return l.next && l.next.datum && l.next.datum < HEUTE && istOffen(l); }


/* ---------- Aktionen (aus Version 2, mit "wer" statt globalem Zustand) ---------- */
function verlauf(l, wer, art, titel, text){ l.verlauf.push({ id: MODUS.echt ? crypto.randomUUID() : undefined, datum: HEUTE, wer, art, titel, text: text || null }); }

/* ---------- Sperrliste (Werbewiderspruch, § 7 UWG) ---------- */
const SPERRLISTE = [];
const ANRUF_LOG = [];
function telNorm(t){
  if (!t) return null;
  let s = String(t).replace(/[^0-9+]/g, '');
  if (!s) return null;
  s = s.replace(/^00/, '+').replace(/^0/, '+49').replace(/^\+490/, '+49');
  return s;
}
function mailNorm(m){ return m ? String(m).trim().toLowerCase() || null : null; }
function firmaNorm(n){ return n ? String(n).toLowerCase().replace(/\b(gmbh|ug|ag|kg|ohg|e\.?\s?k\.?|mbh|co|&|und)\b/g, '').replace(/[^a-z0-9äöüß]/g, '') : ''; }
function sperrTreffer(l){
  const tels = new Set(SPERRLISTE.map(e => e.telefon).filter(Boolean)), mails = new Set(SPERRLISTE.map(e => e.email).filter(Boolean));
  const k = (l.kontakte || []).find(k => (k.tel && tels.has(telNorm(k.tel))) || (k.mail && mails.has(mailNorm(k.mail))));
  if (k) return SPERRLISTE.find(e => e.telefon === telNorm(k.tel) || e.email === mailNorm(k.mail)) || null;
  return SPERRLISTE.find(e => e.lead === l.id) || null;
}
function istGesperrt(l){ return !!sperrTreffer(l); }
function sperreHinzu(e){
  const t = telNorm(e.telefon), m = mailNorm(e.email);
  if ((t && SPERRLISTE.some(x => x.telefon === t)) || (m && SPERRLISTE.some(x => x.email === m))) return false;
  if (!t && !m && !e.firma) return false;
  SPERRLISTE.push({ id: MODUS.echt ? crypto.randomUUID() : 's' + (SPERRLISTE.length + 1), telefon: t, email: m, firma: e.firma || null,
    grund: e.grund || 'Werbewiderspruch', lead: e.lead || null, datum: HEUTE, wer: e.wer || null, neu: true });
  return true;
}
/* "Nicht mehr anrufen": alle Nummern und Mails des Leads auf die Sperrliste, Lead verloren */
function sperren(l, wer, grund){
  grund = grund || 'Werbewiderspruch';
  let n = 0;
  (l.kontakte || []).forEach(k => { if (sperreHinzu({ telefon: k.tel, email: k.mail, firma: l.name, grund, lead: l.id, wer })) n++; });
  if (!n) sperreHinzu({ firma: l.name, grund, lead: l.id, wer });
  if (istTel(l) && person(wer) && person(wer).rolle !== 'hv'){
    const t = anrufTag(wer, HEUTE); t.wahl++; t.erreicht++;
    ANRUF_LOG.push({ id: MODUS.echt ? crypto.randomUUID() : ANRUF_LOG.length + 1, wer, lead: l.id, zeit: new Date().toISOString(), ergebnis: 'gesperrt', einwand: null });
  }
  verlustAufTermin(l);
  l.stufe = 'verloren'; l.verlustgrund = grund; l.next = null;
  verlauf(l, wer, 'sperre', 'Nicht mehr anrufen', grund);
  return 'Gesperrt: ' + l.name + ' wird nicht mehr angerufen.';
}

/* ---------- Dubletten ---------- */
function dubletten(o, ohneId){
  const fn = firmaNorm(o.name), ort = (o.ort || '').toLowerCase().trim();
  const tels = (o.telefone || []).map(telNorm).filter(Boolean), mails = (o.mails || []).map(mailNorm).filter(Boolean);
  return LEADS.filter(l => l.id !== ohneId && l.name !== '[gelöscht]').map(l => {
    let grund = null;
    if (tels.length && l.kontakte.some(k => tels.includes(telNorm(k.tel)))) grund = 'gleiche Telefonnummer';
    else if (mails.length && l.kontakte.some(k => mails.includes(mailNorm(k.mail)))) grund = 'gleiche E-Mail';
    else if (fn && fn.length > 3 && firmaNorm(l.name) === fn && (!ort || !l.ort || l.ort.toLowerCase().trim() === ort)) grund = 'gleicher Name';
    return grund ? { l, grund } : null;
  }).filter(Boolean);
}

function protokoll(l, wer, erg, x){
  x = x || {};
  const tel = istTel(l);
  if (tel && person(wer).rolle !== 'hv'){
    const t = anrufTag(wer, HEUTE);
    t.wahl++;
    if (erg !== 'nicht') t.erreicht++;
    if (erg === 'termin') t.termine++;
    if (erg === 'kein' && x.einwand) t.einwaende[x.einwand] = (t.einwaende[x.einwand] || 0) + 1;
    ANRUF_LOG.push({ id: MODUS.echt ? crypto.randomUUID() : ANRUF_LOG.length + 1, wer, lead: l.id, zeit: new Date().toISOString(), ergebnis: erg, einwand: x.einwand || null });
  }
  const art = tel ? 'anruf' : 'besuch';
  if (erg === 'nicht'){
    verlauf(l, wer, art, tel ? 'Nicht erreicht' : 'Nicht angetroffen');
    if (!l.next || l.next.datum <= HEUTE) l.next = { datum: tag(1), zeit: null, text: tel ? 'Nächster Anrufversuch' : 'Nochmal vorbeigehen' };
    if (tel && l.stufe === 'recherche') l.stufe = 'setting';
    return tel ? 'Notiert. Nächster Versuch morgen.' : 'Notiert. Wiedervorlage morgen.';
  }
  if (erg === 'rueckruf'){
    verlauf(l, wer, art, tel ? 'Erreicht, Rückruf vereinbart' : 'Gespräch, Wiedervorlage', dKurz(x.datum) + (x.zeit ? ' ' + x.zeit : ''));
    l.next = { datum: x.datum, zeit: x.zeit || null, text: tel ? 'Rückruf' : 'Wiedervorlage' };
    if (tel && l.stufe === 'recherche') l.stufe = 'setting';
    if (!tel && l.stufe === 'recherche') l.stufe = 'eigentuemer';
    return (tel ? 'Rückruf' : 'Wiedervorlage') + ' am ' + dKurz(x.datum) + ' eingetragen.';
  }
  if (erg === 'kein'){
    verlauf(l, wer, art, 'Kein Interesse', x.einwand ? 'Einwand: ' + x.einwand : null);
    verlustAufTermin(l);
    l.stufe = 'verloren'; l.verlustgrund = x.einwand || null; l.next = null;
    return 'Als verloren markiert' + (x.einwand ? ': ' + x.einwand : '') + '.';
  }
  if (erg === 'termin'){
    if (tel && x.closer){
      const closer = x.closer;
      l.setter = wer; l.closer = closer; l.betreuer = closer; l.stufe = 'termin'; l.terminStatus = 'geplant';
      l.uebergabe = { datum: HEUTE, von: wer, an: closer, termin: { datum: x.datum, zeit: x.zeit || null },
        entscheider: x.entscheider || 'unklar', bedarf: x.bedarf || '', budget: x.budget || 'unklar', einwaende: x.einwaende || [], notiz: x.notiz || '' };
      l.next = { datum: x.datum, zeit: x.zeit || null, text: 'Termin' + (closer !== wer ? ' von ' + person(wer).name : '') };
      terminEintrag({ lead: l.id, setter: wer, closer, datum: x.datum, zeit: x.zeit || null, status: 'geplant' });
      verlauf(l, wer, art, 'Termin vereinbart', dKurz(x.datum) + (x.zeit ? ' ' + x.zeit : '') + (closer !== wer ? ' · Übergabe an ' + person(closer).name : ''));
      return closer === wer ? 'Termin am ' + dKurz(x.datum) + ' eingetragen. Du closest selbst.'
                            : 'Termin am ' + dKurz(x.datum) + ' an ' + person(closer).name + ' übergeben.';
    }
    verlauf(l, wer, art, tel ? 'Termin vereinbart' : 'Besichtigung vereinbart', dKurz(x.datum) + (x.zeit ? ' ' + x.zeit : ''));
    l.next = { datum: x.datum, zeit: x.zeit || null, text: tel ? 'Termin' : 'Besichtigung' };
    if (tel){ l.stufe = 'termin'; if (!l.setter) l.setter = wer; }
    else { l.stufe = 'besichtigung'; }
    return (tel ? 'Termin' : 'Besichtigung') + ' am ' + dKurz(x.datum) + ' eingetragen.';
  }
}

function abschliessen(l, wer, w){
  const k = mandat(l.mandat).k;
  l.abschluss = { datum: HEUTE, status: 'offen' };
  if (k.typ === 'marge'){ l.abschluss.laufzeit = Number(w.laufzeit); l.abschluss.monatsbeitrag = Number(w.monatsbeitrag); }
  if (k.typ === 'prozent'){ l.abschluss.volumen = Number(w.volumen); }
  if (k.typ === 'kopf'){ l.abschluss.teilnehmer = Number(w.teilnehmer); l.abschluss.dealgroesse = Number(w.dealgroesse); }
  l.stufe = 'gewonnen'; l.next = null; l.verlustgrund = null;
  if (istTel(l) && !l.closer) l.closer = wer;
  if (istTel(l)) abschlussAufTermin(l);
  const hv = hvAnteil(l);
  verlauf(l, wer, 'abschluss', istTel(l) ? 'Abschluss' : 'Vom Mandanten freigegeben',
    'LUMIO ' + eur(lumioGesamt(l)) + (hv ? ' · ' + person(l.betreuer).name + ' ' + eur(hv) : ''));
  return (istTel(l) ? 'Abschluss gespeichert: ' : 'Freigabe gespeichert: ') + eur(lumioGesamt(l)) + ' für LUMIO.';
}

function offenerTermin(l){ for (let i = TERMINE.length - 1; i >= 0; i--){ const t = TERMINE[i]; if (t.lead === l.id && t.ergebnis === 'offen') return t; } return null; }

/* Closer trägt nach dem Termin ein, was passiert ist */
function terminErgebnis(l, wer, erg){
  const t = offenerTermin(l);
  if (erg === 'gelaufen'){
    if (t){ t.status = 'gelaufen'; }
    l.stufe = 'closing'; l.terminStatus = 'gelaufen';
    l.next = { datum: tag(2), zeit: null, text: 'Angebot nachfassen' };
    verlauf(l, wer, 'termin', 'Termin gelaufen');
    return 'Termin gelaufen. Lead ist jetzt im Closing.';
  }
  if (erg === 'noshow'){
    if (t){ t.status = 'noshow'; }
    l.noShows = (l.noShows || 0) + 1; l.terminStatus = 'noshow';
    l.stufe = 'setting';
    const s = l.setter || wer;
    l.betreuer = s;
    l.next = { datum: HEUTE, zeit: null, text: 'Nicht erschienen – neu terminieren' };
    verlauf(l, wer, 'termin', 'Nicht erschienen', s !== wer ? 'Zurück an ' + person(s).name + ' zum Neuterminieren' : 'Neu terminieren');
    return s !== wer ? 'No-Show. Zurück an ' + person(s).name + ' zum Neuterminieren.' : 'No-Show. Steht bei dir zum Neuterminieren.';
  }
}
function abschlussAufTermin(l){ const t = offenerTermin(l); if (t){ t.status = 'gelaufen'; t.ergebnis = 'abschluss'; } }
function verlustAufTermin(l){ const t = offenerTermin(l); if (t && t.status === 'gelaufen') t.ergebnis = 'verloren'; }

/* Setter- und Closer-Zahlen je Person im Zeitraum */
function setterCloser(pid, z){
  const ts = TERMINE.filter(t => imZeitraum(t.datum, z) && t.status !== 'geplant');
  const alsSetter = ts.filter(t => t.setter === pid);
  const gesetzt = TERMINE.filter(t => t.setter === pid && imZeitraum(t.datum, z)).length;
  const sGelaufen = alsSetter.filter(t => t.status === 'gelaufen').length;
  const sNoShow = alsSetter.filter(t => t.status === 'noshow').length;
  const sAbschluss = alsSetter.filter(t => t.ergebnis === 'abschluss').length;
  const alsCloser = ts.filter(t => t.closer === pid && t.status === 'gelaufen');
  const cAbschluss = alsCloser.filter(t => t.ergebnis === 'abschluss').length;
  return {
    gesetzt, gelaufenAlsSetter: sGelaufen, noShows: sNoShow, abschluesseAusGesetzten: sAbschluss,
    showRate: (sGelaufen + sNoShow) ? sGelaufen / (sGelaufen + sNoShow) : null,
    closingTermine: alsCloser.length, closingAbschluesse: cAbschluss,
    closingQuote: alsCloser.length ? cAbschluss / alsCloser.length : null
  };
}
function closerVorschlag(ausser){
  // Wer in den nächsten 7 Tagen am wenigsten Closing-Termine hat
  const gfs = PERSONEN.filter(p => p.rolle === 'gf');
  const last = p => TERMINE.filter(t => t.closer === p.id && t.status === 'geplant' && tageZwischen(HEUTE, t.datum) <= 7).length;
  return gfs.slice().sort((a, b) => last(a) - last(b))[0].id;
}
function quote(x){ return x === null || x === undefined ? '—' : Math.round(x * 100) + ' %'; }

function neuerLead(o){ return lead(o); }

/* Echte Daten aus der Datenbank übernehmen: Demo-Inhalte werden ersetzt */
function datenErsetzen(d){
  MODUS.echt = true;
  PERSONEN.splice(0, PERSONEN.length, ...d.personen);
  MANDATE.splice(0, MANDATE.length, ...d.mandate);
  LEADS.splice(0, LEADS.length, ...d.leads);
  TERMINE.splice(0, TERMINE.length, ...d.termine);
  ANRUF_TAGE.splice(0, ANRUF_TAGE.length, ...d.anrufTage);
  SPERRLISTE.splice(0, SPERRLISTE.length, ...d.sperrliste);
  ANRUF_LOG.length = 0;
}
function plural(n, ein, mehr){ return n + ' ' + (n === 1 ? ein : mehr); }
function hochrechnungBetrag(betrag){
  const tage = new Date(T0.getFullYear(), T0.getMonth() + 1, 0).getDate();
  return betrag / Math.max(1, T0.getDate()) * tage;
}
function umsatzMonat(mo, filter){ return LEADS.reduce((s, l) => s + (l.abschluss && filter(l) ? umsatzImMonat(l, mo) : 0), 0); }

export {
  T0, HEUTE, MONAT, tag, ym, ymAdd, tageZwischen, iso,
  PERSONEN, SYSTEM_PERSONEN, ZIEL_HV, MANDATE, STUFEN, EINWAENDE, LEADS, ANRUF_TAGE,
  mandat, person, stufeVon, istOffen, lumioGesamt, kundenwert, umsatzImMonat, hvAnteil, laufendImMonat,
  hochrechnungMonat, schaetzwert, pipelineGewichtet, ZEITRAEUME, monateVon, imZeitraum, anrufeImZeitraum, anrufTag,
  MONATSNAMEN, WOCHENTAGE, eur, zahl, prozent, dKurz, monatName, wann, faellig, ueberfaellig,
  verlauf, protokoll, abschliessen, neuerLead, plural, hochrechnungBetrag, umsatzMonat,
  istTel, BEREICHE, MODUS, SPERRLISTE, ANRUF_LOG, telNorm, mailNorm, firmaNorm, sperrTreffer, istGesperrt, sperreHinzu, sperren, dubletten, datenErsetzen,
  TERMINE, BUDGETS, ENTSCHEIDER, terminErgebnis, setterCloser, closerVorschlag, quote, verlustAufTermin
};
