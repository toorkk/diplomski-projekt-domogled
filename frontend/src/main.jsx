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
// main.jsx
export async function prerender(data) {
  const { renderToString } = await import('react-dom/server');
  
  const renderPromise = new Promise((resolve) => {
    try {
      const html = renderToString(<ServerApp url={data?.url} />);
      resolve({ html });
    } catch (error) {
      console.error('Prerender error:', error);
      resolve({ html: '<div>Loading...</div>' });
    }
  });

  // Timeout po 10 sekundah
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.warn('Prerender timeout - using fallback');
      resolve({ html: '<div>Loading...</div>' });
    }, 10000);
  });

  return Promise.race([renderPromise, timeoutPromise]);
}