import { BrowserRouter } from 'react-router-dom'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { AppRoutes } from './AppRoutes'

export default function App() {
  useSmoothScroll()

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
