import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Globals Fetch Interceptor for seamless Electron/PC app <-> Web server sync
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = typeof input === "string" 
      ? input 
      : (input instanceof URL ? input.toString() : (input as any).url || "");
      
    if (url.startsWith("/api/")) {
      const isElectron = window.location.protocol === "file:" || 
                         navigator.userAgent.toLowerCase().includes("electron") ||
                         window.location.hostname === "";
      const isDev = (import.meta as any)?.env?.DEV === true;
      const savedServerUrl = localStorage.getItem("suitpro_server_url");

      if (isDev) {
        // In local development mode, always route to local backend server
        url = "http://localhost:3000" + url;
      } else if (savedServerUrl) {
        // If a custom server URL is explicitly configured, use it
        url = savedServerUrl + url;
      } else if (isElectron) {
        // If packaged Electron app with no custom configuration, default to cloud database
        url = "https://epos.suitprolondon.com" + url;
      }
      // In production browser, if no custom server URL is set, we keep it relative so it works natively.
    }
    
    // Normalize request input
    if (typeof input === "object" && !(input instanceof URL)) {
      const clonedInit = { ...init };
      return originalFetch(url, clonedInit);
    }
    return originalFetch(url, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
