-- Papierkorb für Leads (21.10.2026)
-- Geschäftsführung (und Claude-Verbindung) verschiebt Leads in den Papierkorb, statt sie sofort zu löschen.
-- Im Papierkorb sind Lead, Ansprechpartner, Verlauf, Termine und Abschluss für alle unsichtbar.
-- Wiederherstellen und endgültig löschen: nur Geschäftsführung. Nach 30 Tagen löscht ein nächtlicher Job endgültig.

alter table public.lead
  add column if not exists geloescht_am timestamptz,
  add column if not exists geloescht_von uuid references public.profil(id) on delete set null;
create index if not exists lead_papierkorb_idx on public.lead (geloescht_am) where geloescht_am is not null;

-- Leads im Papierkorb sieht niemand mehr (und damit auch nicht ihre Ansprechpartner und den Verlauf).
-- Direkt per Update kann niemand in den Papierkorb verschieben, das geht nur über die Funktionen unten.
create or replace function public.lead_sichtbar(l lead)
 returns boolean language sql stable set search_path to 'public'
as $$
  select l.geloescht_am is null and (
    ist_gf()
    or (ist_innen() and l.bereich in ('werbung', 'bildung') and auth.uid() in (l.betreuer_id, l.setter_id, l.closer_id))
    or (ist_hv() and l.bereich = 'standort' and l.betreuer_id = auth.uid())
    or ist_assistent())
$$;

create or replace function public.im_papierkorb(p_lead uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from lead where id = p_lead and geloescht_am is not null) $$;
revoke execute on function public.im_papierkorb(uuid) from public, anon;
grant execute on function public.im_papierkorb(uuid) to authenticated;

-- Termine und Abschlüsse von Leads im Papierkorb ausblenden
drop policy if exists papierkorb on public.termin;
create policy papierkorb on public.termin as restrictive for all to authenticated
  using (lead_id is null or not public.im_papierkorb(lead_id))
  with check (lead_id is null or not public.im_papierkorb(lead_id));
drop policy if exists papierkorb on public.abschluss;
create policy papierkorb on public.abschluss as restrictive for all to authenticated
  using (not public.im_papierkorb(lead_id))
  with check (not public.im_papierkorb(lead_id));

-- Signal für die Live-Aktualisierung: Wer einen Lead nicht mehr sehen darf, bekommt kein Update mehr.
-- Deshalb meldet diese Tabelle allen offenen Geräten, welche Leads weg sind (nur die ID).
create table if not exists public.lead_weg (
  id bigint generated always as identity primary key,
  lead_id uuid not null,
  profil_id uuid,
  zeit timestamptz not null default now()
);
alter table public.lead_weg enable row level security;
drop policy if exists lead_weg_lesen on public.lead_weg;
create policy lead_weg_lesen on public.lead_weg for select to authenticated using (ist_aktiv() or ist_assistent());
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lead_weg') then
    alter publication supabase_realtime add table public.lead_weg;
  end if;
end $$;

-- In den Papierkorb: Geschäftsführung oder Claude-Verbindung. Claude darf keine gewonnenen Leads mit Abschluss löschen.
create or replace function public.leads_in_papierkorb(p_ids uuid[])
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  if not (ist_gf() or ist_assistent()) then raise exception 'Nur die Geschäftsführung darf Einträge löschen'; end if;
  if coalesce(cardinality(p_ids), 0) = 0 then return 0; end if;
  if cardinality(p_ids) > 1000 then raise exception 'Höchstens 1000 Einträge auf einmal'; end if;
  if ist_assistent() and exists (select 1 from lead l where l.id = any(p_ids) and l.geloescht_am is null
      and (l.stufe = 'gewonnen' or exists (select 1 from abschluss a where a.lead_id = l.id))) then
    raise exception 'Gewonnene Leads mit Abschluss kann nur die Geschäftsführung in der App löschen';
  end if;
  with weg as (
    update lead set geloescht_am = now(), geloescht_von = auth.uid()
    where id = any(p_ids) and geloescht_am is null returning id)
  insert into lead_weg (lead_id, profil_id) select id, auth.uid() from weg;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.leads_wiederherstellen(p_ids uuid[])
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  if not ist_gf() then raise exception 'Nur die Geschäftsführung darf wiederherstellen'; end if;
  update lead set geloescht_am = null, geloescht_von = null where id = any(p_ids) and geloescht_am is not null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.papierkorb_liste()
 returns table (id uuid, name text, ort text, bereich text, mandat text, stufe text, kontakte integer,
                geloescht_am timestamptz, geloescht_von text, endgueltig_am timestamptz)
 language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not ist_gf() then raise exception 'Nur die Geschäftsführung sieht den Papierkorb'; end if;
  return query
    select l.id, l.name::text, l.ort::text, l.bereich::text, m.name::text, l.stufe::text,
      (select count(*)::integer from kontakt k where k.lead_id = l.id),
      l.geloescht_am, p.name::text, l.geloescht_am + interval '30 days'
    from lead l left join mandat m on m.id = l.mandat_id left join profil p on p.id = l.geloescht_von
    where l.geloescht_am is not null
    order by l.geloescht_am desc;
end $$;

create or replace function public.papierkorb_endgueltig(p_ids uuid[])
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  if not ist_gf() then raise exception 'Nur die Geschäftsführung darf endgültig löschen'; end if;
  delete from lead where id = any(p_ids) and geloescht_am is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Nächtlich: alles, was länger als 30 Tage im Papierkorb liegt, endgültig löschen
create or replace function public.papierkorb_leeren()
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  delete from lead where geloescht_am < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from lead_weg where zeit < now() - interval '7 days';
  return n;
end $$;

revoke execute on function public.leads_in_papierkorb(uuid[]) from public, anon;
revoke execute on function public.leads_wiederherstellen(uuid[]) from public, anon;
revoke execute on function public.papierkorb_liste() from public, anon;
revoke execute on function public.papierkorb_endgueltig(uuid[]) from public, anon;
revoke execute on function public.papierkorb_leeren() from public, anon, authenticated;
grant execute on function public.leads_in_papierkorb(uuid[]) to authenticated;
grant execute on function public.leads_wiederherstellen(uuid[]) to authenticated;
grant execute on function public.papierkorb_liste() to authenticated;
grant execute on function public.papierkorb_endgueltig(uuid[]) to authenticated;

select cron.schedule('lumio-papierkorb', '50 1 * * *', 'select public.papierkorb_leeren()');
