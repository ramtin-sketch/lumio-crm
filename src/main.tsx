import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import Wurzel from "./wurzel"

createRoot(document.getElementById("root")!).render(<StrictMode><Wurzel /></StrictMode>)

/* Offline-Zwischenspeicher nur auf der eigenen Adresse (GitHub Pages), nicht in der Vorschau */
if ("serviceWorker" in navigator && location.protocol === "https:" && location.hostname.endsWith("github.io")) {
  navigator.serviceWorker.register("sw.js").catch(() => {})
}
