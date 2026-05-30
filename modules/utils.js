'use strict';
// ── Shared utilities untuk semua modul ──────────────────────────────────────

/**
 * Normalisasi base URL domain server.
 * Jika tidak ada scheme, tambahkan http://
 */
function normalizeApiBase(rawDomain) {
  const value = String(rawDomain || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '');
  return `http://${value}`.replace(/\/+$/, '');
}

/**
 * Normalisasi auth token — hapus prefix "Bearer " jika ada.
 */
function normalizeAuthToken(rawAuth) {
  const value = String(rawAuth || '').trim();
  if (!value) return '';
  return value.replace(/^Bearer\s+/i, '').trim();
}

/**
 * Parse JSON dari output curl yang mungkin mengandung teks lain.
 */
function parseJsonFromCurlOutput(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
    }
    return null;
  }
}

/**
 * Split output curl yang mengandung marker __HTTP_STATUS__:NNN
 */
function splitCurlOutput(rawOut) {
  const raw = String(rawOut || '');
  const marker = '__HTTP_STATUS__:';
  const idx = raw.lastIndexOf(marker);
  if (idx < 0) return { body: raw.trim(), statusCode: 0 };
  const body = raw.slice(0, idx).trim();
  const codeRaw = raw.slice(idx + marker.length).trim();
  const statusCode = Number.parseInt(codeRaw, 10);
  return { body, statusCode: Number.isFinite(statusCode) ? statusCode : 0 };
}

/**
 * Escape single quote untuk shell command
 */
function shellSingleQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

/**
 * Cek apakah status code HTTP 2xx
 */
function isHttp2xx(statusCode) {
  return Number(statusCode) >= 200 && Number(statusCode) < 300;
}

module.exports = {
  normalizeApiBase,
  normalizeAuthToken,
  parseJsonFromCurlOutput,
  splitCurlOutput,
  shellSingleQuote,
  isHttp2xx,
};
