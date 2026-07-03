// ============================================================
// modules/ppob.js — Integrasi HidePulsa PPOB (FIXED)
// ============================================================
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');

const HIDEPULSA_BASE = 'https://app.hidepulsa.com';

// ── Token store (in-memory, persisted ke DB) ─────────────────
let _accessToken = null;
let _refreshToken = null;
let _accessTokenExpiresAt = 0;
let _refreshTokenExpiresAt = 0;
let _botTelegramUserId = null;
let _refreshRetries = 0;
const MAX_REFRESH_RETRIES = 3;

// ── DB Migration ─────────────────────────────────────────────
db.run(`CREATE TABLE IF NOT EXISTS ppob_tokens (
  id INTEGER PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  access_expires_at INTEGER,
  refresh_expires_at INTEGER,
  updated_at INTEGER
)`, () => {
  db.get('SELECT * FROM ppob_tokens WHERE id = 1', [], (err, row) => {
    if (row) {
      _accessToken = row.access_token;
      _refreshToken = row.refresh_token;
      _accessTokenExpiresAt = row.access_expires_at || 0;
      _refreshTokenExpiresAt = row.refresh_expires_at || 0;
      console.log("[HidePulsa] 📂 Token dimuat dari DB");
      console.log("[HidePulsa]    Access expired:", new Date(_accessTokenExpiresAt).toLocaleString("id-ID"));
      console.log("[HidePulsa]    Refresh expired:", new Date(_refreshTokenExpiresAt).toLocaleString("id-ID"));
    }
  });
});

db.run(`CREATE TABLE IF NOT EXISTS ppob_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  ref_id TEXT UNIQUE,
  buyer_sku_code TEXT,
  customer_no TEXT,
  product_name TEXT,
  selling_price INTEGER,
  status TEXT DEFAULT 'pending',
  sn TEXT,
  message TEXT,
  type TEXT DEFAULT 'prabayar',
  created_at INTEGER
)`, () => {});

function saveTokens({ accessToken, refreshToken, accessExpiresIn, refreshExpiresIn }) {
  _accessToken = accessToken;
  _refreshToken = refreshToken;
  _accessTokenExpiresAt = Date.now() + (accessExpiresIn - 30) * 1000;
  _refreshTokenExpiresAt = Date.now() + (refreshExpiresIn - 60) * 1000;
  _refreshRetries = 0; // reset retries on success
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO ppob_tokens (id, access_token, refresh_token, access_expires_at, refresh_expires_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [_accessToken, _refreshToken, _accessTokenExpiresAt, _refreshTokenExpiresAt, Date.now()],
      function(err) {
        if (err) { console.error("[HidePulsa] ❌ Gagal simpan token ke DB:", err.message); reject(err); }
        else {
          console.log("[HidePulsa] 💾 Token tersimpan ke DB");
          console.log("[HidePulsa]    Access expired:", new Date(_accessTokenExpiresAt).toLocaleString("id-ID"));
          console.log("[HidePulsa]    Refresh expired:", new Date(_refreshTokenExpiresAt).toLocaleString("id-ID"));
          resolve();
        }
      }
    );
  });
}

function isAccessTokenValid() {
  return _accessToken && Date.now() < _accessTokenExpiresAt;
}

function isRefreshTokenValid() {
  return _refreshToken && Date.now() < _refreshTokenExpiresAt;
}

async function hidepulsaPost(path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Bearer ${_accessToken}`;
  const res = await axios.post(`${HIDEPULSA_BASE}${path}`, body, {
    headers,
    timeout: 20000,
    validateStatus: () => true
  });
  return res.data;
}

async function hidepulsaGet(path, params = {}, auth = true) {
  const headers = {};
  if (auth) headers['Authorization'] = `Bearer ${_accessToken}`;
  const res = await axios.get(`${HIDEPULSA_BASE}${path}`, {
    headers,
    params,
    timeout: 20000,
    validateStatus: () => true
  });
  return res.data;
}

// ── Auth Flow ─────────────────────────────────────────────────
async function refreshAccessToken() {
  if (!isRefreshTokenValid()) throw new Error('Refresh token expired, perlu login ulang.');
  
  console.log("[HidePulsa] 🔄 Memanggil API /auth/refresh...");
  
  try {
    const res = await hidepulsaPost('/auth/refresh', { refresh_token: _refreshToken }, false);
    
    if (!res.ok) {
      const errMsg = res.message || 'Gagal refresh token HidePulsa';
      console.error("[HidePulsa] ❌ API response:", JSON.stringify(res).substring(0, 200));
      throw new Error(errMsg);
    }
    
    await saveTokens({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      accessExpiresIn: res.expires_in,
      refreshExpiresIn: res.refresh_expires_in
    });
    return res.access_token;
    
  } catch (e) {
    _refreshRetries++;
    console.error(`[HidePulsa] ❌ Gagal refresh (attempt ${_refreshRetries}/${MAX_REFRESH_RETRIES}):`, e.message);
    
    if (e.response) {
      console.error("[HidePulsa]    HTTP Status:", e.response.status);
      console.error("[HidePulsa]    Response:", JSON.stringify(e.response.data).substring(0, 200));
    }
    
    throw e;
  }
}

async function ensureToken() {
  if (isAccessTokenValid()) return _accessToken;
  if (isRefreshTokenValid()) return await refreshAccessToken();
  throw new Error('SESSION_EXPIRED');
}

async function registerAndRequestOtp(telegramUserId) {
  await hidepulsaPost('/auth/register', { telegram_user_id: telegramUserId });
  const res = await hidepulsaPost('/auth/telegram/request-otp', { telegram_user_id: telegramUserId });
  if (!res.ok) throw new Error(res.message || 'Gagal request OTP.');
  return res.challenge_token;
}

async function verifyOtp(challengeToken, otp) {
  const res = await hidepulsaPost('/auth/otp/verify', { challenge_token: challengeToken, otp });
  if (!res.ok) throw new Error(res.message || 'OTP salah atau expired.');
  await saveTokens({
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    accessExpiresIn: res.expires_in,
    refreshExpiresIn: res.refresh_expires_in
  });
  return true;
}

// ── Produk ────────────────────────────────────────────────────
async function getProdukList(category = null, brand = null) {
  await ensureToken();
  const params = {};
  if (category) params.category = category;
  if (brand) params.brand = brand;
  const res = await hidepulsaGet('/produk-list', params);
  if (!res.ok && res.status !== 'success') throw new Error(res.message || 'Gagal ambil produk.');
  return res.data || [];
}

// ── Transaksi Prabayar ────────────────────────────────────────
async function beliProduk({ buyerSkuCode, customerNo, refId, sellingPrice }) {
  await ensureToken();
  console.log(`[HidePulsa] 🛒 beliProduk: sku=${buyerSkuCode}, no=${customerNo}, price=${sellingPrice}`);
  const res = await hidepulsaPost('/topup_digi', {
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
    selling_price: sellingPrice,
    payment_method: 'saldo'
  }, true);
  console.log(`[HidePulsa] 📦 Response beliProduk: ok=${res.ok}, msg=${res.message}`);
  if (!res.ok) {
    console.error(`[HidePulsa] ❌ Transaksi gagal: ${JSON.stringify(res).substring(0, 500)}`);
    throw new Error(res.message || 'Transaksi gagal.');
  }
  return res.data;
}

// ── Tagihan Pascabayar ────────────────────────────────────────
async function cekTagihan({ buyerSkuCode, customerNo, refId }) {
  await ensureToken();
  const res = await hidepulsaPost('/cek-tagihan', {
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId
  }, true);
  if (!res.ok) throw new Error(res.message || 'Gagal cek tagihan.');
  return res.data;
}

async function bayarTagihan({ buyerSkuCode, customerNo, refId, sellingPrice }) {
  await ensureToken();
  const res = await hidepulsaPost('/bayar-tagihan', {
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
    selling_price: sellingPrice,
    payment_method: 'saldo'
  }, true);
  if (!res.ok) throw new Error(res.message || 'Gagal bayar tagihan.');
  return res.data;
}

// ── Cek Status ────────────────────────────────────────────────
async function cekStatus(refId) {
  await ensureToken();
  const res = await hidepulsaGet(`/check-status/${refId}`, {});
  if (!res.ok) throw new Error(res.message || 'Gagal cek status.');
  return res.data;
}

// ── Simpan Transaksi ke DB ────────────────────────────────────
function saveTrxDB({ userId, refId, buyerSkuCode, customerNo, productName, sellingPrice, status, sn, message, type }) {
  db.run(
    `INSERT OR REPLACE INTO ppob_transactions
     (user_id, ref_id, buyer_sku_code, customer_no, product_name, selling_price, status, sn, message, type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, refId, buyerSkuCode, customerNo, productName || '', sellingPrice, status, sn || '', message || '', type || 'prabayar', Date.now()]
  );
}

function updateTrxDB(refId, { status, sn, message }) {
  db.run(
    `UPDATE ppob_transactions SET status = ?, sn = ?, message = ? WHERE ref_id = ?`,
    [status, sn || '', message || '', refId]
  );
}

// ── Generate ref_id unik ──────────────────────────────────────
function generateRefId(prefix = 'TRX') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// ── Set bot telegram user id ──────────────────────────────────
function setBotTelegramUserId(id) {
  _botTelegramUserId = id;
}

function getBotTelegramUserId() {
  return _botTelegramUserId;
}

function isSessionActive() {
  return isAccessTokenValid() || isRefreshTokenValid();
}

// ── Format harga ──────────────────────────────────────────────
function formatRupiah(n) {
  return `Rp ${Number(n).toLocaleString('id-ID')}`;
}

function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  _accessTokenExpiresAt = 0;
  _refreshTokenExpiresAt = 0;
  db.run('DELETE FROM ppob_tokens WHERE id = 1');
}

// ── Auto-Refresh Token (FIXED: 5 menit interval, 8 menit buffer, retry) ──
let _autoRefreshInterval = null;

async function doAutoRefresh() {
  try {
    if (!isRefreshTokenValid()) {
      console.warn("[HidePulsa] ⚠️ Refresh token expired! Perlu login ulang via OTP.");
      stopAutoRefresh();
      return;
    }

    const now = Date.now();
    const eightMinMs = 8 * 60 * 1000; // buffer 8 menit (access token ~15 menit)
    
    if (_accessTokenExpiresAt - now < eightMinMs || !isAccessTokenValid()) {
      console.log("[HidePulsa] 🔄 Auto-refresh access token...");
      console.log("[HidePulsa]    Access valid sampai:", new Date(_accessTokenExpiresAt).toLocaleString("id-ID"));
      console.log("[HidePulsa]    Sisa waktu:", Math.round((_accessTokenExpiresAt - now) / 1000), "detik");
      
      try {
        await refreshAccessToken();
        console.log("[HidePulsa] ✅ Token berhasil di-refresh!");
        console.log("[HidePulsa]    Valid sampai:", new Date(_accessTokenExpiresAt).toLocaleString("id-ID"));
      } catch (refreshErr) {
        if (_refreshRetries >= MAX_REFRESH_RETRIES) {
          console.error("[HidePulsa] 🚨 Gagal refresh", MAX_REFRESH_RETRIES, "x berturut-turut!");
          console.error("[HidePulsa] 🚨 Refresh token mungkin invalid. Perlu login ulang via OTP.");
          _refreshRetries = 0; // reset supaya bisa retry lagi nanti
        }
        // Jangan stop scheduler, tetap retry di interval berikutnya
      }
    } else {
      const sisaMin = Math.round((_accessTokenExpiresAt - now) / 60000);
      console.log(`[HidePulsa] ✅ Token masih valid (${sisaMin} menit lagi), skip refresh`);
    }
  } catch (e) {
    console.error("[HidePulsa] ❌ Error di auto-refresh:", e.message);
  }
}

function startAutoRefresh() {
  if (_autoRefreshInterval) {
    console.log("[HidePulsa] 🕐 Auto-refresh sudah berjalan, skip start");
    return;
  }
  
  console.log("[HidePulsa] 🕐 Auto-refresh scheduler dimulai (setiap 5 menit)");
  
  // IMMEDIATE refresh saat start (tunggu 3 detik untuk DB load)
  setTimeout(() => {
    console.log("[HidePulsa] 🚀 Initial refresh saat startup...");
    doAutoRefresh();
  }, 3000);
  
  // Periodic refresh setiap 5 menit
  _autoRefreshInterval = setInterval(doAutoRefresh, 5 * 60 * 1000);
}

function stopAutoRefresh() {
  if (_autoRefreshInterval) {
    clearInterval(_autoRefreshInterval);
    _autoRefreshInterval = null;
    console.log("[HidePulsa] ⏹ Auto-refresh scheduler dihentikan");
  }
}

module.exports = {
  registerAndRequestOtp,
  verifyOtp,
  ensureToken,
  isSessionActive,
  getProdukList,
  beliProduk,
  cekTagihan,
  bayarTagihan,
  cekStatus,
  saveTrxDB,
  updateTrxDB,
  generateRefId,
  setBotTelegramUserId,
  getBotTelegramUserId,
  formatRupiah,
  clearTokens,
  startAutoRefresh,
  stopAutoRefresh,
  db
};
