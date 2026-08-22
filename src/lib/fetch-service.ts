// Centralized fetch wrapper with timeout, retry, and offline support
const API_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

let isOfflineMode = false;

export const setOfflineMode = (offline: boolean) => {
  isOfflineMode = offline;
};

export const getOfflineMode = () => isOfflineMode;

export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeout = API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      // Check if response is actually ok
      if (response.ok || response.status < 500) {
        return response;
      }
      
      // Server error, retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // Check if it's a network error (retry) vs timeout (don't retry as aggressively)
        const isNetworkError = error.message.includes('Failed to fetch') || 
                               error.message.includes('Network request failed');
        const delay = isNetworkError ? RETRY_DELAY * (attempt + 1) : RETRY_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

export async function safeJsonResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Response is not JSON');
  }

  return response.json();
}

export function getApiUrl(endpoint: string): string {
  const originIsValid = typeof window.location.origin === "string" && window.location.origin !== "null";
  const isHttpOrigin = window.location.protocol === "http:" || window.location.protocol === "https:";

  if (originIsValid && isHttpOrigin) {
    return `${window.location.origin}${endpoint}`;
  }

  return `http://127.0.0.1:3000${endpoint}`;
}
