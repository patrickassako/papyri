/**
 * Admin Invoice Token Service
 * Generates short-lived (60s), single-use tokens to serve PDF invoices
 * from admin panel without requiring Bearer auth in the browser.
 *
 * Flow:
 *  1. Admin clicks "Aperçu" or "Télécharger" in AdminJS
 *  2. Action handler generates the PDF buffer + stores it with a UUID token
 *  3. Handler returns redirectUrl = /admin/invoice-token/:token
 *  4. Browser navigates to that URL → PDF is served and token consumed
 */

const crypto = require('crypto');

// Map<token, { buffer: Buffer, filename: string, expiresAt: number }>
const _store = new Map();

// Cleanup interval — remove expired tokens every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of _store.entries()) {
    if (entry.expiresAt <= now) {
      _store.delete(token);
    }
  }
}, 120_000);

/**
 * Stores a PDF buffer and returns a one-time token.
 * @param {Buffer} buffer   - PDF content
 * @param {string} filename - Suggested download filename
 * @returns {string} token  - 32-char hex token
 */
function storeToken(buffer, filename) {
  const token = crypto.randomBytes(16).toString('hex');
  _store.set(token, {
    buffer,
    filename: filename || 'facture.pdf',
    expiresAt: Date.now() + 60_000, // 60 seconds
  });
  return token;
}

/**
 * Peeks at a token — validates it exists/hasn't expired without consuming it.
 * Use this for the HTML launcher page (first request).
 * @param {string} token
 * @returns {{ filename: string } | null}
 */
function peekToken(token) {
  const entry = _store.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    _store.delete(token);
    return null;
  }
  return { filename: entry.filename }; // metadata only, token remains valid
}

/**
 * Consumes a token and returns its entry (single-use).
 * Returns null if the token is expired or doesn't exist.
 * @param {string} token
 * @returns {{ buffer: Buffer, filename: string } | null}
 */
function consumeToken(token) {
  const entry = _store.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    _store.delete(token);
    return null;
  }
  _store.delete(token); // single-use
  return { buffer: entry.buffer, filename: entry.filename };
}

module.exports = { storeToken, peekToken, consumeToken };
