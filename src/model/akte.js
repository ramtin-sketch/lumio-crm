/* Mandats-Akte: mehrere Ansprechpartner, Verlauf und Termine/Aufgaben je Mandat (nur Geschäftsführung) */
import * as M from './model.js';

export const KONTAKTE = []; // { id, mandat, name, funktion, tel, mail, notiz, haupt, aktiv }
export const NOTIZEN = [];  // { id, mandat, wer, datum, titel, text, zeit }
export const TERMINE = [];  // { id, mandat, art: 'termin'|'aufgabe', titel, datum, zeit, ort, notiz, erledigt, wer }

export function datenErsetzen(d) {
  KONTAKTE.splice(0, KONTAKTE.length, ...d.kontakte);
  NOTIZEN.splice(0, NOTIZEN.length, ...d.notizen);
  TERMINE.splice(0, TERMINE.length, ...d.termine);
}
const sortT = (a, b) => (a.datum + (a.zeit || '99')).localeCompare(b.datum + (b.zeit || '99'));
export const kontakteVon = (mid) => KONTAKTE.filter((k) => k.mandat === mid && k.aktiv !== false).sort((a, b) => (b.haupt ? 1 : 0) - (a.haupt ? 1 : 0));
export const notizenVon = (mid) => NOTIZEN.filter((n) => n.mandat === mid).sort((a, b) => (b.zeit || b.datum).localeCompare(a.zeit || a.datum));
export const termineVon = (mid) => TERMINE.filter((t) => t.mandat === mid).sort(sortT);
export const offen = () => TERMINE.filter((t) => !t.erledigt).sort(sortT);
export const naechster = (mid) => offen().find((t) => t.mandat === mid) || null;
export const hauptkontakt = (mid) => kontakteVon(mid)[0] || null;
export const ueberfaellig = (t) => !t.erledigt && t.datum < M.HEUTE;
export const zeitText = (t) => M.dKurz(t.datum) + (t.zeit ? ' ' + String(t.zeit).slice(0, 5) : '');
