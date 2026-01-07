function parseUrlHost(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    // Fallback for non-standard baseURL strings
    return urlString;
  }
}

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^\d{1,3}(?:\.\d{1,3}){3}$/);
  if (!match) return false;

  const parts = hostname.split('.').map(n => Number(n));
  if (parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;

  const [a, b] = parts;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;

  return false;
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '::1' || host === '[::1]';
}

export function getOpenAIRequestTimeoutMs(baseURL: string | undefined): number {
  const defaultTimeoutMs = Number(process.env.MODEL_TIMEOUT_MS ?? 120000);
  const localTimeoutMs = Number(process.env.LOCAL_MODEL_TIMEOUT_MS ?? 1200000);

  if (!baseURL) return defaultTimeoutMs;

  const host = parseUrlHost(baseURL);
  if (isLocalHost(host) || isPrivateIPv4(host)) return localTimeoutMs;

  return defaultTimeoutMs;
}
