-- Werbemandate zurück auf 4 Spalten (22.10.2026): "anrufversuch" läuft in "recherche" (Versuche bleiben gezählt),
-- "folgetermin" in "termin" (Hinweis auf der Karte).
update public.lead set stufe = 'recherche' where stufe = 'anrufversuch';
update public.lead set stufe = 'termin' where stufe = 'folgetermin';
