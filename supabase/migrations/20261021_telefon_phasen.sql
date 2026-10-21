-- Neue Phasen der Telefonakquise für Werbemandate (21.10.2026)
-- Neu → Im Anrufversuch (Zähler bis 6) → Erreicht → Termin steht → Folgetermin → Im Closing; dazu "Später wieder".
-- "Nicht erreicht", "Mailbox", "Zentrale" und "Falsche Nummer" zählen nur Versuche und ändern keine Phase mehr.

alter table public.lead add column if not exists versuche smallint not null default 0;

-- Mehr Anruf-Ergebnisse
alter table public.anruf drop constraint if exists anruf_ergebnis_check;
alter table public.anruf add constraint anruf_ergebnis_check check (ergebnis = any (array[
  'nicht', 'mailbox', 'zentrale', 'falsche_nummer',
  'rueckruf', 'info', 'falscher_ap', 'kein', 'spaeter', 'termin', 'gesperrt']));

-- Bestehende Werbe-Leads einordnen: "Im Setting", aber nie jemanden erreicht → "Im Anrufversuch" mit den bisherigen Versuchen
with versuche as (
  select l.id, count(a.*) filter (where a.ergebnis = 'nicht') as nicht,
         count(a.*) filter (where a.ergebnis not in ('nicht', 'mailbox', 'zentrale', 'falsche_nummer')) as erreicht
  from public.lead l left join public.anruf a on a.lead_id = l.id
  where l.bereich = 'werbung' and l.stufe = 'setting'
  group by l.id)
update public.lead l
set stufe = 'anrufversuch', versuche = least(v.nicht, 5)
from versuche v
where l.id = v.id and v.erreicht = 0;
