// LUMIO CRM ↔ Google Kalender.
// Jede Person verbindet einmal ihren eigenen Google-Kalender (Google-Anmeldung, interne Workspace-App).
// Der Zugangsschlüssel (Refresh-Token) liegt verschlüsselt im Supabase-Vault und verlässt den Server nie.
// Rechte:
//  - Geschäftsführung sieht die Termine aller verbundenen Kalender mit Details.
//  - Alle anderen sehen ihre eigenen Termine; bei Closern und Geschäftsführung nur "belegt" (ohne Inhalt).
//  - Setter, Closer und Geschäftsführung dürfen einen Closing-Termin in den Kalender eines Closers bzw. der GF eintragen.
//  - Handelsvertreter und das Claude-Konto haben hier keinen Zugriff auf fremde Kalender.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3, idle_timeout: 20 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const RUECKRUF = `${SUPABASE_URL}/functions/v1/google-kalender/rueckruf`;
const ZONE = "Europe/Berlin";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];
const ZIEL_ROLLEN = ["gf", "closer"]; // in deren Kalender dürfen Closing-Termine eingetragen werden

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Fehler extends Error { constructor(m: string, public status = 400) { super(m) } }

/* ---------- Tokens ---------- */
const tresorName = (pid: string) => "google_rt_" + pid;
async function refreshLesen(pid: string): Promise<string | null> {
  const r = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${tresorName(pid)}`;
  return r[0]?.decrypted_secret ?? null;
}
async function refreshSpeichern(pid: string, token: string) {
  const r = await sql`select id from vault.secrets where name = ${tresorName(pid)}`;
  if (r.length) await sql`select vault.update_secret(${r[0].id}::uuid, ${token})`;
  else await sql`select vault.create_secret(${token}, ${tresorName(pid)}, 'Google-Kalender LUMIO CRM')`;
}
async function refreshLoeschen(pid: string) { await sql`delete from vault.secrets where name = ${tresorName(pid)}` }

const zugangsCache = new Map<string, { token: string; bis: number }>();
async function zugang(pid: string): Promise<string> {
  const c = zugangsCache.get(pid)
  if (c && c.bis > Date.now() + 60000) return c.token;
  const rt = await refreshLesen(pid);
  if (!rt) throw new Fehler("Kalender nicht verbunden", 409);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rt, grant_type: "refresh_token" }),
  });
  const d = await r.json();
  if (!r.ok) {
    const text = d.error === "invalid_grant" ? "Google-Zugang abgelaufen oder entzogen. Bitte neu verbinden." : "Google antwortet nicht wie erwartet.";
    await sql`update public.google_verbindung set fehler = ${text} where profil_id = ${pid}`;
    throw new Fehler(text, 409);
  }
  zugangsCache.set(pid, { token: d.access_token, bis: Date.now() + (d.expires_in || 3000) * 1000 });
  await sql`update public.google_verbindung set zuletzt_ok = now(), fehler = null where profil_id = ${pid}`;
  return d.access_token;
}
async function google(pid: string, pfad: string, init: RequestInit = {}) {
  const t = await zugang(pid);
  const r = await fetch("https://www.googleapis.com/calendar/v3" + pfad, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + t, "Content-Type": "application/json" } });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Fehler("Google Kalender: " + (d?.error?.message || r.status), r.status === 404 ? 404 : 502);
  return d;
}

/* ---------- Wer fragt? ---------- */
async function anrufer(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const alsNutzer = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const [{ data: aktiv }, { data: u }] = await Promise.all([alsNutzer.rpc("ist_aktiv"), alsNutzer.auth.getUser()]);
  if (aktiv !== true || !u?.user) throw new Fehler("Bitte neu anmelden (mit Zwei-Faktor-Code).", 401);
  const p = await sql`select id, name, rolle::text as rolle from public.profil where id = ${u.user.id} and aktiv`;
  if (!p.length || p[0].rolle === "assistent") throw new Fehler("Kein Zugriff.", 403);
  return p[0] as { id: string; name: string; rolle: string };
}
const team = () => sql`select p.id, p.name, p.rolle::text as rolle, g.google_email from public.profil p
  left join public.google_verbindung g on g.profil_id = p.id where p.aktiv and p.rolle::text <> 'assistent'`;

/* ---------- Rückruf von Google (Browserfenster, ohne Anmeldung) ---------- */
function seite(titel: string, text: string, gut: boolean) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titel}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f7f9;color:#0e1523}
main{max-width:360px;padding:32px;background:#fff;border-radius:16px;box-shadow:0 1px 3px #0001;text-align:center}
.z{width:48px;height:48px;border-radius:12px;margin:0 auto 16px;display:grid;place-items:center;color:#fff;background:${gut ? "#2244CC" : "#c92a2a"};font-size:24px}
h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#556;margin:0}</style></head>
<body><main><div class="z">${gut ? "✓" : "!"}</div><h1>${titel}</h1><p>${text}</p></main>
<script>try{window.opener&&window.opener.postMessage({lumioGoogle:${gut}},"*")}catch(e){};${gut ? "setTimeout(function(){window.close()},1500)" : ""}</script></body></html>`;
  return new Response(html, { status: gut ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
async function rueckruf(url: URL) {
  const code = url.searchParams.get("code"), state = url.searchParams.get("state") || "";
  if (url.searchParams.get("error")) return seite("Abgebrochen", "Der Kalender wurde nicht verbunden. Du kannst dieses Fenster schließen.", false);
  const a = await sql`delete from public.google_anfrage where state = ${state} and erstellt_am > now() - interval '15 minutes' returning profil_id`;
  if (!code || !a.length) return seite("Link abgelaufen", "Bitte in der LUMIO-App nochmal auf „Google-Kalender verbinden“ tippen.", false);
  const pid = a[0].profil_id as string;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: RUECKRUF, grant_type: "authorization_code" }),
  });
  const d = await r.json();
  if (!r.ok || !d.refresh_token) return seite("Hat nicht geklappt", "Google hat keinen dauerhaften Zugang erteilt. Bitte nochmal verbinden und alle Häkchen setzen.", false);
  const fehlend = SCOPES.filter((s) => s.startsWith("https://") && !String(d.scope || "").includes(s));
  if (fehlend.length) return seite("Häkchen fehlt", "Bitte beim Verbinden den Kalender-Zugriff erlauben (alle Häkchen setzen).", false);
  // E-Mail aus dem ID-Token (kommt direkt von Google über die verschlüsselte Verbindung)
  let email = "";
  try { email = JSON.parse(atob(d.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email || "" } catch (_) {}
  await refreshSpeichern(pid, d.refresh_token);
  zugangsCache.set(pid, { token: d.access_token, bis: Date.now() + (d.expires_in || 3000) * 1000 });
  await sql`insert into public.google_verbindung (profil_id, google_email, verbunden_am, zuletzt_ok, fehler) values (${pid}, ${email}, now(), now(), null)
    on conflict (profil_id) do update set google_email = excluded.google_email, verbunden_am = now(), zuletzt_ok = now(), fehler = null`;
  return seite("Kalender verbunden", `${email || "Dein Kalender"} ist jetzt mit der LUMIO-App verbunden. Dieses Fenster schließt sich gleich.`, true);
}

/* ---------- Aktionen ---------- */
const zeitText = (e: any) => e.start?.dateTime ? { start: e.start.dateTime, ende: e.end?.dateTime, ganztags: false } : { start: e.start?.date, ende: e.end?.date, ganztags: true };

async function termineVon(pid: string, von: string, bis: string, details: boolean) {
  if (details) {
    const q = new URLSearchParams({ timeMin: von, timeMax: bis, singleEvents: "true", orderBy: "startTime", maxResults: "250", timeZone: ZONE });
    const d = await google(pid, `/calendars/primary/events?${q}`);
    return (d.items || []).filter((e: any) => e.status !== "cancelled" && e.eventType !== "workingLocation").map((e: any) => ({
      id: e.id, titel: e.summary || "(ohne Titel)", ...zeitText(e), ort: e.location || null, link: e.htmlLink || null,
      meet: e.hangoutLink || e.conferenceData?.entryPoints?.find((x: any) => x.entryPointType === "video")?.uri || null,
      teilnehmer: (e.attendees || []).filter((a: any) => !a.self).map((a: any) => a.displayName || a.email).slice(0, 8),
      abgesagt: (e.attendees || []).some((a: any) => a.self && a.responseStatus === "declined"),
    })).filter((e: any) => !e.abgesagt);
  }
  const d = await google(pid, "/freeBusy", { method: "POST", body: JSON.stringify({ timeMin: von, timeMax: bis, timeZone: ZONE, items: [{ id: "primary" }] }) });
  return (d.calendars?.primary?.busy || []).map((b: any, i: number) => ({ id: "b" + i, titel: "belegt", start: b.start, ende: b.end, ganztags: false, belegt: true }));
}

async function aktion(ich: { id: string; name: string; rolle: string }, b: any) {
  const gf = ich.rolle === "gf";
  switch (b.aktion) {
    case "stand": {
      const t = await team();
      return {
        eingerichtet: !!(CLIENT_ID && CLIENT_SECRET),
        team: t.map((p: any) => ({ id: p.id, name: p.name, rolle: p.rolle, verbunden: !!p.google_email, email: gf || p.id === ich.id ? p.google_email : null })),
      };
    }
    case "start": {
      if (!CLIENT_ID || !CLIENT_SECRET) throw new Fehler("Die Google-Anbindung ist noch nicht eingerichtet (Google-Cloud-Zugang fehlt).", 503);
      const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");
      await sql`delete from public.google_anfrage where erstellt_am < now() - interval '1 hour'`;
      await sql`insert into public.google_anfrage (state, profil_id) values (${state}, ${ich.id})`;
      const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: RUECKRUF, response_type: "code", scope: SCOPES.join(" "),
        access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, hd: "lumiogroup.de" });
      return { url: "https://accounts.google.com/o/oauth2/v2/auth?" + q };
    }
    case "trennen": {
      const ziel = gf && b.profil ? String(b.profil) : ich.id;
      const rt = await refreshLesen(ziel);
      if (rt) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(rt), { method: "POST" }).catch(() => {});
      await refreshLoeschen(ziel);
      zugangsCache.delete(ziel);
      await sql`delete from public.google_verbindung where profil_id = ${ziel}`;
      return { ok: true };
    }
    case "termine": {
      const von = String(b.von), bis = String(b.bis);
      if (isNaN(Date.parse(von)) || isNaN(Date.parse(bis)) || Date.parse(bis) - Date.parse(von) > 62 * 86400000) throw new Fehler("Zeitraum ungültig (höchstens 2 Monate).");
      const t = await team();
      const darf = (p: any) => p.google_email && (gf || p.id === ich.id || (ich.rolle !== "handelsvertreter" && ZIEL_ROLLEN.includes(p.rolle)));
      const gewuenscht = Array.isArray(b.personen) && b.personen.length ? t.filter((p: any) => b.personen.includes(p.id)) : t;
      const ergebnis: any[] = [];
      await Promise.all(gewuenscht.filter(darf).map(async (p: any) => {
        try { ergebnis.push({ profil: p.id, termine: await termineVon(p.id, von, bis, gf || p.id === ich.id) }) }
        catch (e) { ergebnis.push({ profil: p.id, fehler: (e as Error).message, termine: [] }) }
      }));
      return { kalender: ergebnis };
    }
    case "frei": {
      if (ich.rolle === "handelsvertreter") throw new Fehler("Kein Zugriff.", 403);
      const z = (await team()).find((p: any) => p.id === b.closer);
      if (!z || !ZIEL_ROLLEN.includes(z.rolle)) throw new Fehler("Unbekannter Closer.");
      if (!z.google_email) return { verbunden: false, belegt: [] };
      const d = await google(z.id, "/freeBusy", { method: "POST", body: JSON.stringify({ timeMin: b.von, timeMax: b.bis, timeZone: ZONE, items: [{ id: "primary" }] }) });
      return { verbunden: true, belegt: d.calendars?.primary?.busy || [] };
    }
    case "anlegen": {
      if (ich.rolle === "handelsvertreter") throw new Fehler("Kein Zugriff.", 403);
      const z = (await team()).find((p: any) => p.id === b.closer);
      if (!z || !ZIEL_ROLLEN.includes(z.rolle)) throw new Fehler("Unbekannter Closer.");
      if (!z.google_email) throw new Fehler(`${z.name} hat den Google-Kalender noch nicht verbunden.`, 409);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.datum) || !/^\d{2}:\d{2}$/.test(b.zeit)) throw new Fehler("Datum oder Uhrzeit fehlt.");
      const dauer = Math.min(Math.max(Number(b.dauer) || 30, 15), 240);
      const [h, m] = b.zeit.split(":").map(Number), endeMin = h * 60 + m + dauer;
      const ende = `${b.datum}T${String(Math.floor(endeMin / 60) % 24).padStart(2, "0")}:${String(endeMin % 60).padStart(2, "0")}:00`;
      const gaeste: any[] = [];
      const setter = (await team()).find((p: any) => p.id === ich.id);
      if (setter?.google_email && ich.id !== z.id) gaeste.push({ email: setter.google_email, optional: true });
      if (b.einladen && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.kunde_email || "")) gaeste.push({ email: String(b.kunde_email).trim() });
      const ereignis: any = {
        summary: String(b.titel || "Closing-Termin").slice(0, 200),
        description: String(b.beschreibung || "").slice(0, 6000),
        location: b.ort ? String(b.ort).slice(0, 300) : undefined,
        start: { dateTime: `${b.datum}T${b.zeit}:00`, timeZone: ZONE },
        end: { dateTime: ende, timeZone: ZONE },
        attendees: gaeste.length ? gaeste : undefined,
        reminders: { useDefault: true },
        extendedProperties: { private: { lumio_termin: String(b.termin_id || ""), lumio_gesetzt_von: ich.id } },
      };
      if (b.meet) ereignis.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
      const q = new URLSearchParams({ conferenceDataVersion: b.meet ? "1" : "0", sendUpdates: b.einladen ? "all" : "none" });
      const e = await google(z.id, `/calendars/primary/events?${q}`, { method: "POST", body: JSON.stringify(ereignis) });
      const meet = e.hangoutLink || e.conferenceData?.entryPoints?.find((x: any) => x.entryPointType === "video")?.uri || null;
      return { id: e.id, link: e.htmlLink, meet };
    }
    case "absagen": {
      if (ich.rolle === "handelsvertreter") throw new Fehler("Kein Zugriff.", 403);
      const z = (await team()).find((p: any) => p.id === b.closer);
      if (!z?.google_email || !b.event) return { ok: false };
      // Nur Termine löschen, die über das CRM entstanden sind
      const e = await google(z.id, `/calendars/primary/events/${encodeURIComponent(b.event)}`).catch(() => null);
      if (!e || !e.extendedProperties?.private?.lumio_gesetzt_von) return { ok: false };
      await google(z.id, `/calendars/primary/events/${encodeURIComponent(b.event)}?sendUpdates=${b.benachrichtigen ? "all" : "none"}`, { method: "DELETE" });
      return { ok: true };
    }
  }
  throw new Fehler("Unbekannte Aktion");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.pathname.endsWith("/rueckruf")) return await rueckruf(url);
    if (req.method !== "POST") return json({ fehler: "Nur POST" }, 405);
    const ich = await anrufer(req);
    let b: any; try { b = await req.json() } catch { return json({ fehler: "Ungültige Anfrage" }, 400) }
    return json(await aktion(ich, b));
  } catch (e) {
    const s = e instanceof Fehler ? e.status : 500;
    if (s === 500) console.error(e);
    return json({ fehler: e instanceof Fehler ? e.message : "Interner Fehler" }, s);
  }
});
