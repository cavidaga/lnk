// /lib/gated-fetch.js
// Edge-safe gated fetcher with policy checks, HEAD preflight, and streaming cap.

import {
  isBlockedHost,
  isBlockedPath,
  isAllowedMime,
  MAX_CONTENT_LENGTH_HEAD,
  MAX_GET_BYTES,
  CONNECT_TIMEOUT_MS,
  TOTAL_TIMEOUT_MS,
} from "./url-policy.js";

export class GatedFetchError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "GatedFetchError";
    this.code = code; // e.g., 'BLOCKED_HOST', 'DISALLOWED_MIME', 'TOO_LARGE', 'TIMEOUT'
    Object.assign(this, extra);
  }
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

/**
 * Resolve short links via HEAD (follows redirects). Returns {ok, url, headers}.
 * If HEAD fails, we just fall back to original URL.
 */
async function expandViaHead(url) {
  const t = withTimeout(Math.min(TOTAL_TIMEOUT_MS, 5000));
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: t.signal });
    t.cancel();
    if (res.ok) {
      return { ok: true, url: res.url, headers: res.headers };
    }
  } catch { t.cancel(); }
  return { ok: false, url, headers: new Headers() };
}

/**
 * Preflight: check content-type & length via HEAD.
 * Throws GatedFetchError when blocked.
 */
async function preflight(url) {
  const { ok, url: finalUrl, headers } = await expandViaHead(url);
  const target = ok ? finalUrl : url;

  // Host/path checks on the final URL
  const host = new URL(target).host;
  if (isBlockedHost(host)) {
    throw new GatedFetchError("BLOCKED_HOST", "Hosted/large document source blocked", { url: target });
  }
  if (isBlockedPath(target)) {
    throw new GatedFetchError("BLOCKED_PATH", "Document path indicates hosted/large file", { url: target });
  }

  // If we got headers from HEAD, use them
  if (ok) {
    const ct = headers.get("content-type") || "";
    const cl = Number(headers.get("content-length") || 0);
    const cd = (headers.get("content-disposition") || "").toLowerCase();

    if (cd.includes("attachment")) {
      throw new GatedFetchError("ATTACHMENT", "Attachment downloads are not analyzed", { url: target });
    }
    if (ct && !isAllowedMime(ct)) {
      throw new GatedFetchError("DISALLOWED_MIME", `Unsupported content-type: ${ct}`, { url: target, contentType: ct });
    }
    if (cl && cl > MAX_CONTENT_LENGTH_HEAD) {
      throw new GatedFetchError("TOO_LARGE", `Content-Length ${cl} exceeds limit`, {
        url: target,
        contentLength: cl,
        limit: MAX_CONTENT_LENGTH_HEAD,
      });
    }
  }

  return target; // proceed to GET with streaming cap
}

/**
 * GET with a hard byte cap and total timeout. Returns { url, status, contentType, text, bytes }.
 */
async function fetchWithCap(url) {
  const totalTimer = withTimeout(TOTAL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: totalTimer.signal,
      headers: { "Accept": "text/html, text/plain, application/xhtml+xml;q=0.9" },
    });

    const finalUrl = res.url;
    const contentType = res.headers.get("content-type") || "";
    const contentLength = Number(res.headers.get("content-length") || 0);
    const cd = (res.headers.get("content-disposition") || "").toLowerCase();

    if (cd.includes("attachment")) {
      throw new GatedFetchError("ATTACHMENT", "Attachment downloads are not analyzed", { url: finalUrl });
    }
    if (!isAllowedMime(contentType)) {
      throw new GatedFetchError("DISALLOWED_MIME", `Unsupported content-type: ${contentType}`, {
        url: finalUrl,
        contentType,
      });
    }
    if (contentLength && contentLength > MAX_CONTENT_LENGTH_HEAD) {
      throw new GatedFetchError("TOO_LARGE", `Content-Length ${contentLength} exceeds limit`, {
        url: finalUrl,
        contentLength,
        limit: MAX_CONTENT_LENGTH_HEAD,
      });
    }

    // Stream body with a hard cap
    const reader = res.body?.getReader?.();
    if (!reader) {
      // No readable stream? Try .text() but still enforce cap via Response clone
      const text = await res.text();
      const bytes = new TextEncoder().encode(text).byteLength;
      if (bytes > MAX_GET_BYTES) {
        throw new GatedFetchError("TOO_LARGE", `Body exceeded ${MAX_GET_BYTES} bytes`, {
          url: finalUrl,
          bytes,
          limit: MAX_GET_BYTES,
        });
      }
      totalTimer.cancel();
      return { url: finalUrl, status: res.status, contentType, text, bytes };
    }

    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        if (received > MAX_GET_BYTES) {
          throw new GatedFetchError("TOO_LARGE", `Body exceeded ${MAX_GET_BYTES} bytes`, {
            url: finalUrl,
            bytes: received,
            limit: MAX_GET_BYTES,
          });
        }
      }
    }

    // concat + decode
    const all = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) { all.set(c, offset); offset += c.byteLength; }
    const text = new TextDecoder("utf-8").decode(all);

    totalTimer.cancel();
    return { url: finalUrl, status: res.status, contentType, text, bytes: received };
  } catch (err) {
    totalTimer.cancel();
    if (err?.name === "AbortError") {
      throw new GatedFetchError("TIMEOUT", `Fetch exceeded ${TOTAL_TIMEOUT_MS}ms`, { url });
    }
    if (err instanceof GatedFetchError) throw err;
    throw new GatedFetchError("FETCH_ERROR", err?.message || "Fetch failed", { url });
  }
}

/**
 * Public API: gatedFetch(url[, opts])
 * - Runs host/path policy, HEAD preflight, then GET with streaming cap.
 * - Returns { url, status, contentType, text, bytes } on success.
 * - Throws GatedFetchError on block/timeout/too-large/etc.
 */
export async function gatedFetch(url /*, opts */) {
  // Quick client-side style checks (cheap)
  const host = new URL(url).host;
  if (isBlockedHost(host)) {
    throw new GatedFetchError("BLOCKED_HOST", "Hosted/large document source blocked", { url });
  }
  if (isBlockedPath(url)) {
    throw new GatedFetchError("BLOCKED_PATH", "Document path indicates hosted/large file", { url });
  }

  // Preflight + final URL (after short-link expansion)
  const target = await preflight(url);

  // GET with hard cap
  return await fetchWithCap(target);
}
