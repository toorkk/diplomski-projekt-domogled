import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from "@vercel/speed-insights/react"

// Komponenta za client-side
function ClientApp() {
  return (
    <StrictMode>
      <App />
      <Analytics />
      <SpeedInsights />
    </StrictMode>
  );
}

// Komponenta za server-side brez analytics in speedInsights ker to crasha server-side rendering
function ServerApp() {
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// Client-side rendering/hydration
if (typeof window !== 'undefined') {
  const target = document.getElementById('root');
  
  if (import.meta.env.DEV) {
    createRoot(target).render(<ClientApp />);
  } else {
    hydrateRoot(target, <ClientApp />);
  }
}

// Prerender funkcija
export async function prerender() {
  const { renderToString } = await import('react-dom/server');
  const html = renderToString(<ServerApp />);
  return { html };
}