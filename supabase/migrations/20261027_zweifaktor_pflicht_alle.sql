-- 2FA ist für alle Menschen im Team Pflicht (27.10.2026), nicht mehr nur für die Geschäftsführung.
-- Ausnahme: das Claude-Konto (kein Login per Passwort, Zugang nur über den geheimen Schlüssel).
create or replace function public.zweifaktor_pflicht()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((select p.rolle <> 'assistent' or p.zweifaktor_pflicht from public.profil p where p.id = auth.uid()), false)
$function$;

update public.profil set zweifaktor_pflicht = true where rolle <> 'assistent';
alter table public.profil alter column zweifaktor_pflicht set default true;
