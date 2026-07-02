import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode: it double-invokes effects in dev, which duplicates
// GSAP ScrollTriggers / Lenis instances and fights the WebGL canvas.
createRoot(document.getElementById('root')!).render(<App />)
