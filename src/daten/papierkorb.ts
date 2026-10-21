/* Papierkorb für Leads – gleiche Bedienung im echten Betrieb und in der Demo.
   Echt: alles über die Datenbank (siehe echt.ts). Demo: die Leads werden nur im Speicher beiseitegelegt. */
import * as M from "@/model/model.js"
import { ECHT, leadsInPapierkorb, leadsWiederherstellen, papierkorbEndgueltig, papierkorbLaden, type PapierkorbEintrag } from "@/daten/echt"

export const PAPIERKORB_TAGE = 30
export type { PapierkorbEintrag }

const demo: { l: any; termine: any[]; zeit: string; wer: string }[] = []

export async function inPapierkorb(ids: string[], ich: string) {
  if (ECHT) return leadsInPapierkorb(ids)
  const weg = new Set(ids)
  let n = 0
  for (let i = M.LEADS.length - 1; i >= 0; i--) {
    const l: any = M.LEADS[i]
    if (!weg.has(l.id)) continue
    const termine = (M.TERMINE as any[]).filter((t) => t.lead === l.id)
    for (let j = M.TERMINE.length - 1; j >= 0; j--) if ((M.TERMINE[j] as any).lead === l.id) M.TERMINE.splice(j, 1)
    M.LEADS.splice(i, 1)
    demo.unshift({ l, termine, zeit: new Date().toISOString(), wer: ich })
    n++
  }
  return n
}

export async function papierkorb(): Promise<PapierkorbEintrag[]> {
  if (ECHT) return papierkorbLaden()
  return demo.map(({ l, zeit, wer }) => ({
    id: l.id, name: l.name, ort: l.ort || null, bereich: l.bereich, mandat: M.mandat(l.mandat)?.name || null, stufe: l.stufe,
    kontakte: l.kontakte.length, geloescht_am: zeit, geloescht_von: M.person(wer)?.voll || null,
    endgueltig_am: new Date(new Date(zeit).getTime() + PAPIERKORB_TAGE * 86400000).toISOString(),
  }))
}

export async function wiederherstellen(ids: string[]) {
  if (ECHT) return leadsWiederherstellen(ids)
  let n = 0
  for (let i = demo.length - 1; i >= 0; i--) {
    if (!ids.includes(demo[i].l.id)) continue
    const [e] = demo.splice(i, 1)
    ;(M.LEADS as any[]).push(e.l); (M.TERMINE as any[]).push(...e.termine); n++
  }
  return n
}

export async function endgueltigLoeschen(ids: string[]) {
  if (ECHT) return papierkorbEndgueltig(ids)
  const vorher = demo.length
  for (let i = demo.length - 1; i >= 0; i--) if (ids.includes(demo[i].l.id)) demo.splice(i, 1)
  return vorher - demo.length
}
