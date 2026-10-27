/* Vor-Ort-Check für die Standortakquise (Kevins Feedback, 27.10.2026).
   Liegt am Lead als l.vorOrt = { flaeche, flaecheWas, strom, stromWo, sicht, sichtWas, standfuss,
   mietvertrag, unterschrift, installation, fotoFront, fotoAufbau }.
   Fragen sind "ja" / "nein" / leer, Bestätigungen true/false, Fotos ein Pfad oder data:-URL. */

/* Freie Sicht und Standfuß gibt es nur, wenn ein Screen aufgestellt wird */
export function mitScreen(m) {
  return /screen|bildschirm|display|monitor|\btv\b|wartezimmer-tv|dooh/i.test(((m && m.produkt) || '') + ' ' + ((m && m.name) || ''));
}

export function punkte(m) {
  const screen = mitScreen(m);
  return [
    { key: 'flaeche',      art: 'frage', gruppe: 'standort', text: 'Muss Fläche freigemacht werden?', zusatz: { wenn: 'ja', key: 'flaecheWas', label: 'Was wird entfernt?' } },
    { key: 'strom',        art: 'frage', gruppe: 'standort', text: 'Stromanschluss vorhanden?', zusatz: { wenn: 'ja', key: 'stromWo', label: 'Wo genau?' } },
    screen && { key: 'sicht',     art: 'frage', gruppe: 'check', text: 'Freie Sicht auf den Screen?', zusatz: { wenn: 'nein', key: 'sichtWas', label: 'Was steht im Weg? (Bestuhlung, Regale …)' } },
    screen && { key: 'standfuss', art: 'frage', gruppe: 'check', text: 'Standfuß passt?' },
    { key: 'mietvertrag',  art: 'haken', gruppe: 'check', text: 'Kontaktdaten im Mietvertrag überprüft' },
    { key: 'unterschrift', art: 'haken', gruppe: 'check', text: 'Vertragspartner ist unterschriftsberechtigt' },
    { key: 'installation', art: 'haken', gruppe: 'check', text: 'Ablauf der Installation besprochen' },
    { key: 'fotoFront',    art: 'foto',  gruppe: 'fotos', text: 'Frontansicht vom Laden' },
    { key: 'fotoAufbau',   art: 'foto',  gruppe: 'fotos', text: 'Aufbaustelle' },
  ].filter(Boolean);
}

function erledigt(p, v) {
  const x = v[p.key];
  if (p.art === 'haken') return x === true;
  if (p.art === 'foto') return !!x;
  return x === 'ja' || x === 'nein';
}

export function stand(l, m) {
  const v = l.vorOrt || {};
  const alle = punkte(m);
  const offen = alle.filter((p) => !erledigt(p, v));
  return { gesamt: alle.length, fertig: alle.length - offen.length, offen };
}

/* Ab "Beim Mandanten" soll der Check vollständig sein */
export const PRUEF_STUFEN = ['eingereicht', 'gewonnen'];
