import * as React from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { PersonAvatar } from "@/bits"
import { neuZeichnen, useDaten, useUI } from "@/store"
import { akteKontaktSpeichern, akteNotizHinzu, akteTerminSpeichern } from "@/daten/echt"
import * as M from "@/model/model.js"
import * as A from "@/model/akte.js"
import { toast } from "sonner"
import { CalendarClock, ListTodo, Loader2, Mail, MapPin, Pencil, Phone, Plus, Star } from "lucide-react"

/* Mandats-Akte: Ansprechpartner, nächste Schritte (Termine/Aufgaben) und Verlauf je Mandat. Nur Geschäftsführung. */

let offenesMandat: string | null = null
let startReiter = "schritte"
const hoerer = new Set<() => void>()
export function oeffneAkte(mid: string, reiter = "schritte") { offenesMandat = mid; startReiter = reiter; hoerer.forEach((f) => f()) }
function schliessen() { offenesMandat = null; hoerer.forEach((f) => f()) }
const useOffen = () => React.useSyncExternalStore((cb) => { hoerer.add(cb); return () => hoerer.delete(cb) }, () => offenesMandat)

export const STATUS_TEXT: Record<string, string> = { anbahnung: "Anbahnung", verhandlung: "in Verhandlung", aktiv: "aktiv", pausiert: "pausiert", beendet: "beendet" }
const neueId = () => crypto.randomUUID()

export function MandatAkte() {
  const mid = useOffen()
  const ui = useUI()
  if (!ui.istGF) return null
  return (
    <Sheet open={!!mid} onOpenChange={(o) => !o && schliessen()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {mid && <Inhalt key={mid} mid={mid} />}
      </SheetContent>
    </Sheet>
  )
}

function Inhalt({ mid }: { mid: string }) {
  useDaten()
  const m = (M.MANDATE as any[]).find((x) => x.id === mid)
  const [reiter, setReiter] = React.useState(startReiter)
  if (!m) return <SheetHeader><SheetTitle>Mandat nicht gefunden</SheetTitle></SheetHeader>
  const offen = A.termineVon(mid).filter((t: any) => !t.erledigt)
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">{m.name}<Badge variant="secondary" className="font-normal">{STATUS_TEXT[m.status] || m.status}</Badge></SheetTitle>
        <SheetDescription>{m.produkt || "Mandat"}{m.ktext ? " · " + m.ktext : ""}</SheetDescription>
      </SheetHeader>
      <Tabs value={reiter} onValueChange={setReiter} className="px-4 pb-6">
        <TabsList className="w-full">
          <TabsTrigger value="schritte">Nächste Schritte{offen.length ? ` (${offen.length})` : ""}</TabsTrigger>
          <TabsTrigger value="kontakte">Ansprechpartner</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
        </TabsList>
        <TabsContent value="schritte" className="mt-4"><Schritte mid={mid} /></TabsContent>
        <TabsContent value="kontakte" className="mt-4"><Kontakte mid={mid} /></TabsContent>
        <TabsContent value="verlauf" className="mt-4"><Verlauf mid={mid} /></TabsContent>
      </Tabs>
    </>
  )
}

/* ---------- Nächste Schritte ---------- */
function Schritte({ mid }: { mid: string }) {
  const ui = useUI()
  const alle = A.termineVon(mid)
  const offen = alle.filter((t: any) => !t.erledigt), erledigt = alle.filter((t: any) => t.erledigt).reverse()
  const [form, setForm] = React.useState<any | null>(null)
  const [alteZeigen, setAlteZeigen] = React.useState(false)
  async function abhaken(t: any, wert: boolean) {
    try { await akteTerminSpeichern({ ...t, erledigt: wert }); neuZeichnen() } catch (x: any) { toast(x.message) }
  }
  return (
    <div className="grid gap-3">
      {form ? <TerminForm t={form} onFertig={() => setForm(null)} />
        : <Button variant="outline" size="sm" className="justify-start" onClick={() => setForm({ id: neueId(), mandat: mid, art: "termin", titel: "", datum: M.HEUTE, zeit: "", ort: "", notiz: "", erledigt: false, wer: ui.ich })}><Plus />Termin oder Aufgabe</Button>}
      {!offen.length && !form && <p className="py-4 text-center text-sm text-muted-foreground">Nichts geplant. Was ist der nächste Schritt?</p>}
      {offen.map((t: any) => <TerminZeile key={t.id} t={t} onHaken={abhaken} onBearbeiten={() => setForm({ ...t, zeit: t.zeit || "" })} />)}
      {!!erledigt.length && (
        <div className="mt-2">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setAlteZeigen((x) => !x)}>{alteZeigen ? "Erledigte ausblenden" : `${erledigt.length} erledigt anzeigen`}</Button>
          {alteZeigen && <div className="grid gap-2 opacity-70">{erledigt.map((t: any) => <TerminZeile key={t.id} t={t} onHaken={abhaken} />)}</div>}
        </div>
      )}
    </div>
  )
}

function TerminZeile({ t, onHaken, onBearbeiten }: { t: any; onHaken: (t: any, w: boolean) => void; onBearbeiten?: () => void }) {
  const rot = A.ueberfaellig(t)
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Checkbox className="mt-0.5" checked={t.erledigt} onCheckedChange={(w) => onHaken(t, !!w)} aria-label={(t.erledigt ? "Wieder öffnen: " : "Erledigt: ") + t.titel} />
      <div className="min-w-0 flex-1 text-sm">
        <div className={"font-medium " + (t.erledigt ? "line-through" : "")}>{t.titel}</div>
        <div className={"flex flex-wrap items-center gap-x-3 gap-y-1 text-xs " + (rot ? "text-destructive" : "text-muted-foreground")}>
          <span className="flex items-center gap-1">{t.art === "aufgabe" ? <ListTodo className="size-3" /> : <CalendarClock className="size-3" />}{A.zeitText(t)}{rot ? " · überfällig" : ""}</span>
          {t.ort && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3" />{t.ort}</span>}
        </div>
        {t.notiz && <p className="mt-1 whitespace-pre-line text-muted-foreground">{t.notiz}</p>}
      </div>
      {t.wer && <PersonAvatar id={t.wer} />}
      {onBearbeiten && <Button variant="ghost" size="icon" className="size-7" aria-label={t.titel + " bearbeiten"} onClick={onBearbeiten}><Pencil /></Button>}
    </div>
  )
}

function TerminForm({ t, onFertig }: { t: any; onFertig: () => void }) {
  const [w, setW] = React.useState(t)
  const [laeuft, setLaeuft] = React.useState(false)
  const set = (k: string, v: any) => setW((x: any) => ({ ...x, [k]: v }))
  const team = (M.PERSONEN as any[]).filter((p) => p.aktiv !== false)
  async function speichern(e: React.FormEvent) {
    e.preventDefault(); setLaeuft(true)
    try { await akteTerminSpeichern({ ...w, titel: w.titel.trim(), zeit: w.zeit || null }); neuZeichnen(); onFertig() } catch (x: any) { toast(x.message) } finally { setLaeuft(false) }
  }
  return (
    <form onSubmit={speichern} className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <NativeSelect aria-label="Art" value={w.art} onChange={(e) => set("art", e.target.value)} className="w-32">
          <NativeSelectOption value="termin">Termin</NativeSelectOption><NativeSelectOption value="aufgabe">Aufgabe</NativeSelectOption>
        </NativeSelect>
        <Input aria-label="Was" placeholder={w.art === "termin" ? "z. B. Call mit Geschäftsführung" : "z. B. Angebot nachfassen"} value={w.titel} onChange={(e) => set("titel", e.target.value)} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1"><Label htmlFor="at-d" className="text-xs text-muted-foreground">Datum</Label><Input id="at-d" type="date" value={w.datum} onChange={(e) => set("datum", e.target.value)} required /></div>
        <div className="grid gap-1"><Label htmlFor="at-z" className="text-xs text-muted-foreground">Uhrzeit (optional)</Label><Input id="at-z" type="time" value={w.zeit || ""} onChange={(e) => set("zeit", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input aria-label="Ort oder Link" placeholder="Ort oder Link" value={w.ort} onChange={(e) => set("ort", e.target.value)} />
        <NativeSelect aria-label="Zuständig" value={w.wer || ""} onChange={(e) => set("wer", e.target.value || null)}>
          <NativeSelectOption value="">Niemand</NativeSelectOption>
          {team.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.voll}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <Textarea aria-label="Notiz" placeholder="Notiz (optional)" value={w.notiz} onChange={(e) => set("notiz", e.target.value)} className="min-h-14" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onFertig}>Abbrechen</Button>
        <Button type="submit" size="sm" disabled={laeuft}>{laeuft && <Loader2 className="animate-spin" />}Speichern</Button>
      </div>
    </form>
  )
}

/* ---------- Ansprechpartner ---------- */
function Kontakte({ mid }: { mid: string }) {
  const ks = A.kontakteVon(mid)
  const [form, setForm] = React.useState<any | null>(null)
  return (
    <div className="grid gap-3">
      {form ? <KontaktForm k={form} onFertig={() => setForm(null)} />
        : <Button variant="outline" size="sm" className="justify-start" onClick={() => setForm({ id: neueId(), mandat: mid, name: "", funktion: "", tel: "", mail: "", notiz: "", haupt: !ks.length, aktiv: true })}><Plus />Ansprechpartner</Button>}
      {!ks.length && !form && <p className="py-4 text-center text-sm text-muted-foreground">Noch niemand eingetragen.</p>}
      {ks.map((k: any) => (
        <div key={k.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-medium">{k.name}{k.haupt && <Star className="size-3.5 fill-current text-warn" aria-label="Hauptkontakt" />}</div>
              {k.funktion && <div className="text-muted-foreground">{k.funktion}</div>}
            </div>
            <Button variant="ghost" size="icon" className="size-7" aria-label={k.name + " bearbeiten"} onClick={() => setForm({ ...k })}><Pencil /></Button>
          </div>
          {(k.tel || k.mail) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {k.tel && <Button asChild variant="outline" size="xs"><a href={"tel:" + k.tel.replace(/\s/g, "")}><Phone />{k.tel}</a></Button>}
              {k.mail && <Button asChild variant="outline" size="xs"><a href={"mailto:" + k.mail}><Mail />{k.mail}</a></Button>}
            </div>
          )}
          {k.notiz && <p className="mt-2 whitespace-pre-line text-muted-foreground">{k.notiz}</p>}
        </div>
      ))}
    </div>
  )
}

function KontaktForm({ k, onFertig }: { k: any; onFertig: () => void }) {
  const [w, setW] = React.useState(k)
  const [laeuft, setLaeuft] = React.useState(false)
  const set = (f: string, v: any) => setW((x: any) => ({ ...x, [f]: v }))
  async function speichern(e: React.FormEvent, entfernen = false) {
    e.preventDefault(); setLaeuft(true)
    try {
      // Nur ein Hauptkontakt je Mandat
      if (w.haupt && !entfernen) for (const x of A.kontakteVon(w.mandat)) if (x.id !== w.id && x.haupt) await akteKontaktSpeichern({ ...x, haupt: false })
      await akteKontaktSpeichern({ ...w, name: w.name.trim(), aktiv: !entfernen })
      neuZeichnen(); onFertig()
    } catch (x: any) { toast(x.message) } finally { setLaeuft(false) }
  }
  const bekannt = A.KONTAKTE.some((x: any) => x.id === k.id)
  return (
    <form onSubmit={speichern} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input aria-label="Name" placeholder="Name" value={w.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
        <Input aria-label="Funktion" placeholder="Funktion" value={w.funktion} onChange={(e) => set("funktion", e.target.value)} />
        <Input aria-label="Telefon" placeholder="Telefon" type="tel" value={w.tel} onChange={(e) => set("tel", e.target.value)} />
        <Input aria-label="E-Mail" placeholder="E-Mail" type="email" value={w.mail} onChange={(e) => set("mail", e.target.value)} />
      </div>
      <Textarea aria-label="Notiz" placeholder="Notiz (optional)" value={w.notiz} onChange={(e) => set("notiz", e.target.value)} className="min-h-12" />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={w.haupt} onCheckedChange={(v) => set("haupt", !!v)} />Hauptkontakt</label>
      <div className="flex justify-end gap-2">
        {bekannt && <Button type="button" variant="ghost" size="sm" className="mr-auto text-destructive" disabled={laeuft} onClick={(e) => speichern(e as any, true)}>Ist nicht mehr dabei</Button>}
        <Button type="button" variant="ghost" size="sm" onClick={onFertig}>Abbrechen</Button>
        <Button type="submit" size="sm" disabled={laeuft}>{laeuft && <Loader2 className="animate-spin" />}Speichern</Button>
      </div>
    </form>
  )
}

/* ---------- Verlauf ---------- */
function Verlauf({ mid }: { mid: string }) {
  const ui = useUI()
  const ns = A.notizenVon(mid)
  const [text, setText] = React.useState("")
  const [laeuft, setLaeuft] = React.useState(false)
  async function hinzu(e: React.FormEvent) {
    e.preventDefault(); if (!text.trim()) return
    setLaeuft(true)
    try { await akteNotizHinzu({ id: neueId(), mandat: mid, titel: "", text: text.trim(), wer: ui.ich }); setText(""); neuZeichnen() } catch (x: any) { toast(x.message) } finally { setLaeuft(false) }
  }
  return (
    <div className="grid gap-4">
      <form onSubmit={hinzu} className="grid gap-2">
        <Textarea aria-label="Neuer Eintrag" placeholder="Was ist passiert? z. B. Call mit dem Vertriebsleiter, Angebot geht bis Freitag raus." value={text} onChange={(e) => setText(e.target.value)} className="min-h-16" />
        <Button type="submit" size="sm" className="justify-self-end" disabled={laeuft || !text.trim()}>{laeuft && <Loader2 className="animate-spin" />}Eintragen</Button>
      </form>
      {!ns.length && <p className="py-2 text-center text-sm text-muted-foreground">Noch keine Einträge.</p>}
      <ol className="grid gap-3 border-l pl-4">
        {ns.map((n: any) => (
          <li key={n.id} className="relative text-sm">
            <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
            <div className="text-xs text-muted-foreground">{M.dKurz(n.datum)}{n.datum.slice(0, 4)}{n.wer && M.person(n.wer) ? " · " + M.person(n.wer).name : ""}</div>
            {n.titel && <div className="font-medium">{n.titel}</div>}
            {n.text && <p className="whitespace-pre-line">{n.text}</p>}
          </li>
        ))}
      </ol>
    </div>
  )
}
