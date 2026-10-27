-- Vor-Ort-Check für die Standortakquise (Kevins Feedback, 27.10.2026):
-- Fläche freimachen, Strom, freie Sicht, Standfuß, Mietvertrag, Unterschriftsberechtigung,
-- Installationsablauf, Fotos Frontansicht und Aufbaustelle. Liegt als JSON am Lead.
alter table public.lead add column if not exists vor_ort jsonb not null default '{}'::jsonb;

-- Löschung auf Anfrage leert auch den Vor-Ort-Check (enthält Fotos)
create or replace function public.lead_anonymisieren(p_lead uuid, p_grund text default 'Löschung auf Anfrage'::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare k record;
begin
  if not ist_gf() then raise exception 'Nur die Geschäftsführung darf Daten löschen'; end if;
  for k in select id from kontakt where lead_id = p_lead loop
    perform kontakt_anonymisieren(k.id, p_grund);
  end loop;
  update lead set name = '[gelöscht]', adresse = null, felder = '{}', vor_ort = '{}', fotos = '{}', uebergabe = null, erfasst = null,
    lat = null, lng = null, next_datum = null, next_zeit = null, next_text = null,
    stufe = case when stufe = 'gewonnen' then stufe else 'verloren' end, verlustgrund = coalesce(verlustgrund, p_grund)
  where id = p_lead;
  update verlauf set text = null where lead_id = p_lead;
  update aenderung set alt = null, neu = null where datensatz = p_lead::text;
  insert into aenderung (tabelle, datensatz, aktion, neu) values ('lead', p_lead::text, 'anonymisiert', jsonb_build_object('grund', p_grund));
end $function$;
