import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode: it double-invokes effects in dev, which duplicates
// GSAP ScrollTriggers / Lenis instances and fights the WebGL canvas.
const root = document.getElementById('root')!

// Prod'da dist/<rota>/index.html prerender edilmiş gövde içerir → hydrate et
// (statik HTML ekranda kalır, boş bir kare görünmez). Dev'de kök boştur → render.
if (root.firstChild) {
  hydrateRoot(root, <App />)
} else {
  createRoot(root).render(<App />)
}
