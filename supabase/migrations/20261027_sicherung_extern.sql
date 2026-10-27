-- Wöchentliche Sicherung außer Haus (27.10.2026): Sonntag 03:00 Uhr deutscher Winterzeit (02:00 UTC)
-- Ruft die Server-Funktion sicherung-extern auf; die legt eine verschlüsselte Kopie ins Google Drive der Geschäftsführung.
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sicherung_geheim') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sicherung_geheim', 'Zeitplan für die Sicherung außer Haus');
  end if;
end $$;

select cron.unschedule('lumio-sicherung-extern') where exists (select 1 from cron.job where jobname = 'lumio-sicherung-extern');
select cron.schedule('lumio-sicherung-extern', '0 2 * * 0', $job$
  select net.http_post(
    url := 'https://ehgjsvpbzgmlcgingkel.supabase.co/functions/v1/sicherung-extern',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-lumio-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'sicherung_geheim')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
$job$);
