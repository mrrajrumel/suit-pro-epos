import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root container not found');
}

const root = createRoot(rootElement);

// Globals Fetch Interceptor for local Electron/PC API routing and timeout handling
if (typeof window !== "undefined") {
  try {
    const originalFetch = window.fetch.bind(window);
    const API_TIMEOUT = 15000;

    const customFetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const requestInput = input instanceof Request ? input : null;
      let url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : requestInput?.url || "";

      const isApiEndpoint = url.startsWith("/api/") || new URL(url, window.location.origin).pathname.startsWith("/api/");
      const originIsValid = typeof window.location.origin === "string" && window.location.origin !== "null";
      const isHttpOrigin = window.location.protocol === "http:" || window.location.protocol === "https:";

      if (isApiEndpoint) {
        const endpoint = url.startsWith("/api/") ? url : new URL(url).pathname + new URL(url).search;
        const baseUrl = originIsValid && isHttpOrigin ? window.location.origin : "http://127.0.0.1:3000";
        url = new URL(endpoint, baseUrl).toString();
      }

      const controller = isApiEndpoint ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), API_TIMEOUT) : null;

      try {
        const finalInit: RequestInit = {
          ...(requestInput ? {
            method: requestInput.method,
            headers: requestInput.headers,
            body: requestInput.method === "GET" || requestInput.method === "HEAD" ? undefined : requestInput.body
          } : {}),
          ...(init || {}),
          ...(controller ? { signal: init?.signal || requestInput?.signal || controller.signal } : requestInput?.signal ? { signal: requestInput.signal } : {})
        };
        return await originalFetch(url, finalInit);
      } catch (err: any) {
        if (controller && err?.name === "AbortError") {
          throw new Error(`Request timeout after ${API_TIMEOUT}ms: ${url}`);
        }
        throw err;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn("Could not patch window.fetch directly due to environment restrictions:", err);
  }
}

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
