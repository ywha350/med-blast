import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Prevent pinch-zoom on Safari/iOS (viewport meta alone is not enough)
const noop = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', noop)
document.addEventListener('gesturechange', noop)
document.addEventListener('gestureend', noop)
document.addEventListener('touchmove', (e: TouchEvent) => {
  if (e.touches.length >= 2) e.preventDefault()
}, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
