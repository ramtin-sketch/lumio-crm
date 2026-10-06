import * as React from "react"
import { toast } from "sonner"
import { useUI } from "@/store"
import * as M from "@/model/model.js"

/* Kurzer Hinweis, wenn jemand anders gerade genau das geändert hat, was man offen hat */
export function useLiveHinweis(art: string, id: string | null | undefined, text: string) {
  const ui = useUI()
  React.useEffect(() => {
    if (!id) return
    const f = (e: any) => {
      const d = e.detail || {}
      if (d.art === art && d.id === id && d.wer && d.wer !== "?" && d.wer !== ui.ich) toast(`${M.person(d.wer)?.name || "Jemand"} ${text}`, { id: "live-" + id })
    }
    window.addEventListener("lumio-live", f)
    return () => window.removeEventListener("lumio-live", f)
  }, [art, id, ui.ich, text])
}
