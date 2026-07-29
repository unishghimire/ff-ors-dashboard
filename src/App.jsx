import { Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'

// Lazy load all pages — only the active page's code downloads
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Capture = lazy(() => import('./pages/Capture'))
const Tournaments = lazy(() => import('./pages/Tournaments'))
const Matches = lazy(() => import('./pages/Matches'))
const ApiDestinations = lazy(() => import('./pages/ApiDestinations'))
const Violations = lazy(() => import('./pages/Violations'))
const Settings = lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin mb-3" style={{ borderColor: 'var(--ors-accent)', borderTopColor: 'transparent' }}></div>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <>
      <ScrollToTop />
      <Routes location={location}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="capture" element={<Suspense fallback={<PageLoader />}><Capture /></Suspense>} />
          <Route path="tournaments" element={<Suspense fallback={<PageLoader />}><Tournaments /></Suspense>} />
          <Route path="matches" element={<Suspense fallback={<PageLoader />}><Matches /></Suspense>} />
          <Route path="api-destinations" element={<Suspense fallback={<PageLoader />}><ApiDestinations /></Suspense>} />
          <Route path="violations" element={<Suspense fallback={<PageLoader />}><Violations /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        </Route>
      </Routes>
    </>
  )
}
