# LUMIO Vertriebszentrale

CRM der LUMIO Connect UG für Werbemandate, Weiterbildung und Standortakquise.

- Oberfläche: React, Vite, Tailwind, shadcn/ui, Leaflet
- Daten und Login: Supabase (Frankfurt), Rechte per Row Level Security
- Die App läuft auf GitHub Pages (Branch `gh-pages`). Ohne `github.io` im Namen startet sie im Demo-Modus mit erfundenen Daten.

Im Code stehen keine geheimen Schlüssel. Der Supabase-Schlüssel in `src/daten/echt.ts` ist der öffentliche Publishable Key; was jemand sehen und ändern darf, entscheidet die Datenbank.

```
npm install
npm run dev     # lokal, Demo-Modus (mit ?echt gegen die echte Datenbank)
npm run build   # Ergebnis in dist/
```
