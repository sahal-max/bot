'use strict';
const axios = require('axios');

const BASE_URL = 'https://www.nadiavpn.web.id/api/v1';

function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

// Endpoint listing server sudah dikonfirmasi lewat diagnosa langsung ke API:
// GET /servers (bukan /vpn/servers atau /vpn/server — keduanya 404). Bug lama
// bukan salah endpoint, tapi salah baca bentuk respons: array server-nya ada
// di payload.data.servers (bukan langsung di payload.data), sehingga
// Array.isArray() versi lama selalu false dan balikin [].
const SERVER_LIST_ENDPOINTS = ['/servers'];

function extractServerArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.data,
    payload.servers,
    payload.result,
    payload.data?.servers,
    payload.data?.data,
    payload.result?.servers,
    payload.result?.data
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return null;
}

// GET /vpn/servers (fallback /servers) — ambil semua server apa adanya dari API,
// tanpa filter. Dipakai untuk diagnosa: kalau getServers() balikin array kosong,
// admin bisa cek getServersRaw() dulu untuk lihat apakah API-nya sendiri yang
// kosong, endpoint-nya salah, atau API-nya ada isi tapi filter cloudfront tidak match.
async function getServersRaw(apiKey) {
  let lastErr = null;
  for (const path of SERVER_LIST_ENDPOINTS) {
    try {
      const res = await axios.get(`${BASE_URL}${path}`, {
        headers: headers(apiKey),
        timeout: 15000,
        validateStatus: () => true
      });

      if (res.status < 200 || res.status >= 300) {
        console.error(`[NadiaVPN] GET ${path} -> HTTP ${res.status}:`, JSON.stringify(res.data)?.slice(0, 500));
        lastErr = new Error(`HTTP ${res.status} dari ${path}`);
        continue;
      }

      const list = extractServerArray(res.data);
      if (list === null) {
        console.error(`[NadiaVPN] GET ${path} -> 200 tapi bentuk respons tidak dikenali:`, JSON.stringify(res.data)?.slice(0, 500));
        lastErr = new Error(`Bentuk respons tidak dikenali dari ${path}`);
        continue;
      }

      if (list.length === 0) {
        console.warn(`[NadiaVPN] GET ${path} -> 200, array server kosong (raw: ${JSON.stringify(res.data)?.slice(0, 300)})`);
      }
      return list;
    } catch (err) {
      console.error(`[NadiaVPN] GET ${path} gagal:`, err.response?.status, err.response?.data || err.message);
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

// Cek apakah satu object server termasuk kategori "cloudfront".
// PERBAIKAN BUG: API NadiaVPN tidak selalu mengirim field `type` / `server_type`
// yang berisi kata "cloudfront" — label "Cloudfront" pada server NadiaVPN pada
// kenyataannya berada di dalam NAMA server itu sendiri, contoh: "CLOUDFRONT REGULER",
// "VIP CLOUDFRONT PREMIUM", "X-RAY CLOUDFRONT VIP". Filter lama yang hanya mengecek
// s.type/s.server_type karena itu selalu menghasilkan array kosong walau data server
// Cloudfront sebenarnya ada di response API (menyebabkan pesan error "Tidak ada
// server Cloudfront ditemukan dari API"). Perbaikan ini mengecek gabungan beberapa
// field sekaligus (name/server_name/label/category/tag selain type/server_type)
// supaya tetap cocok apapun bentuk skema field yang dikembalikan API.
function isCloudfrontServer(s) {
  const haystack = [
    s.name, s.server_name, s.label, s.title,
    s.category, s.type, s.server_type, s.tag
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('cloudfront');
}

// GET /servers — ambil semua server, filter CLOUDFRONT
async function getServers(apiKey) {
  const servers = await getServersRaw(apiKey);
  return servers.filter(isCloudfrontServer);
}

// POST /vpn/trial
async function trialVPN(apiKey, server_id) {
  const res = await axios.post(`${BASE_URL}/vpn/trial`, {
    server_id,
    protocol: 'ssh'
  }, { headers: headers(apiKey), timeout: 30000 });
  if (!res.data?.success && res.data?.status !== 'success' && !res.data?.data) {
    throw new Error(res.data?.message || 'Trial gagal');
  }
  return res.data?.data || res.data;
}

// POST /vpn/order
async function orderVPN(apiKey, { server_id, username, duration }) {
  const res = await axios.post(`${BASE_URL}/vpn/order`, {
    server_id,
    protocol: 'ssh',
    type: 'day',
    duration: Number(duration) || 1,
    username
  }, { headers: headers(apiKey), timeout: 30000 });
  if (!res.data?.success && res.data?.status !== 'success' && !res.data?.data) {
    throw new Error(res.data?.message || 'Order gagal');
  }
  return res.data?.data || res.data;
}

// POST /vpn/renew
async function renewVPN(apiKey, { account_id, duration }) {
  const res = await axios.post(`${BASE_URL}/vpn/renew`, {
    account_id,
    type: 'day',
    duration: Number(duration) || 1
  }, { headers: headers(apiKey), timeout: 30000 });
  if (!res.data?.success && res.data?.status !== 'success' && !res.data?.data) {
    throw new Error(res.data?.message || 'Renew gagal');
  }
  return res.data?.data || res.data;
}

// POST /vpn/account/details
async function getAccountDetails(apiKey, account_id) {
  const res = await axios.post(`${BASE_URL}/vpn/account/details`, {
    account_id
  }, { headers: headers(apiKey), timeout: 15000 });
  return res.data?.data || res.data;
}

module.exports = { getServers, getServersRaw, isCloudfrontServer, trialVPN, orderVPN, renewVPN, getAccountDetails };
