import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { Home } from './pages/Home'
import { Privacy } from './pages/Privacy'
import { DeleteAccount } from './pages/DeleteAccount'
import { Terms } from './pages/Terms'

/** Scroll to top on route change (and honor #hash anchors on home). */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  useSmoothScroll()

  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/delete" element={<DeleteAccount />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </BrowserRouter>
  )
}
