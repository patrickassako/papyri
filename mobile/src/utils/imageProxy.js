/**
 * Image Proxy Utility
 *
 * R2 public bucket URLs (pub-xxx.r2.dev) may return 401 if Cloudflare public
 * access is not enabled on the bucket. This utility rewrites those URLs to go
 * through the backend media proxy (/api/media/image?key=...) which generates
 * a presigned URL and redirects.
 */

import API_BASE_URL from '../config/api';

// R2 public URL format: https://pub-<token>.r2.dev/<key>
// The key is the FULL path after the domain (no bucket segment in the URL).
// e.g. https://pub-xxx.r2.dev/avatars/user-id/file.jpg → key = "avatars/user-id/file.jpg"
const R2_DEV_PATTERN = /^https?:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/i;

/**
 * Convert a raw R2 URL to a backend-proxied URL.
 * If the URL is not an R2 URL, returns it unchanged.
 *
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function getProxiedImageUrl(url) {
  if (!url) return null;

  const match = url.match(R2_DEV_PATTERN);
  if (match) {
    // match[1] = full key, e.g. "avatars/user-id/file.jpg"
    const key = match[1];
    return `${API_BASE_URL}/api/media/image?key=${encodeURIComponent(key)}`;
  }

  return url;
}
