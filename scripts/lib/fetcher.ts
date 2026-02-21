/**
 * HTTP client for bdlaws.minlaw.gov.bd with built-in request pacing.
 *
 * The Laws of Bangladesh portal serves HTML in UTF-16BE and can be queried
 * through stable act/section URLs. This client:
 * - identifies itself with a clear User-Agent
 * - enforces a minimum delay between requests (government-server friendly)
 * - retries transient failures (429/5xx)
 * - decodes UTF-16BE/UTF-16LE/UTF-8 responses safely
 */

const BASE_URL = 'http://bdlaws.minlaw.gov.bd';
const USER_AGENT = 'Ansvar-Law-MCP/1.0 (Bangladesh real-ingestion; https://github.com/Ansvar-Systems/Bangladeshi-law-mcp)';
const MIN_DELAY_MS = 1100;
const REQUEST_TIMEOUT_MS = 25000;

let lastRequestAt = 0;

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

function decodeBody(buffer: ArrayBuffer, contentType: string): string {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 2) {
    const b0 = bytes[0];
    const b1 = bytes[1];

    if (b0 === 0xfe && b1 === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
    }

    if (b0 === 0xff && b1 === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
    }

    // Heuristic: '<' as UTF-16BE/LE.
    if (b0 === 0x00 && b1 === 0x3c) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
    }

    if (b0 === 0x3c && b1 === 0x00) {
      return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
    }
  }

  const lowerType = contentType.toLowerCase();
  if (lowerType.includes('utf-16be')) {
    return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
  }
  if (lowerType.includes('utf-16le')) {
    return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
  }
  if (lowerType.includes('utf-16')) {
    // The portal predominantly serves UTF-16BE.
    return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
  }

  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return new URL(pathOrUrl, BASE_URL).toString();
}

export async function fetchHtml(url: string, maxRetries = 3): Promise<FetchResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await enforceRateLimit();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        const backoffMs = Math.min(4000, 1000 * Math.pow(2, attempt));
        await sleep(backoffMs);
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Network error while fetching ${url}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const body = decodeBody(await response.arrayBuffer(), contentType);

    if (response.ok) {
      return {
        status: response.status,
        body,
        contentType,
        url: response.url,
      };
    }

    if (attempt < maxRetries && isRetryable(response.status)) {
      const backoffMs = Math.min(4000, 1000 * Math.pow(2, attempt));
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`);
}
