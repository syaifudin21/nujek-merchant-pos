// Klien Open API v1 Nujek Merchant — HMAC-SHA256 (Web Crypto).
//
// Aturan signing (sama dengan API_CONTRACT §23.1):
//   header: X-API-Key, X-Timestamp (Unix detik), X-Signature
//   kunci HMAC = 32 byte mentah secret (base64url-decode), BUKAN hash-nya
//   string kanonik: METHOD\nURL\nTIMESTAMP\nHEX(SHA-256(body))
//   signature = hex HMAC-SHA256 atas string kanonik
//   URL = path + query persis seperti yang diterima server
//   (mis. /open/v1/stores/<id>/orders?status=complete)
//   body GET kosong -> SHA-256("") = e3b0c44298fc1c149afbf4c8996fb924...
//
// Catatan: secret HANYA dipakai untuk menghitung signature di browser
// dan tidak pernah dikirim. Untuk integrasi produksi, signing sebaiknya
// dilakukan di server sendiri (secret jangan sampai ke browser publik).

const EMPTY_BODY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** Decode secret base64url (43 karakter) -> 32 byte mentah. */
export function decodeSecret(secret) {
  const clean = secret.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** SHA-256 (hex) dari string UTF-8. */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** HMAC-SHA256 (hex) dengan kunci mentah. */
export async function hmacSha256Hex(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hitung header auth untuk satu request.
 * @returns {{ timestamp, signature, canonical, bodyHash }}
 */
export async function signRequest({ method, url, body = '', secret }) {
  const keyBytes = decodeSecret(secret);
  const bodyHash = body === '' ? EMPTY_BODY_HASH : await sha256Hex(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const canonical = `${method}\n${url}\n${timestamp}\n${bodyHash}`;
  const signature = await hmacSha256Hex(keyBytes, canonical);
  return { timestamp, signature, canonical, bodyHash };
}

/**
 * Panggil Open API.
 *
 * @param {object} opts
 * @param {string} opts.apiKey   - X-API-Key (nk_live_...)
 * @param {string} opts.secret   - secret 43 karakter (tidak dikirim)
 * @param {string} opts.path     - path+query yang diterima server,
 *                                 dipakai untuk signing
 *                                 (mis. /open/v1/stores/<id>/menu)
 * @param {string} opts.fetchUrl - URL yang benar-benar di-fetch browser.
 *                                 Bila pakai proxy dev, ini '/api' + path;
 *                                 bila langsung, ini baseUrl + path.
 * @param {string} [opts.method='GET']
 * @returns {Promise<{status, statusText, ms, headers, text, data, sign}>}
 */
export async function callOpenApi({
  apiKey,
  secret,
  path,
  fetchUrl,
  method = 'GET',
}) {
  const sign = await signRequest({ method, url: path, secret });
  const started = performance.now();
  let res;
  try {
    res = await fetch(fetchUrl, {
      method,
      headers: {
        'X-API-Key': apiKey,
        'X-Timestamp': sign.timestamp,
        'X-Signature': sign.signature,
      },
    });
  } catch (err) {
    // Gagal jaringan / CORS diblokir browser.
    throw new Error(
      'Request gagal dikirim: ' +
        err.message +
        ' — bila memakai mode langsung, kemungkinan CORS (lihat README).',
    );
  }
  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* bukan JSON */
  }
  const headers = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return { status: res.status, statusText: res.statusText, ms, headers, text, data, sign };
}

export const ENDPOINTS = [
  {
    id: 'store',
    label: 'Info Toko',
    scope: 'read:store',
    path: (id) => `/open/v1/stores/${id}`,
  },
  {
    id: 'menu',
    label: 'Menu',
    scope: 'read:menu',
    path: (id) => `/open/v1/stores/${id}/menu`,
  },
  {
    id: 'orders',
    label: 'Pesanan',
    scope: 'read:orders',
    path: (id, q) =>
      `/open/v1/stores/${id}/orders${q.status ? `?status=${encodeURIComponent(q.status)}` : ''}`,
  },
  {
    id: 'order-detail',
    label: 'Detail Pesanan',
    scope: 'read:orders',
    needsTid: true,
    path: (id, q) => `/open/v1/stores/${id}/orders/${q.tid}`,
  },
  {
    id: 'tables',
    label: 'Meja',
    scope: 'read:tables',
    path: (id) => `/open/v1/stores/${id}/tables`,
  },
  {
    id: 'reports',
    label: 'Laporan Ringkas',
    scope: 'read:reports',
    path: (id) => `/open/v1/stores/${id}/reports/summary`,
  },
];
