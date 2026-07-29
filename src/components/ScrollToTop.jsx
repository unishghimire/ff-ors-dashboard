import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Resets scroll position to top on every route change
// Prevents the "page jumped to random position" lag on tab switch
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Find the main scroll container and reset it
    const main = document.querySelector('main')
    if (main) {
      main.scrollTop = 0
      main.scrollLeft = 0
    }
  }, [pathname])
  return null
}
