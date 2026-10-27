// Wöchentliche Sicherung außer Haus: alle CRM-Tabellen als JSON, gzip, verschlüsselt, ins Google Drive der Geschäftsführung.
// Verschlüsselung: zufälliger AES-256-GCM-Schlüssel je Sicherung, dieser wird mit dem öffentlichen RSA-4096-Schlüssel verschlüsselt.
// Entschlüsseln kann nur, wer den privaten Schlüssel hat (liegt bei Ramtin, NICHT in Supabase). In der App: Datenschutz → Sicherung öffnen.
// Aufruf: pg_cron (Kopfzeile x-lumio-cron mit dem Geheimnis aus dem Vault, Name "sicherung_geheim") oder die Geschäftsführung in der App.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const OEFFENTLICH = "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtCjUhelz5AQFDmRwquy5uSMO1KKmHQDPHk0yw3d3YZfAavUps0JM62XVQI0WPhnKetyFJFeQJ8frX857OTD8pvddcMHS3IFDiQAxNs4nkxutPVTBxwrvB73nsiolatnVafMuiXy/HzebdMKUFj2tCrtFKkzTKYlqGnTeJSVFAOVzFtWUhkacQByhL3UF54C6vEkCwt0Nze85fyqkhltIomUSOxhIUdLH5NkOCciJBVzcsjLgGkfjCNFUDiZhvyKKGN/oZZCAnT0Km7lXf8FIlMERs+EmJClZfABNlKeu3qvtkvAjFc8S1BwXPYRytfqH5BDGqGN8IHgrS/1Lhuvss6IZlqEKZT0+SU3dXgunllXsRQ+EeGmjRxUBe0CtcC8bOfLKVuvmZHGCXKUA+eteOU+ESNVVtiPwB/pPIRmXRp4gH5INHLbHsCUEXadBUtZeEVopW7HpfwtLvsm0CAFHpI5CBJp9ZwGD+ahopMOtTt2nhbQFDAmHNwf333jjqzAHWa6qIuoQVVezRmTXwoOKlKdKIxXCJs83lP8MziTG/kwFXi3l7k9CyYoQhUkzPv+UPB/cDfwnH1u85H4TzvmD1HEPfV/lFKWqmA+mwZKMjHh+n3rWInPqPoKocnTm5xIgD9biU2l0macoO3a9Ay+WqWnNqeaHNY+CkoNOHbIrifMCAwEAAQ==";
const ORDNER = "LUMIO CRM Sicherungen";
const BEHALTEN = 12; // die letzten 12 Wochen
const OHNE = ["sicherung", "google_anfrage", "claude_schluessel"];

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fehler extends Error { constructor(m: string, public status = 400) { super(m) } }

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) };
const ausB64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
function gleich(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0 }

async function darf(req: Request) {
  const cron = req.headers.get("x-lumio-cron") || "";
  if (cron) {
    const g = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'sicherung_geheim'`;
    if (g.length && g[0].decrypted_secret && gleich(cron, g[0].decrypted_secret)) return "automatisch";
    throw new Fehler("Kein Zugriff.", 401);
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) throw new Fehler("Kein Zugriff.", 401);
  const nutzer = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await nutzer.rpc("ist_gf");
  if (data !== true) throw new Fehler("Nur die Geschäftsführung darf Sicherungen anstoßen.", 403);
  return "von Hand";
}

/* ---------- Google ---------- */
async function zugang(): Promise<{ token: string; email: string }> {
  // Ziel ist das Drive eines Geschäftsführers mit Google-Verbindung (zuerst ramtin@lumiogroup.de)
  const z = await sql`select g.profil_id, g.google_email from public.google_verbindung g join public.profil p on p.id = g.profil_id
    where p.rolle = 'gf' and p.aktiv order by (g.google_email ilike 'ramtin@%') desc, g.verbunden_am limit 1`;
  if (!z.length) throw new Fehler("Kein Geschäftsführer hat Google verbunden.", 409);
  const rt = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${"google_rt_" + z[0].profil_id}`;
  if (!rt.length) throw new Fehler("Google-Zugang fehlt.", 409);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rt[0].decrypted_secret, grant_type: "refresh_token" }) });
  const d = await r.json();
  if (!r.ok) throw new Fehler("Google-Zugang abgelaufen. Bitte unter Kalender neu verbinden.", 409);
  if (!String(d.scope || "").includes("drive.file")) throw new Fehler("Für die Sicherung fehlt die Drive-Freigabe. Bitte unter Kalender Google trennen und neu verbinden.", 409);
  return { token: d.access_token, email: z[0].google_email };
}
async function drive(token: string, pfad: string, init: RequestInit = {}, basis = "https://www.googleapis.com/drive/v3") {
  const r = await fetch(basis + pfad, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + token } });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Fehler("Google Drive: " + (d?.error?.message || r.status), 502);
  return d;
}
async function ordner(token: string) {
  const q = new URLSearchParams({ q: `name = '${ORDNER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, fields: "files(id)" });
  const l = await drive(token, "/files?" + q);
  if (l.files?.length) return l.files[0].id as string;
  const n = await drive(token, "/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: ORDNER, mimeType: "application/vnd.google-apps.folder" }) });
  return n.id as string;
}

/* ---------- Sicherung ---------- */
async function verschluesseln(klar: Uint8Array) {
  const roh = ausB64(OEFFENTLICH);
  const rsa = await crypto.subtle.importKey("spki", roh as BufferSource, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const geheim = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, klar as BufferSource));
  const schluessel = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsa, new Uint8Array(await crypto.subtle.exportKey("raw", aes))));
  return JSON.stringify({ format: "lumio-sicherung", version: 1, verfahren: "RSA-OAEP-4096-SHA256 + AES-256-GCM, gzip", schluessel: b64(schluessel), iv: b64(iv), daten: b64(geheim) });
}

async function sichern(art: string) {
  const tabellen = (await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)
    .map((r: any) => r.table_name as string).filter((t: string) => !OHNE.includes(t));
  const daten: Record<string, unknown> = {}, zahlen: Record<string, number> = {};
  for (const t of tabellen) {
    const r = await sql`select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as d from ${sql("public." + t)} x`;
    daten[t] = r[0].d; zahlen[t] = (r[0].d as unknown[]).length;
  }
  const inhalt = new TextEncoder().encode(JSON.stringify({ erstellt: new Date().toISOString(), projekt: "LUMIO CRM", tabellen: daten }));
  const gepackt = new Uint8Array(await new Response(new Blob([inhalt]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  const datei = await verschluesseln(gepackt);

  const { token, email } = await zugang();
  const ziel = await ordner(token);
  const name = `LUMIO-CRM-Sicherung-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.lumio`;
  const grenze = "lumio" + crypto.randomUUID();
  const koerper = `--${grenze}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [ziel], mimeType: "application/octet-stream", description: "Verschlüsselte Sicherung des LUMIO-CRM. Öffnen nur mit dem privaten Schlüssel in der App unter Datenschutz." })}\r\n--${grenze}\r\nContent-Type: application/octet-stream\r\n\r\n${datei}\r\n--${grenze}--`;
  const neu = await drive(token, "/files?uploadType=multipart&fields=id,name,size", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + grenze }, body: koerper }, "https://www.googleapis.com/upload/drive/v3");

  // Ältere Sicherungen im Ordner aufräumen (nur die, die diese App selbst angelegt hat)
  const alle = await drive(token, "/files?" + new URLSearchParams({ q: `'${ziel}' in parents and trashed = false`, orderBy: "createdTime desc", fields: "files(id,name)", pageSize: "100" }));
  for (const f of (alle.files || []).slice(BEHALTEN)) await drive(token, "/files/" + f.id, { method: "DELETE" }).catch(() => null);

  const kb = Math.max(1, Math.round(datei.length / 1024));
  await sql`insert into public.sicherung (art, erstellt_von, tabellen, daten, groesse_kb) values (${"extern (Google Drive, " + art + ")"}, null, ${sql.json(zahlen)}, null, ${kb})`;
  return { ok: true, datei: neu.name, drive: email, groesse_kb: kb, tabellen: zahlen };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ fehler: "Nur POST" }, 405);
  try {
    const art = await darf(req);
    return json(await sichern(art));
  } catch (e) {
    const s = e instanceof Fehler ? e.status : 500;
    if (s === 500) console.error(e);
    return json({ fehler: e instanceof Fehler ? e.message : "Interner Fehler" }, s);
  }
});
