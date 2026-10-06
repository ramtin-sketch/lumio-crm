import { PersonAvatar } from "@/bits"
import { useUI } from "@/store"
import { cn } from "@/lib/utils"
import * as M from "@/model/model.js"

/* Eine Zeile in Listen: Zeit links, Name und Kontext, Betreuer rechts */
export function LeadZeile({ l, wann, rot, unter }: { l: any; wann: string; rot?: boolean; unter: string }) {
  const ui = useUI()
  return (
    <button onClick={() => ui.oeffne(l.id)}
      className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
      <span className={cn("w-16 shrink-0 pt-px font-mono text-xs tabular text-muted-foreground", rot && "text-destructive")}>{wann}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{l.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{unter}</span>
      </span>
      <PersonAvatar id={l.betreuer} />
    </button>
  )
}
export const kontext = (l: any, text?: string) => M.mandat(l.mandat).name + (text ? " · " + text : "")
