const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const { Telegraf } = require('telegraf');
const app = express();
const axios = require('axios');
const QRCode = require('qrcode');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const resselFilePath = path.join(__dirname, 'ressel.db');
const resellerTermsPath = path.join(__dirname, 'reseller_terms.json');
const defaultResellerTerms = { min_accounts: 0, min_topup: 30000, join_topup_min: 18000 };
const topupManualPath = path.join(__dirname, 'topup_manual.json');
const defaultTopupManual = { enabled: true };
const topupAutoPath = path.join(__dirname, 'topup_auto.json');
const defaultTopupAuto = { enabled: true };
const topupBonusPath = path.join(__dirname, 'topup_bonus.json');
const defaultTopupBonus = { enabled: true, range_10_40: 0, range_50_70: 0, range_70_100: 0 };
const scNexusMenuPath = path.join(__dirname, 'sc_nexus_menu.json');
const defaultScNexusMenu = { enabled: true };
const testMenuPath = path.join(__dirname, 'test_menu.json');
const defaultTestMenu = { enabled: true };
const maintenancePath = path.join(__dirname, 'maintenance_mode.json');
const defaultMaintenance = { enabled: false, estimate: '' };
const joinChannelPath = path.join(__dirname, 'join_channel.json');
const defaultJoinChannel = { enabled: false, channel_url: '', channel_id: '' };
const blacklistPath = path.join(__dirname, 'blacklist.json');
const varsPath = path.join(__dirname, '.vars.json');

function loadResellerTerms() {
  try {
    const raw = fs.readFileSync(resellerTermsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const minAccounts = Number(parsed.min_accounts);
    const minTopup = Number(parsed.min_topup);
    const joinTopupMin = Number(parsed.join_topup_min);
    if (!Number.isFinite(minAccounts) || !Number.isFinite(minTopup)) {
      return { ...defaultResellerTerms };
    }
    return {
      min_accounts: Math.max(0, Math.floor(minAccounts)),
      min_topup: Math.max(0, Math.floor(minTopup)),
      join_topup_min: Number.isFinite(joinTopupMin)
        ? Math.max(0, Math.floor(joinTopupMin))
        : defaultResellerTerms.join_topup_min
    };
  } catch (err) {
    return { ...defaultResellerTerms };
  }
}

function saveResellerTerms(terms) {
  const current = loadResellerTerms();
  const payload = {
    min_accounts: Math.max(0, Math.floor(Number(terms.min_accounts ?? current.min_accounts) || 0)),
    min_topup: Math.max(0, Math.floor(Number(terms.min_topup ?? current.min_topup) || 0)),
    join_topup_min: Math.max(0, Math.floor(Number(terms.join_topup_min ?? current.join_topup_min) || 0))
  };
  fs.writeFileSync(resellerTermsPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function loadTopupManualSetting() {
  try {
    const raw = fs.readFileSync(topupManualPath, 'utf8');
    const parsed = JSON.parse(raw);
    return !!parsed.enabled;
  } catch (err) {
    return defaultTopupManual.enabled;
  }
}

function saveTopupManualSetting(enabled) {
  const payload = { enabled: !!enabled };
  fs.writeFileSync(topupManualPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload.enabled;
}

function loadTopupAutoSetting() {
  try {
    const raw = fs.readFileSync(topupAutoPath, 'utf8');
    const parsed = JSON.parse(raw);
    return !!parsed.enabled;
  } catch (err) {
    return defaultTopupAuto.enabled;
  }
}

function saveTopupAutoSetting(enabled) {
  const payload = { enabled: !!enabled };
  fs.writeFileSync(topupAutoPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload.enabled;
}

function loadTopupBonusSetting() {
  try {
    const raw = fs.readFileSync(topupBonusPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false,
      range_10_40: Number(parsed.range_10_40) || 0,
      range_50_70: Number(parsed.range_50_70) || 0,
      range_70_100: Number(parsed.range_70_100) || 0
    };
  } catch (err) {
    return { ...defaultTopupBonus };
  }
}

function saveTopupBonusSetting(next) {
  const payload = {
    enabled: next.enabled !== false,
    range_10_40: Math.max(0, Math.min(100, Number(next.range_10_40) || 0)),
    range_50_70: Math.max(0, Math.min(100, Number(next.range_50_70) || 0)),
    range_70_100: Math.max(0, Math.min(100, Number(next.range_70_100) || 0))
  };
  fs.writeFileSync(topupBonusPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function loadScNexusMenuSetting() {
  try {
    const raw = fs.readFileSync(scNexusMenuPath, 'utf8');
    const parsed = JSON.parse(raw);
    return !!parsed.enabled;
  } catch (err) {
    return defaultScNexusMenu.enabled;
  }
}

function saveScNexusMenuSetting(enabled) {
  const payload = { enabled: !!enabled };
  fs.writeFileSync(scNexusMenuPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload.enabled;
}

function loadTestMenuSetting() {
  try {
    const raw = fs.readFileSync(testMenuPath, 'utf8');
    const parsed = JSON.parse(raw);
    return !!parsed.enabled;
  } catch (err) {
    return defaultTestMenu.enabled;
  }
}

function saveTestMenuSetting(enabled) {
  const payload = { enabled: !!enabled };
  fs.writeFileSync(testMenuPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload.enabled;
}

function loadMaintenanceSetting() {
  try {
    const raw = fs.readFileSync(maintenancePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      estimate: String(parsed.estimate || '').trim(),
      updated_at: Number(parsed.updated_at || 0)
    };
  } catch (err) {
    return { ...defaultMaintenance, updated_at: 0 };
  }
}

function saveMaintenanceSetting(next) {
  const payload = {
    enabled: !!next.enabled,
    estimate: String(next.estimate || '').trim(),
    updated_at: Date.now()
  };
  fs.writeFileSync(maintenancePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function loadJoinChannelSetting() {
  try {
    const raw = fs.readFileSync(joinChannelPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      channel_url: String(parsed.channel_url || '').trim(),
      channel_id: String(parsed.channel_id || '').trim()
    };
  } catch (err) {
    return { ...defaultJoinChannel };
  }
}

function saveJoinChannelSetting(next) {
  const payload = {
    enabled: !!next.enabled,
    channel_url: String(next.channel_url || '').trim(),
    channel_id: String(next.channel_id || '').trim()
  };
  fs.writeFileSync(joinChannelPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

// ── Blacklist helpers ─────────────────────────────────────────────────────────
function loadBlacklist() {
  try {
    const raw = fs.readFileSync(blacklistPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (_) { return []; }
}

function saveBlacklist(list) {
  fs.writeFileSync(blacklistPath, JSON.stringify([...new Set(list.map(String))], null, 2), 'utf8');
}

function isUserBlacklisted(userId) {
  return loadBlacklist().includes(String(userId));
}

async function checkUserJoinedChannel(userId) {
  const setting = loadJoinChannelSetting();
  if (!setting.enabled || !setting.channel_id) return true;
  try {
    const channelId = setting.channel_id.startsWith('@')
      ? setting.channel_id
      : (setting.channel_id.startsWith('-') ? Number(setting.channel_id) : '@' + setting.channel_id);
    const member = await bot.telegram.getChatMember(channelId, userId);
    const status = member?.status || '';
    return ['member', 'administrator', 'creator'].includes(status);
  } catch (err) {
    logger.warn(`checkUserJoinedChannel error: ${err.message}`);
    // Jika gagal cek (bot bukan admin channel, dll), loloskan user
    return true;
  }
}

function formatRupiah(amount) {
  return `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
}

function getDayRange(dayOffset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset + 1, 0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}

function getMonthRange(monthOffset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1, 0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime(), labelDate: start };
}

function formatMonthLabel(dateObj) {
  try {
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  } catch (_) {
    return `${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
  }
}

function getTopupIncomeNonResellerByRange(startTs, endTs) {
  const resellerIds = (listResellersSync() || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  return new Promise((resolve, reject) => {
    if (resellerIds.length === 0) {
      db.get(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE timestamp >= ? AND timestamp < ?
           AND type = 'deposit'`,
        [startTs, endTs],
        (err, row) => {
          if (err) return reject(err);
          resolve(Number(row?.total || 0));
        }
      );
      return;
    }

    const placeholders = resellerIds.map(() => '?').join(',');
    db.get(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE timestamp >= ? AND timestamp < ?
         AND type = 'deposit'
         AND user_id NOT IN (${placeholders})`,
      [startTs, endTs, ...resellerIds],
      (err, row) => {
        if (err) return reject(err);
        resolve(Number(row?.total || 0));
      }
    );
  });
}

function getTopupIncomeResellerByRange(startTs, endTs) {
  const resellerIds = (listResellersSync() || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  return new Promise((resolve, reject) => {
    if (resellerIds.length === 0) {
      return resolve(0);
    }

    const placeholders = resellerIds.map(() => '?').join(',');
    db.get(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE timestamp >= ? AND timestamp < ?
         AND type = 'deposit'
         AND user_id IN (${placeholders})`,
      [startTs, endTs, ...resellerIds],
      (err, row) => {
        if (err) return reject(err);
        resolve(Number(row?.total || 0));
      }
    );
  });
}

function getUserRoleCounts() {
  const resellerIds = (listResellersSync() || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as total FROM users', [], (totalErr, totalRow) => {
      if (totalErr) return reject(totalErr);
      const totalUsers = Number(totalRow?.total || 0);

      if (resellerIds.length === 0) {
        return resolve({
          totalUsers,
          resellerUsers: 0,
          nonResellerUsers: totalUsers,
          resellerListCount: 0
        });
      }

      const placeholders = resellerIds.map(() => '?').join(',');
      db.get(
        `SELECT COUNT(*) as total
         FROM users
         WHERE user_id IN (${placeholders})`,
        resellerIds,
        (resErr, resRow) => {
          if (resErr) return reject(resErr);
          const resellerUsers = Number(resRow?.total || 0);
          resolve({
            totalUsers,
            resellerUsers,
            nonResellerUsers: Math.max(0, totalUsers - resellerUsers),
            resellerListCount: resellerIds.length
          });
        }
      );
    });
  });
}

function getIncomeStatsByRange(startTs, endTs) {
  const accountTypes = ['ssh', 'vmess', 'vless', 'trojan', 'shadowsocks', 'zivpn', 'udp_http'];
  const placeholders = accountTypes.map(() => '?').join(',');
  const accountParams = [startTs, endTs, ...accountTypes];
  const topupParams = [startTs, endTs];

  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE timestamp >= ? AND timestamp < ?
         AND type IN (${placeholders})
         AND (reference_id IS NULL OR reference_id NOT LIKE 'account-trial-%')`,
      accountParams,
      (accountErr, accountRow) => {
        if (accountErr) return reject(accountErr);
        db.get(
          `SELECT COALESCE(SUM(amount), 0) as total
           FROM transactions
           WHERE timestamp >= ? AND timestamp < ?
             AND type = 'deposit'`,
          topupParams,
          (topupErr, topupRow) => {
            if (topupErr) return reject(topupErr);
            resolve({
              accountCount: Number(accountRow?.count || 0),
              accountIncome: Number(accountRow?.total || 0),
              topupIncome: Number(topupRow?.total || 0)
            });
          }
        );
      }
    );
  });
}

function escapeHtmlLocal(text) {
  if (!text && text !== 0) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const { buildPayload, headers, API_URL } = require('./api-cekpayment-orkut');
const { isUserReseller, addReseller, removeReseller, listResellersSync } = require('./modules/reseller');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'bot-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'bot-combined.log' }),
  ],
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { createzivpn } = require('./modules/createzivpn');
const { trialzivpn } = require('./modules/trialzivpn');

const { 
  createssh, 
  createudphttp,
  createvmess, 
  createvless, 
  createtrojan, 
  createshadowsocks 
} = require('./modules/create');

const { 
  trialssh, 
  trialudphttp,
  trialvmess, 
  trialvless, 
  trialtrojan, 
  trialshadowsocks 
} = require('./modules/trial');

const { 
  renewssh, 
  renewudphttp,
  renewvmess, 
  renewvless, 
  renewtrojan, 
  renewshadowsocks,
  renewzivpn
} = require('./modules/renew');

const { 
  delssh, 
  delvmess, 
  delvless, 
  deltrojan, 
  delzivpn,
  deludphttp
} = require('./modules/del');

const { 
  lockssh, 
  lockvmess, 
  lockvless, 
  locktrojan, 
  lockshadowsocks 
} = require('./modules/lock');

const { 
  unlockssh, 
  unlockvmess, 
  unlockvless, 
  unlocktrojan, 
  unlockshadowsocks 
} = require('./modules/unlock');

const dbH = require('./modules/db_helpers');
const ppob = require('./modules/ppob');
const wallet = require('./modules/wallet');
const akrabModule = require('./modules/akrab');
const smmModule = require('./modules/smm');

const trialFile = path.join(__dirname, 'trial.db');

// Mengecek apakah user sudah pakai trial hari ini
async function checkTrialAccess(userId) {
  try {
    const data = await fsPromises.readFile(trialFile, 'utf8');
    const trialData = JSON.parse(data);
    const lastAccess = trialData[userId];

    const today = new Date().toISOString().slice(0, 10); // format YYYY-MM-DD
    return lastAccess === today;
  } catch (err) {
    return false; // anggap belum pernah pakai kalau file belum ada
  }
}
/////////
async function checkServerAccess(serverId, userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT is_reseller_only FROM Server WHERE id = ?', [serverId], async (err, row) => {
      if (err) return reject(err);
      // jika server tidak ada => tolak (caller menangani pesan)
      if (!row) return resolve({ ok: false, reason: 'not_found' });
      const flag = row.is_reseller_only === 1 || row.is_reseller_only === '1';
      if (!flag) return resolve({ ok: true }); // publik
      // jika reseller-only, cek apakah user terdaftar reseller
      try {
        const isR = await isUserReseller(userId);
        if (isR) return resolve({ ok: true });
        return resolve({ ok: false, reason: 'reseller_only' });
      } catch (e) {
        // fallback: tolak akses
        return resolve({ ok: false, reason: 'reseller_only' });
      }
    });
  });
}

// Menyimpan bahwa user sudah pakai trial hari ini
async function saveTrialAccess(userId) {
  let trialData = {};
  try {
    const data = await fsPromises.readFile(trialFile, 'utf8');
    trialData = JSON.parse(data);
  } catch (err) {
    // file belum ada, lanjut
  }

  const today = new Date().toISOString().slice(0, 10);
  trialData[userId] = today;
  await fsPromises.writeFile(trialFile, JSON.stringify(trialData, null, 2));
}

function loadVars() {
  try {
    return JSON.parse(fs.readFileSync(varsPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveVars(next) {
  fs.writeFileSync(varsPath, JSON.stringify(next, null, 2), 'utf8');
}

function normalizeHttpUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const u = new URL(withScheme);
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/+$/, '');
  } catch (_err) {
    return '';
  }
}

function maskSecret(secret) {
  const s = String(secret || '');
  if (!s) return '-';
  if (s.length <= 8) return '****';
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}

const vars = loadVars();

const BOT_TOKEN = vars.BOT_TOKEN;
const port = vars.PORT || 3300;
const ADMIN = vars.USER_ID; 
const NAMA_STORE = vars.NAMA_STORE || '@ARI_VPN_STORE';
let WEBHOOK_URL = String(vars.WEBHOOK_URL || '').trim();

// ── API Keys Modul Baru ──────────────────────────────────
let FAYU_ENDPOINT    = String(vars.FAYU_ENDPOINT    || 'https://fayupedia.id').trim();
let FAYU_API_ID      = String(vars.FAYU_API_ID      || '').trim();
let FAYU_API_KEY     = String(vars.FAYU_API_KEY     || '').trim();

let KHFY_ENDPOINT    = String(vars.KHFY_ENDPOINT    || 'https://panel.khfy-store.com').trim();
let KHFY_API_KEY     = String(vars.KHFY_API_KEY     || '').trim();
let KHFY_RESELLER_ID = String(vars.KHFY_RESELLER_ID || '').trim();
let KHFY_PORTAL      = String(vars.KHFY_PORTAL      || 'https://portal-trx.com/').trim();
let DATA_QRIS = vars.DATA_QRIS;
let MERCHANT_ID = vars.MERCHANT_ID;
let API_KEY = vars.API_KEY;
let RAJASERVER_API_KEY = vars.RAJASERVER_API_KEY;
let LOCAL_PAYMENT_API_KEY = String(vars.LOCAL_PAYMENT_API_KEY || vars.RAJASERVER_API_KEY || vars.API_KEY || '').trim();
let ORDERKUOTA_CREATE_MODE = String(vars.ORDERKUOTA_CREATE_MODE || 'local').trim().toLowerCase();
let PAYMENT_GATEWAY_BASE_URL = String(vars.PAYMENT_GATEWAY_BASE_URL || 'https://api.rajaserver.web.id/orderkuota/createpayment').trim();
let PAYMENT_GATEWAY_MODE = String(vars.PAYMENT_GATEWAY_MODE || 'orderkuota').trim().toLowerCase();
let GOPAY_API_BASE_URL = String(vars.GOPAY_API_BASE_URL || 'https://api-gopay.sawargipay.cloud').trim();
let GOPAY_API_KEY = String(vars.GOPAY_API_KEY || '').trim();
let ORDERKUOTA_QR_EXPIRE_MINUTES = Number(vars.ORDERKUOTA_QR_EXPIRE_MINUTES || 10);
let GOPAY_QR_EXPIRE_MINUTES = Number(vars.GOPAY_QR_EXPIRE_MINUTES || 15);
let ORDERKUOTA_MIN_TOPUP = Number(vars.ORDERKUOTA_MIN_TOPUP || 2000);
let GOPAY_MIN_TOPUP = Number(vars.GOPAY_MIN_TOPUP || 2000);
let ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS = Number(vars.ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS || 10);
let ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES = Number(vars.ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES || 3);
let ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS = Number(vars.ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS || 60);
let ORDERKUOTA_CHECK_MAX_TAPS = Number(vars.ORDERKUOTA_CHECK_MAX_TAPS || 5);
const GROUP_ID = vars.GROUP_ID;
const BW_NOTIF_GROUP_ID = vars.BW_NOTIF_GROUP_ID;
let BW_REPORT_INTERVAL_MINUTES = Number(vars.BW_REPORT_INTERVAL_MINUTES || 180);
if (!Number.isFinite(BW_REPORT_INTERVAL_MINUTES) || BW_REPORT_INTERVAL_MINUTES < 5) {
  BW_REPORT_INTERVAL_MINUTES = 180;
}
if (BW_REPORT_INTERVAL_MINUTES > 1440) BW_REPORT_INTERVAL_MINUTES = 1440;
let HIDEPULSA_TELEGRAM_USER_ID = String(vars.HIDEPULSA_TELEGRAM_USER_ID || '').trim();
let NOTIF_BOT_TOKEN = vars.NOTIF_BOT_TOKEN || '';
let NOTIF_CHAT_ID = vars.NOTIF_CHAT_ID || '';
let GLOBAL_CREATE_NOTIF_GROUP_ID = vars.GLOBAL_CREATE_NOTIF_GROUP_ID || '';
let BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN = String(
  vars.BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN ||
  vars.SC_EVENT_WEBHOOK_TOKEN ||
  ''
).trim();
let SC_MULTI_LOGIN_WEBHOOK_URL = String(
  vars.SC_MULTI_LOGIN_WEBHOOK_URL ||
  vars.BOT_ACCOUNT_EVENT_WEBHOOK_URL ||
  ''
).trim();
let ADMIN_WHATSAPP = String(vars.ADMIN_WHATSAPP || vars.CONTACT_WA || '').replace(/\D/g, '');
let ADMIN_TELEGRAM = String(vars.ADMIN_TELEGRAM || vars.CONTACT_TELEGRAM || '').trim().replace(/^@+/, '');

function reloadRuntimePaymentConfig() {
  const current = loadVars();
  DATA_QRIS = current.DATA_QRIS || '';
  MERCHANT_ID = current.MERCHANT_ID || '';
  API_KEY = current.API_KEY || '';
  RAJASERVER_API_KEY = current.RAJASERVER_API_KEY || '';
  LOCAL_PAYMENT_API_KEY = String(current.LOCAL_PAYMENT_API_KEY || current.RAJASERVER_API_KEY || current.API_KEY || '').trim();
  ORDERKUOTA_CREATE_MODE = String(current.ORDERKUOTA_CREATE_MODE || ORDERKUOTA_CREATE_MODE || 'local').trim().toLowerCase();
  HIDEPULSA_TELEGRAM_USER_ID = String(current.HIDEPULSA_TELEGRAM_USER_ID || '').trim();
  if (HIDEPULSA_TELEGRAM_USER_ID) ppob.setBotTelegramUserId(Number(HIDEPULSA_TELEGRAM_USER_ID));
  ppob.startAutoRefresh();
  if (!['local', 'gateway'].includes(ORDERKUOTA_CREATE_MODE)) {
    ORDERKUOTA_CREATE_MODE = 'local';
  }
  PAYMENT_GATEWAY_MODE = String(current.PAYMENT_GATEWAY_MODE || PAYMENT_GATEWAY_MODE || 'orderkuota').trim().toLowerCase();
  if (!['orderkuota', 'gopay', 'both'].includes(PAYMENT_GATEWAY_MODE)) {
    PAYMENT_GATEWAY_MODE = 'orderkuota';
  }
  PAYMENT_GATEWAY_BASE_URL = normalizeHttpUrl(current.PAYMENT_GATEWAY_BASE_URL || PAYMENT_GATEWAY_BASE_URL)
    || 'https://api.rajaserver.web.id/orderkuota/createpayment';
  GOPAY_API_BASE_URL = normalizeHttpUrl(current.GOPAY_API_BASE_URL || GOPAY_API_BASE_URL)
    || 'https://api-gopay.sawargipay.cloud';
  GOPAY_API_KEY = String(current.GOPAY_API_KEY || '').trim();
  ORDERKUOTA_QR_EXPIRE_MINUTES = Number(current.ORDERKUOTA_QR_EXPIRE_MINUTES || ORDERKUOTA_QR_EXPIRE_MINUTES || 10);
  GOPAY_QR_EXPIRE_MINUTES = Number(current.GOPAY_QR_EXPIRE_MINUTES || GOPAY_QR_EXPIRE_MINUTES || 15);
  ORDERKUOTA_MIN_TOPUP = Number(current.ORDERKUOTA_MIN_TOPUP || ORDERKUOTA_MIN_TOPUP || 2000);
  GOPAY_MIN_TOPUP = Number(current.GOPAY_MIN_TOPUP || GOPAY_MIN_TOPUP || 2000);
  ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS = Number(current.ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS || ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS || 10);
  ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES = Number(current.ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES || ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES || 3);
  ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS = Number(current.ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS || ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS || 60);
  ORDERKUOTA_CHECK_MAX_TAPS = Number(current.ORDERKUOTA_CHECK_MAX_TAPS || ORDERKUOTA_CHECK_MAX_TAPS || 5);

  if (!Number.isFinite(ORDERKUOTA_QR_EXPIRE_MINUTES) || ORDERKUOTA_QR_EXPIRE_MINUTES < 1) ORDERKUOTA_QR_EXPIRE_MINUTES = 10;
  if (!Number.isFinite(GOPAY_QR_EXPIRE_MINUTES) || GOPAY_QR_EXPIRE_MINUTES < 1) GOPAY_QR_EXPIRE_MINUTES = 15;
  if (!Number.isFinite(ORDERKUOTA_MIN_TOPUP) || ORDERKUOTA_MIN_TOPUP < 1000) ORDERKUOTA_MIN_TOPUP = 2000;
  if (!Number.isFinite(GOPAY_MIN_TOPUP) || GOPAY_MIN_TOPUP < 1000) GOPAY_MIN_TOPUP = 2000;
  if (!Number.isFinite(ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS) || ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS < 5) ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS = 10;
  if (!Number.isFinite(ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES) || ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES < 1) ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES = 3;
  if (!Number.isFinite(ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS) || ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS < 10) ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS = 60;
  if (!Number.isFinite(ORDERKUOTA_CHECK_MAX_TAPS) || ORDERKUOTA_CHECK_MAX_TAPS < 1) ORDERKUOTA_CHECK_MAX_TAPS = 5;
}
reloadRuntimePaymentConfig();

function isGatewayEnabled(name) {
  const mode = String(PAYMENT_GATEWAY_MODE || 'orderkuota').toLowerCase();
  if (mode === 'both') return name === 'orderkuota' || name === 'gopay';
  return mode === name;
}

function formatGatewayModeLabel() {
  switch (String(PAYMENT_GATEWAY_MODE || '').toLowerCase()) {
    case 'gopay':
      return 'GoPay saja';
    case 'both':
      return 'OrderKuota + GoPay';
    default:
      return 'OrderKuota saja';
  }
}

function getMinTopupByProvider(provider) {
  const p = String(provider || '').toLowerCase();
  if (p === 'orderkuota') return Math.max(1000, Number(ORDERKUOTA_MIN_TOPUP || 2000));
  return Math.max(1000, Number(GOPAY_MIN_TOPUP || 2000));
}

function getMinTopupByGatewayMode(mode) {
  const normalizedMode = String(mode || PAYMENT_GATEWAY_MODE || 'orderkuota').toLowerCase();
  if (normalizedMode === 'gopay') return getMinTopupByProvider('gopay');
  if (normalizedMode === 'both') return Math.max(getMinTopupByProvider('orderkuota'), getMinTopupByProvider('gopay'));
  return getMinTopupByProvider('orderkuota');
}


function formatOrderKuotaCreateModeLabel() {
  return ORDERKUOTA_CREATE_MODE === 'gateway'
    ? 'Gateway (API eksternal)'
    : 'Lokal (generate QR sendiri)';
}

function formatPaymentUserError(error) {
  return String(error?.message || error || '').slice(0, 360) || 'Terjadi kesalahan saat membuat pembayaran.';
}

function formatGatewayAxiosError(provider, error, errContext) {
  const gatewayBase = errContext?.gatewayBase ? ` di ${errContext.gatewayBase}` : '';
  const statusCode = error?.response?.status;
  const body = error?.response?.data;
  if (statusCode === 404) return `${provider} gagal create QR: endpoint tidak ditemukan (HTTP 404)${gatewayBase}.`;
  if (statusCode >= 500) return `${provider} gagal create QR: server error (HTTP ${statusCode})${gatewayBase}.`;
  if (!statusCode && !body) return `${provider} gagal create QR: request timeout ke gateway.`;
  return `${provider} gagal create QR: respons tidak valid${gatewayBase}.`;
}

function isOrderKuotaCredentialDefault() {
  try {
    const { buildPayload } = require('./api-cekpayment-orkut');
    const qs = require('qs');
    const payload = buildPayload();
    const decoded = qs.parse(payload);
    return (
      decoded.username === 'yantoxxx' ||
      decoded.username === 'AKUN_DEFAULT' ||
      (decoded.token && (
        decoded.token.includes('xxxxx') ||
        decoded.token.includes('TOKEN_DEFAULT') ||
        decoded.token.includes('contoh')
      ))
    );
  } catch (err) {
    logger.warn('Gagal membaca credential OrderKuota: ' + err.message);
    return true;
  }
}

function getPaymentGatewayReadiness() {
  const orderKuotaMissing = [];
  if (!RAJASERVER_API_KEY) orderKuotaMissing.push('RAJASERVER_API_KEY');
  if (!DATA_QRIS) orderKuotaMissing.push('DATA_QRIS');
  if (isOrderKuotaCredentialDefault()) orderKuotaMissing.push('ORKUT_USERNAME/ORKUT_TOKEN');

  const gopayMissing = [];
  if (!GOPAY_API_KEY) gopayMissing.push('GOPAY_API_KEY');

  return {
    orderkuota: {
      enabled: isGatewayEnabled('orderkuota'),
      ready: orderKuotaMissing.length === 0,
      missing: orderKuotaMissing
    },
    gopay: {
      enabled: isGatewayEnabled('gopay'),
      ready: gopayMissing.length === 0,
      missing: gopayMissing
    }
  };
}

function hasReadyEnabledPaymentGateway(readiness = getPaymentGatewayReadiness()) {
  return (
    (readiness.orderkuota.enabled && readiness.orderkuota.ready) ||
    (readiness.gopay.enabled && readiness.gopay.ready)
  );
}

function formatMissingGatewayConfig(readiness) {
  const lines = [];
  if (readiness.orderkuota.enabled && !readiness.orderkuota.ready) {
    lines.push(`OrderKuota kurang: ${readiness.orderkuota.missing.join(', ')}`);
  }
  if (readiness.gopay.enabled && !readiness.gopay.ready) {
    lines.push(`GoPay kurang: ${readiness.gopay.missing.join(', ')}`);
  }
  return lines.join('\n') || 'Gateway aktif belum siap.';
}

function formatDateId(date) {
  try {
    return date.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}
function formatDateTimeId(date) {
  try {
    return date.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function getAdminWhatsappNumber() {
  return String(ADMIN_WHATSAPP || '').replace(/\D/g, '');
}

function getAdminWhatsappUrl() {
  const number = getAdminWhatsappNumber();
  return number ? `https://wa.me/${number}` : null;
}

function getAdminTelegramUsername() {
  const normalized = String(ADMIN_TELEGRAM || '').trim().replace(/^@+/, '');
  if (normalized) return `@${normalized}`;
  return ADMIN_USERNAME || 'Admin';
}

function upsertAccountRecord(payload) {
  const now = Date.now();
  db.get(
    `SELECT id FROM accounts
      WHERE user_id = ?
        AND type = ?
        AND username = ?
        AND (
          server_id = ?
          OR (
            ? <> ''
            AND LOWER(TRIM(COALESCE(domain, ''))) = LOWER(TRIM(?))
          )
        )
      ORDER BY id DESC
      LIMIT 1`,
    [
      payload.userId,
      payload.type,
      payload.username,
      payload.serverId,
      String(payload.domain || '').trim(),
      String(payload.domain || '').trim()
    ],
    (err, row) => {
      if (err) {
        logger.error('Gagal cek akun:', err.message);
        return;
      }
      if (row) {
        db.run(
          'UPDATE accounts SET password = ?, server_id = ?, server_name = ?, domain = ?, link_tls = ?, link_none = ?, link_grpc = ?, link_uptls = ?, link_upntls = ?, account_ip_package = ?, account_price_per_day = ?, expires_at = ? WHERE id = ?',
          [
            payload.password || null,
            payload.serverId,
            payload.serverName || null,
            payload.domain || null,
            payload.link_tls || null,
            payload.link_none || null,
            payload.link_grpc || null,
            payload.link_uptls || null,
            payload.link_upntls || null,
            Number(payload.accountIpPackage || 1) === 2 ? 2 : 1,
            Math.max(0, Number(payload.accountPricePerDay || 0)),
            payload.expiresAt,
            row.id
          ]
        );
      } else {
        db.run(
          'INSERT INTO accounts (user_id, type, username, password, server_id, server_name, domain, link_tls, link_none, link_grpc, link_uptls, link_upntls, account_ip_package, account_price_per_day, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            payload.userId,
            payload.type,
            payload.username,
            payload.password || null,
            payload.serverId,
            payload.serverName || null,
            payload.domain || null,
            payload.link_tls || null,
            payload.link_none || null,
            payload.link_grpc || null,
            payload.link_uptls || null,
            payload.link_upntls || null,
            Number(payload.accountIpPackage || 1) === 2 ? 2 : 1,
            Math.max(0, Number(payload.accountPricePerDay || 0)),
            now,
            payload.expiresAt
          ]
        );
      }
    }
  );
}

function getAccountExistingExpiry(userId, type, username, serverId, domain = '') {
  return new Promise((resolve) => {
    db.get(
      `SELECT expires_at FROM accounts
        WHERE user_id = ?
          AND type = ?
          AND username = ?
          AND (
            server_id = ?
            OR (
              ? <> ''
              AND LOWER(TRIM(COALESCE(domain, ''))) = LOWER(TRIM(?))
            )
          )
        ORDER BY expires_at DESC
        LIMIT 1`,
      [userId, type, username, serverId, String(domain || '').trim(), String(domain || '').trim()],
      (err, row) => {
        if (err) {
          logger.error('Gagal ambil expires_at akun:', err.message);
          return resolve(null);
        }
        const exp = Number(row?.expires_at || 0);
        resolve(Number.isFinite(exp) && exp > 0 ? exp : null);
      }
    );
  });
}

function cleanupExpiredAccounts() {
  const now = Date.now();
  const cutoff = now - (3 * 24 * 60 * 60 * 1000);
  db.run('DELETE FROM accounts WHERE expires_at IS NOT NULL AND expires_at < ?', [cutoff], (err) => {
    if (err) {
      logger.error('Gagal cleanup accounts expired:', err.message);
    }
  });
}

function migrateAccountServerByDomain() {
  return new Promise((resolve) => {
    db.all(
      `SELECT a.id, a.domain
       FROM accounts a
       WHERE (a.server_id IS NULL OR a.server_id = 0)
         AND a.domain IS NOT NULL
         AND TRIM(a.domain) <> ''`,
      [],
      (err, rows) => {
        if (err) {
          logger.error('Gagal membaca accounts untuk migrasi server_id:', err.message);
          return resolve({ updated: 0, total: 0 });
        }

        if (!rows || rows.length === 0) {
          return resolve({ updated: 0, total: 0 });
        }

        let updated = 0;
        let processed = 0;

        const done = () => {
          if (processed >= rows.length) {
            return resolve({ updated, total: rows.length });
          }
        };

        rows.forEach((row) => {
          const domain = String(row.domain || '').trim();
          db.get(
            `SELECT id, COALESCE(NULLIF(nama_server, ''), domain) AS server_label
             FROM Server
             WHERE LOWER(TRIM(COALESCE(domain, ''))) = LOWER(TRIM(?))
             ORDER BY id DESC
             LIMIT 1`,
            [domain],
            (mapErr, serverRow) => {
              if (mapErr) {
                logger.error('Gagal mapping domain ke server saat migrasi:', mapErr.message);
                processed += 1;
                return done();
              }

              if (!serverRow) {
                processed += 1;
                return done();
              }

              db.run(
                'UPDATE accounts SET server_id = ?, server_name = COALESCE(server_name, ?), domain = ? WHERE id = ?',
                [serverRow.id, serverRow.server_label || domain, domain, row.id],
                function(updateErr) {
                  if (updateErr) {
                    logger.error('Gagal update accounts saat migrasi server_id:', updateErr.message);
                  } else if (this && this.changes > 0) {
                    updated += this.changes;
                  }
                  processed += 1;
                  done();
                }
              );
            }
          );
        });
      }
    );
  });
}

function extractAccountLinksFromMessage(message) {
  const text = String(message || '');
  const getLine = (label) => {
    const re = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i');
    const m = text.match(re);
    return m ? m[1].replace(/[`]/g, '').trim() : null;
  };

  const linkTls = getLine('link TLS') || getLine('TLS');
  const linkNone = getLine('link none TLS') || getLine('Non-TLS');
  const linkGrpc = getLine('link GRPC') || getLine('gRPC');
  const linkUpTls = getLine('link Upgrade TLS') || getLine('Up TLS');
  const linkUpNone = getLine('link Upgrade nTLS') || getLine('Up Non-TLS');

  return {
    link_tls: linkTls,
    link_none: linkNone,
    link_grpc: linkGrpc,
    link_uptls: linkUpTls,
    link_upntls: linkUpNone
  };
}

setInterval(cleanupExpiredAccounts, 6 * 60 * 60 * 1000);

async function sendNonResellerCreateNotification(payload) {
  if (!NOTIF_BOT_TOKEN || !NOTIF_CHAT_ID) return;
  try {
    const now2 = new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const text =
      `🔔 <b>Akun Baru (Non-Reseller)</b>\n` +
      `<blockquote><code>┌──────────────────────────┐</code>\n` +
      `<code>│</code> 🛠 <b>Layanan</b> : <code>${payload.service}</code>\n` +
      `<code>│</code> 🖥 <b>Server</b>  : <code>${payload.serverName || '-'}</code>\n` +
      `<code>│</code> 🌐 <b>Domain</b>  : <code>${payload.domain || '-'}</code>\n` +
      `<code>│</code> 👤 <b>Username</b>: <code>${payload.accountUsername}</code>\n` +
      `<code>│</code> 🔑 <b>Password</b>: <code>${payload.accountPassword || '-'}</code>\n` +
      `<code>├──────────────────────────┤</code>\n` +
      `<code>│</code> ⏳ <b>Durasi</b>  : <code>${payload.expDays} hari</code>\n` +
      `<code>│</code> 📅 <b>Expired</b> : <code>${payload.expiredDate}</code>\n` +
      `<code>├──────────────────────────┤</code>\n` +
      `<code>│</code> 👤 <b>Pembuat</b> : <code>${payload.creatorLabel}</code>\n` +
      `<code>│</code> 🆔 <b>User ID</b> : <code>${payload.creatorId}</code>\n` +
      `<code>│</code> 🕐 <b>Waktu</b>   : <code>${now2}</code>\n` +
      `<code>└──────────────────────────┘</code></blockquote>`;

    await axios.post(
      `https://api.telegram.org/bot${NOTIF_BOT_TOKEN}/sendMessage`,
      { chat_id: NOTIF_CHAT_ID, text, parse_mode: 'HTML' }
    );
  } catch (err) {
    logger.error(' Gagal kirim notif create non-reseller:', err.message);
  }
}

function maskAfterFirstTwoChars(raw) {
  const value = String(raw || '').trim();
  if (!value) return '-';
  if (value.length <= 2) return value;
  return value.slice(0, 2) + '*'.repeat(value.length - 2);
}

function maskKeepFirstThreeChars(raw) {
  const value = String(raw || '').trim();
  if (!value) return '-';
  if (value.length <= 3) return value;
  return value.slice(0, 3) + '*'.repeat(value.length - 3);
}

function buildCreateNotifRemarks(type, username) {
  const t = String(type || '').toLowerCase();
  const u = String(username || '').trim();
  if (!u) return '-';
  if (t === 'zivpn' || t === 'ssh' || t === 'udp_http') return maskKeepFirstThreeChars(u);
  return u;
}

async function sendGlobalCreateAccountNotification(payload) {
  const groupId = Number(String(GLOBAL_CREATE_NOTIF_GROUP_ID || '').trim());
  if (!Number.isFinite(groupId) || groupId === 0) return;

  const now1 = new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const text =
    `✅ <b>AKUN BERHASIL DIBUAT</b>\n` +
    `<blockquote><code>┌──────────────────────────┐</code>\n` +
    `<code>│</code> 👤 <b>Pembuat</b>  : <code>${payload.creatorUsername || '-'}</code>\n` +
    `<code>│</code> 🆔 <b>ID Tele</b>  : <code>${payload.creatorId || '-'}</code>\n` +
    `<code>├──────────────────────────┤</code>\n` +
    `<code>│</code> 🛠 <b>Layanan</b>  : <code>${payload.accountType || '-'}</code>\n` +
    `<code>│</code> 🖥 <b>Server</b>   : <code>${payload.serverName || '-'}</code>\n` +
    `<code>│</code> 👥 <b>Role</b>     : <code>${payload.role || '-'}</code>\n` +
    `<code>│</code> 📝 <b>Remarks</b>  : <code>${payload.remarks || '-'}</code>\n` +
    `<code>├──────────────────────────┤</code>\n` +
    `<code>│</code> ⏳ <b>Durasi</b>   : <code>${payload.expDays || 0} hari</code>\n` +
    `<code>│</code> 📅 <b>Expired</b>  : <code>${payload.expiredDate || '-'}</code>\n` +
    `<code>│</code> 💰 <b>Bayar</b>    : <code>${payload.payment || '-'}</code>\n` +
    `<code>│</code> 🕐 <b>Waktu</b>    : <code>${now1}</code>\n` +
    `<code>└──────────────────────────┘</code></blockquote>`;
  try {
    await bot.telegram.sendMessage(groupId, text, { parse_mode: 'HTML' });
  } catch (err) {
    logger.error('Gagal kirim notif create akun ke grup global:', err.message);
  }
}

// =================== PERBAIKAN GROUP_ID ===================
let GROUP_ID_NUM = null;
let BW_NOTIF_GROUP_ID_NUM = null;

try {
  // Debug: log asli dari config
  logger.info(` GROUP_ID dari .vars.json: "${GROUP_ID}" (type: ${typeof GROUP_ID})`);
  
  // Konversi ke number dengan handle berbagai format
  if (GROUP_ID === undefined || GROUP_ID === null || GROUP_ID === "") {
    logger.error(' GROUP_ID tidak ditemukan di config!');
  } else {
    // Handle string atau number
    let groupIdStr = String(GROUP_ID).trim();
    
    // Jika ada tanda kutip di string, hapus
    groupIdStr = groupIdStr.replace(/['"]/g, '');
    
    // Konversi ke number
    const converted = Number(groupIdStr);
    
    if (!isNaN(converted)) {
      GROUP_ID_NUM = converted;
      logger.info(` GROUP_ID valid: ${GROUP_ID_NUM}`);
      
      // Cek apakah ID negatif (semua grup Telegram punya ID negatif)
      if (GROUP_ID_NUM > 0) {
        logger.warn(` GROUP_ID positif (${GROUP_ID_NUM}), biasanya grup Telegram ID-nya negatif`);
        logger.warn(` Jika notifikasi gagal, coba ubah ke negatif di .vars.json`);
      }
    } else {
      logger.error(` GROUP_ID tidak valid: "${GROUP_ID}" - harus berupa angka`);
    }
  }
} catch (e) {
  logger.error(` Error processing GROUP_ID:`, e.message);
}

try {
  if (BW_NOTIF_GROUP_ID !== undefined && BW_NOTIF_GROUP_ID !== null && BW_NOTIF_GROUP_ID !== '') {
    const bwGroupStr = String(BW_NOTIF_GROUP_ID).trim().replace(/['"]/g, '');
    const convertedBw = Number(bwGroupStr);
    if (!Number.isNaN(convertedBw)) {
      BW_NOTIF_GROUP_ID_NUM = convertedBw;
      logger.info(` BW_NOTIF_GROUP_ID valid: ${BW_NOTIF_GROUP_ID_NUM}`);
    } else {
      logger.warn(` BW_NOTIF_GROUP_ID tidak valid: "${BW_NOTIF_GROUP_ID}"`);
    }
  }
} catch (e) {
  logger.warn(` Error processing BW_NOTIF_GROUP_ID: ${e.message}`);
}

const bot = new Telegraf(BOT_TOKEN);
let ADMIN_USERNAME = '';
const adminIds = ADMIN;
logger.info('Bot initialized');

// Helper terpusat: cek apakah userId adalah admin (robust untuk berbagai format USER_ID)
function isAdminId(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return false;
  if (Array.isArray(adminIds)) {
    return adminIds.map(Number).includes(uid);
  }
  if (typeof adminIds === 'string') {
    return adminIds.split(/[,\s]+/).map(s => Number(s.trim())).filter(Number.isFinite).includes(uid);
  }
  return Number(adminIds) === uid;
}

function buildMaintenanceNotice() {
  const setting = loadMaintenanceSetting();
  const estimateText = setting.estimate || 'belum ditentukan';
  return (
    ' *Bot Sedang Maintenance*\n\n' +
    'Mohon maaf, layanan bot sementara tidak tersedia.\n' +
    `Estimasi selesai maintenance: *${estimateText}*.\n\n` +
    'Silakan coba lagi nanti.'
  );
}

bot.use(async (ctx, next) => {
  const userId = Number(ctx.from?.id || 0);
  const isAdminUser = isAdminId(userId);
  if (isAdminUser) return next();

  const maintenance = loadMaintenanceSetting();
  if (!maintenance.enabled) return next();

  logger.info(`[Maintenance] Blokir user ${userId} (mode maintenance aktif)`);
  const notice = buildMaintenanceNotice();
  if (ctx.updateType === 'callback_query') {
    try {
      await ctx.answerCbQuery('Bot sedang maintenance', { show_alert: true });
    } catch (_) {}
  }
  try {
    await ctx.reply(notice, { parse_mode: 'Markdown' });
  } catch (e) {
    logger.warn(`[Maintenance] Gagal kirim notice ke ${userId}: ${e.message}`);
  }
  return;
});

// ── Middleware: Blacklist ─────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const userId = Number(ctx.from?.id || 0);
  if (!userId) return next();
  if (isAdminId(userId)) return next();
  if (isUserBlacklisted(userId)) {
    if (ctx.updateType === 'callback_query') {
      await ctx.answerCbQuery('⛔ Akun kamu diblokir.', { show_alert: true }).catch(() => {});
    } else {
      await ctx.reply('⛔ Akun kamu telah diblokir dari bot ini. Hubungi admin jika ada pertanyaan.').catch(() => {});
    }
    return;
  }
  return next();
});

// ── Middleware: Wajib Join Channel ──────────────────────────────────────────
bot.use(async (ctx, next) => {
  const userId = Number(ctx.from?.id || 0);
  if (!userId) return next();

  // Admin selalu lolos
  if (isAdminId(userId)) return next();

  const setting = loadJoinChannelSetting();
  if (!setting.enabled || !setting.channel_id) return next();

  // Tombol konfirmasi join — langsung cek ulang
  const data = ctx.callbackQuery?.data || '';
  if (data === 'check_join_channel') {
    const joined = await checkUserJoinedChannel(userId);
    if (joined) {
      await ctx.answerCbQuery('✅ Terima kasih sudah join!', { show_alert: false }).catch(() => {});
      // Hapus pesan wajib join, lalu kirim menu utama sebagai pesan baru
      try { await ctx.deleteMessage(); } catch (_) {}
      // Kirim menu utama langsung tanpa bergantung pada ctx.editMessageText
      ctx.updateType = 'message'; // paksa sendMainMenu kirim pesan baru
      return sendMainMenu(ctx);
    } else {
      await ctx.answerCbQuery('❌ Kamu belum join channel! Pastikan sudah join lalu coba lagi.', { show_alert: true }).catch(() => {});
      return;
    }
  }

  const joined = await checkUserJoinedChannel(userId);
  if (joined) return next();

  // Blokir dan tampilkan pesan wajib join
  const channelUrl = setting.channel_url || 'https://t.me/';
  const keyboard = {
    inline_keyboard: [
      [{ text: '📢 Join Channel', url: channelUrl }],
      [{ text: '✅ Sudah Join, Konfirmasi', callback_data: 'check_join_channel' }]
    ]
  };
  const msg =
    '⚠️ *Wajib Join Channel*\n\n' +
    'Untuk menggunakan bot ini, kamu harus join channel kami terlebih dahulu.\n\n' +
    '1. Klik tombol *Join Channel* di bawah\n' +
    '2. Setelah join, klik *Sudah Join, Konfirmasi*';

  if (ctx.updateType === 'callback_query') {
    await ctx.answerCbQuery('Kamu harus join channel dulu!', { show_alert: true }).catch(() => {});
    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => {});
  } else {
    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => {});
  }
  return;
});

function getScEventBearerToken(req) {
  const auth = String(req.headers?.authorization || '').trim();
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  const fromScHeader = String(req.headers?.['x-sc-event-token'] || '').trim();
  const fromWebhookHeader = String(req.headers?.['x-webhook-token'] || '').trim();
  const fromBody = String(req.body?.token || req.body?.webhook_token || '').trim();
  const fromQuery = String(req.query?.token || req.query?.webhook_token || '').trim();
  return fromScHeader || fromWebhookHeader || fromBody || fromQuery || auth;
}

function normalizeTelegramTarget(raw) {
  const text = String(raw || '').trim();
  if (!text || text === '0' || text.toLowerCase() === 'null') return '';
  return text;
}

function formatMultiLoginUserNotification(payload = {}) {
  const rawService = String(payload.service || payload.layanan || '-').toUpperCase();
  const service = rawService === 'SSH/ZIVPN' ? 'SSH/ZIVPN/UDPHC' : rawService;
  const username = String(payload.username || '-').trim() || '-';
  const limitIp = Number(payload.limitip || payload.limit_ip || 0);
  const detected = Number(payload.detected_effective || payload.detected || payload.connected_ip || 0);
  const detectedRaw = Number(payload.detected_raw || 0);
  const unlockMinutes = Number(payload.unlock_minutes || payload.unlock || 0);
  const ips = Array.isArray(payload.ips)
    ? payload.ips.map((ip) => String(ip || '').trim()).filter(Boolean).slice(0, 8)
    : [];
  const now = new Date();
  const unlockAt = unlockMinutes > 0
    ? new Date(now.getTime() + (unlockMinutes * 60 * 1000))
    : null;
  const unlockAtText = unlockAt
    ? unlockAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    : '-';
  const timeText = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const extraDetectedText =
    detectedRaw > 0 && detectedRaw !== detected
      ? `Info      : Terdeteksi raw ${detectedRaw} IP, dihitung ${detected} IP/device`
      : '';
  return [
    ' NOTIFIKASI MULTI LOGIN',
    '',
    `Layanan  : ${service}`,
    `Username : ${username}`,
    `Limit IP : ${limitIp}`,
    `Terdeteksi: ${detected}`,
    '',
    `Akun akan normal lagi di jam ${unlockAtText}`,
    `Waktu    : ${timeText}`,
    '',
    'Akun dikunci sementara karena login melebihi limit IP, Mohon untuk tidak gunakan akun ini secara bersama sama melebihi IP limit yang sudah di tentukan',
    '',
    '1IP = Gunakan 1HP/Device',
    '2IP = Gunakan 2HP/Device',
    '',
    'Jangan mode pesawat, jika zivpn bengong konek tapi ga ada internetnya cukup stop apk udpnya lalu start ulang.'
  ].filter((v) => v !== null && v !== undefined).join('\n');
}

async function isValidScEventToken(token) {
  const incoming = String(token || '').trim();
  if (!incoming) return false;
  if (BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN && incoming === BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN) return true;

  try {
    const row = await dbGetAsync(
      'SELECT id FROM Server WHERE auth = ? LIMIT 1',
      [incoming]
    );
    return !!row;
  } catch (err) {
    logger.warn(`Validasi token event SC gagal: ${err.message}`);
    return false;
  }
}

app.post('/sc1forcr/events/multi-login', async (req, res) => {
  try {
    const givenToken = getScEventBearerToken(req);
    if (!(await isValidScEventToken(givenToken))) {
      return res.status(401).json({ ok: false, message: 'unauthorized' });
    }

    const payload = req.body || {};
    const event = String(payload.event || '').trim().toUpperCase();
    if (event && event !== 'MULTI_LOGIN') {
      return res.status(400).json({ ok: false, message: 'unsupported event' });
    }

    const targetChatId = normalizeTelegramTarget(
      payload.owner_telegram_chat_id ||
      payload.telegram_chat_id ||
      payload.chat_id ||
      payload.owner_telegram_id ||
      payload.telegram_user_id
    );
    if (!targetChatId) {
      return res.status(202).json({ ok: false, skipped: true, message: 'owner telegram id is empty' });
    }

    const text = formatMultiLoginUserNotification(payload);
    await bot.telegram.sendMessage(targetChatId, text);
    logger.info(` Multi-login notif dikirim ke user ${targetChatId} (${payload.service || '-'}:${payload.username || '-'})`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(' Gagal proses webhook multi-login:', err.message);
    return res.status(500).json({ ok: false, message: 'internal error' });
  }
});

// ── Webhook Akrab / khfy-store (GET callback) ───────────────────────────────
// Spec PRD 12.3: GET ke URL yang diset di profil panel
// Format: RC={reffid} TrxID={id} {produk}.{tujuan} {status} {keterangan}
app.get('/webhook/akrab', async (req, res) => {
  try {
    // Akrab mengirim data via query string atau raw message
    const msg = String(
      req.query.msg || req.query.message || req.query.data ||
      req.query.RC || ''
    ).trim();

    logger.info(' Webhook Akrab diterima: ' + (msg || JSON.stringify(req.query)));

    // Parse format: RC={reffid} TrxID={id} {produk}.{tujuan} {status} {keterangan}
    let reffId = String(req.query.RC || req.query.reff_id || req.query.refid || '').trim();
    let trxId  = String(req.query.TrxID || req.query.trx_id || '').trim();
    let rawStatus = String(req.query.status || req.query.keterangan || '').trim().toLowerCase();

    // Coba parse dari format pesan teks jika query params tidak lengkap
    if (!reffId && msg) {
      const rcMatch  = msg.match(/RC=([^\s]+)/i);
      const trxMatch = msg.match(/TrxID=([^\s]+)/i);
      const stMatch  = msg.match(/\b(sukses|success|gagal|failed|pending|proses)\b/i);
      if (rcMatch)  reffId    = rcMatch[1];
      if (trxMatch) trxId     = trxMatch[1];
      if (stMatch)  rawStatus = stMatch[1].toLowerCase();
    }

    if (!reffId) {
      logger.warn(' Webhook Akrab: reff_id tidak ditemukan');
      return res.status(200).send('OK'); // Selalu 200 agar provider tidak retry terus
    }

    // Normalisasi status
    let newStatus = null;
    if (['sukses', 'success', 'berhasil', 'completed'].some(s => rawStatus.includes(s))) {
      newStatus = 'success';
    } else if (['gagal', 'failed', 'error', 'cancel'].some(s => rawStatus.includes(s))) {
      newStatus = 'failed';
    } else if (['proses', 'processing', 'pending'].some(s => rawStatus.includes(s))) {
      newStatus = 'processing';
    }

    if (newStatus) {
      await dbH.updateAkrabOrderStatus(db, reffId, newStatus);
      logger.info(` Webhook Akrab: reff_id ${reffId} → ${newStatus}`);

      // Notifikasi ke user jika status final
      if (newStatus === 'success' || newStatus === 'failed') {
        const order = await dbH.getAkrabOrderByReffId(db, reffId).catch(() => null);
        if (order && order.user_id) {
          const emoji = newStatus === 'success' ? '' : '';
          const label = newStatus === 'success' ? 'Berhasil' : 'Gagal';
          const keterangan = String(req.query.keterangan || rawStatus || '').trim();
          const msg2 =
            `${emoji} <b>Update Transaksi Akrab</b>\n\n` +
            `Ref ID  : <code>${reffId}</code>\n` +
            (trxId ? `Trx ID  : <code>${trxId}</code>\n` : '') +
            `Produk  : ${order.produk || '-'}\n` +
            `Tujuan  : ${order.tujuan || '-'}\n` +
            `Nominal : Rp ${Number(order.amount || 0).toLocaleString('id-ID')}\n` +
            `Status  : <b>${label}</b>` +
            (keterangan ? `\nKet     : ${keterangan}` : '');
          await bot.telegram.sendMessage(order.user_id, msg2, { parse_mode: 'HTML' }).catch(() => {});
        }
      }
    } else {
      logger.info(`ℹ Webhook Akrab: reff_id ${reffId}, status tidak dikenali: "${rawStatus}"`);
    }

    return res.status(200).send('OK');
  } catch (err) {
    logger.error(' Webhook Akrab error: ' + (err && err.message ? err.message : err));
    return res.status(200).send('OK'); // Selalu 200 agar provider tidak retry
  }
});

// Juga support POST untuk webhook Akrab (beberapa panel kirim POST)
app.post('/webhook/akrab', async (req, res) => {
  // Gabungkan query + body lalu forward ke handler GET logic
  req.query = Object.assign({}, req.query, req.body || {});
  const msg = String(req.query.msg || req.query.message || req.query.data || '').trim();
  let reffId = String(req.query.RC || req.query.reff_id || req.query.refid || '').trim();
  let trxId  = String(req.query.TrxID || req.query.trx_id || '').trim();
  let rawStatus = String(req.query.status || req.query.keterangan || '').trim().toLowerCase();

  if (!reffId && msg) {
    const rcMatch  = msg.match(/RC=([^\s]+)/i);
    const trxMatch = msg.match(/TrxID=([^\s]+)/i);
    const stMatch  = msg.match(/\b(sukses|success|gagal|failed|pending|proses)\b/i);
    if (rcMatch)  reffId    = rcMatch[1];
    if (trxMatch) trxId     = trxMatch[1];
    if (stMatch)  rawStatus = stMatch[1].toLowerCase();
  }

  if (!reffId) return res.status(200).send('OK');

  let newStatus = null;
  if (['sukses', 'success', 'berhasil', 'completed'].some(s => rawStatus.includes(s))) newStatus = 'success';
  else if (['gagal', 'failed', 'error', 'cancel'].some(s => rawStatus.includes(s))) newStatus = 'failed';
  else if (['proses', 'processing', 'pending'].some(s => rawStatus.includes(s))) newStatus = 'processing';

  if (newStatus) {
    await dbH.updateAkrabOrderStatus(db, reffId, newStatus).catch(() => {});
    logger.info(` Webhook Akrab (POST): reff_id ${reffId} → ${newStatus}`);
    if (newStatus === 'success' || newStatus === 'failed') {
      const order = await dbH.getAkrabOrderByReffId(db, reffId).catch(() => null);
      if (order && order.user_id) {
        const emoji = newStatus === 'success' ? '' : '';
        const label = newStatus === 'success' ? 'Berhasil' : 'Gagal';
        const msg2 =
          `${emoji} <b>Update Transaksi Akrab</b>\n\n` +
          `Ref ID  : <code>${reffId}</code>\n` +
          (trxId ? `Trx ID  : <code>${trxId}</code>\n` : '') +
          `Produk  : ${order.produk || '-'}\n` +
          `Tujuan  : ${order.tujuan || '-'}\n` +
          `Nominal : Rp ${Number(order.amount || 0).toLocaleString('id-ID')}\n` +
          `Status  : <b>${label}</b>`;
        await bot.telegram.sendMessage(order.user_id, msg2, { parse_mode: 'HTML' }).catch(() => {});
      }
    }
  }
  return res.status(200).send('OK');
});

async function notifyGroupAccountDeleted(payload) {
  if (!GROUP_ID_NUM) return;

  try {
    const actorName = payload.actorUsername ? '@' + String(payload.actorUsername).replace(/^@/, '') : '-';
    const deletedName = payload.deletedUsername ? '@' + String(payload.deletedUsername).replace(/^@/, '') : '-';
    const nowDel = new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const text =
      `🗑️ <b>AKUN DIHAPUS</b>\n` +
      `<blockquote><code>┌──────────────────────────┐</code>\n` +
      `<code>│</code> 👤 <b>Pelaku</b>    : <code>${actorName}</code>\n` +
      `<code>│</code> 🆔 <b>ID Pelaku</b> : <code>${payload.actorId || '-'}</code>\n` +
      `<code>│</code> 🎯 <b>Target ID</b> : <code>${payload.targetUserId || '-'}</code>\n` +
      `<code>├──────────────────────────┤</code>\n` +
      `<code>│</code> 🛠 <b>Layanan</b>   : <code>${payload.service || '-'}</code>\n` +
      `<code>│</code> 👤 <b>Username</b>  : <code>${payload.accountUsername || '-'}</code>\n` +
      `<code>│</code> 🖥 <b>Server</b>    : <code>${payload.serverName || '-'}</code>\n` +
      `<code>├──────────────────────────┤</code>\n` +
      `<code>│</code> 💰 <b>Refund</b>    : <code>Rp ${Number(payload.refund||0).toLocaleString('id-ID')}</code>\n` +
      `<code>│</code> ⏳ <b>Sisa Hari</b> : <code>${Number(payload.remainingDays||0)} hari</code>\n` +
      `<code>│</code> 📝 <b>Ket</b>       : <code>${payload.note || '-'}</code>\n` +
      `<code>│</code> 🕐 <b>Waktu</b>     : <code>${nowDel}</code>\n` +
      `<code>└──────────────────────────┘</code></blockquote>`;
    await bot.telegram.sendMessage(GROUP_ID_NUM, text, { parse_mode: 'HTML' });
  } catch (err) {
    logger.warn('Gagal kirim notif hapus akun ke grup: ' + err.message);
  }
}


(async () => {
  try {
    const adminId = Array.isArray(adminIds) ? adminIds[0] : adminIds;
    const chat = await bot.telegram.getChat(adminId);
    ADMIN_USERNAME = chat.username ? `@${chat.username}` : 'Admin';
    logger.info(`Admin username detected: ${ADMIN_USERNAME}`);
  } catch (e) {
    ADMIN_USERNAME = 'Admin';
    logger.warn('Tidak bisa ambil username admin otomatis.');
  }
})();
/////
const dbPath = path.join(__dirname, 'sellvpn.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Kesalahan koneksi SQLite3:', err.message);
  } else {
    logger.info('Terhubung ke SQLite3');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS pending_deposits (
  unique_code TEXT PRIMARY KEY,
  user_id INTEGER,
  amount INTEGER,
  original_amount INTEGER,
  timestamp INTEGER,
  status TEXT,
  qr_message_id INTEGER
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel pending_deposits:', err.message);
  }
});

const pendingDepositMigrations = [
  "ALTER TABLE pending_deposits ADD COLUMN gateway_provider TEXT DEFAULT 'orderkuota'",
  "ALTER TABLE pending_deposits ADD COLUMN provider_tx_id TEXT",
  "ALTER TABLE pending_deposits ADD COLUMN reference_id TEXT",
  "ALTER TABLE pending_deposits ADD COLUMN admin_fee INTEGER DEFAULT 0",
  "ALTER TABLE pending_deposits ADD COLUMN topup_purpose TEXT DEFAULT 'regular'",
  "ALTER TABLE pending_deposits ADD COLUMN expires_at INTEGER"
];
pendingDepositMigrations.forEach((sql) => {
  db.run(sql, (err) => {
    if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
      logger.warn('Migrasi pending_deposits gagal: ' + err.message);
    }
  });
});

db.run(`CREATE TABLE IF NOT EXISTS Server (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT,
  auth TEXT,
  harga INTEGER,
  harga_reseller INTEGER,
  harga_1ip INTEGER DEFAULT 0,
  harga_2ip INTEGER DEFAULT 0,
  harga_reseller_1ip INTEGER DEFAULT 0,
  harga_reseller_2ip INTEGER DEFAULT 0,
  harga_1ip_30hari INTEGER DEFAULT 0,
  harga_2ip_30hari INTEGER DEFAULT 0,
  harga_reseller_1ip_30hari INTEGER DEFAULT 0,
  harga_reseller_2ip_30hari INTEGER DEFAULT 0,
  harga_mode_harian_enabled INTEGER DEFAULT 1,
  harga_mode_30hari_enabled INTEGER DEFAULT 0,
  nama_server TEXT,
  quota INTEGER,
  iplimit INTEGER,
  batas_create_akun INTEGER,
  total_create_akun INTEGER,
  is_reseller_only INTEGER DEFAULT 0,
  support_ssh INTEGER DEFAULT 1,
  support_vmess INTEGER DEFAULT 1,
  support_vless INTEGER DEFAULT 1,
  support_trojan INTEGER DEFAULT 1,
  support_shadowsocks INTEGER DEFAULT 1,
  support_zivpn INTEGER DEFAULT 0,
  support_udp_http INTEGER DEFAULT 0,
  service TEXT DEFAULT 'ssh',
  sync_host TEXT,
  sync_port INTEGER DEFAULT 8789,
  sync_endpoint TEXT DEFAULT '/internal/account-summary',
  sync_enabled INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  bandwidth_limit_tb REAL DEFAULT 0,
  bandwidth_user_daily_gb REAL DEFAULT 8,
  bandwidth_daily_gb REAL DEFAULT 0,
  bandwidth_monthly_used_tb REAL DEFAULT 0,
  bandwidth_remaining_tb REAL DEFAULT 0,
  bandwidth_estimated_capacity INTEGER DEFAULT 0,
  bandwidth_last_sync_at INTEGER DEFAULT 0,
  bandwidth_alert_last_notified_at INTEGER DEFAULT 0
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel Server:', err.message);
  } else {
    logger.info('Server table created or already exists');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS server_iplimit_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  protocol TEXT NOT NULL,
  ip_package INTEGER NOT NULL,
  iplimit INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT 0,
  UNIQUE(server_id, protocol, ip_package)
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel server_iplimit_rules:', err.message);
  }
});

db.run("UPDATE Server SET total_create_akun = 0 WHERE total_create_akun IS NULL", function(err) {
  if (err) {
    logger.error('Error fixing NULL total_create_akun:', err.message);
  } else {
    if (this.changes > 0) {
      logger.info(` Fixed ${this.changes} servers with NULL total_create_akun`);
    }
  }
});

db.all("PRAGMA table_info(Server)", (err, rows) => {
  if (err) {
    logger.error('Error checking Server schema:', err.message);
    return;
  }

  const cols = rows.map(r => r.name);

  db.serialize(() => {
    if (!cols.includes('support_ssh')) {
      db.run("ALTER TABLE Server ADD COLUMN support_ssh INTEGER DEFAULT 1");
    }
    if (!cols.includes('support_vmess')) {
      db.run("ALTER TABLE Server ADD COLUMN support_vmess INTEGER DEFAULT 1");
    }
    if (!cols.includes('support_vless')) {
      db.run("ALTER TABLE Server ADD COLUMN support_vless INTEGER DEFAULT 1");
    }
    if (!cols.includes('support_trojan')) {
      db.run("ALTER TABLE Server ADD COLUMN support_trojan INTEGER DEFAULT 1");
    }
    if (!cols.includes('support_shadowsocks')) {
      db.run("ALTER TABLE Server ADD COLUMN support_shadowsocks INTEGER DEFAULT 1");
    }
    if (!cols.includes('support_zivpn')) {
      db.run("ALTER TABLE Server ADD COLUMN support_zivpn INTEGER DEFAULT 0");
    }
    if (!cols.includes('support_udp_http')) {
      db.run("ALTER TABLE Server ADD COLUMN support_udp_http INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_reseller')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_reseller INTEGER");
    }
    if (!cols.includes('harga_1ip')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_1ip INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_2ip')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_2ip INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_reseller_1ip')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_reseller_1ip INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_reseller_2ip')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_reseller_2ip INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_1ip_30hari')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_1ip_30hari INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_2ip_30hari')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_2ip_30hari INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_reseller_1ip_30hari')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_reseller_1ip_30hari INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_reseller_2ip_30hari')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_reseller_2ip_30hari INTEGER DEFAULT 0");
    }
    if (!cols.includes('harga_mode_harian_enabled')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_mode_harian_enabled INTEGER DEFAULT 1");
    }
    if (!cols.includes('harga_mode_30hari_enabled')) {
      db.run("ALTER TABLE Server ADD COLUMN harga_mode_30hari_enabled INTEGER DEFAULT 0");
    }
    if (!cols.includes('sync_host')) {
      db.run("ALTER TABLE Server ADD COLUMN sync_host TEXT");
    }
    if (!cols.includes('sync_port')) {
      db.run("ALTER TABLE Server ADD COLUMN sync_port INTEGER DEFAULT 8789");
    }
    if (!cols.includes('sync_endpoint')) {
      db.run("ALTER TABLE Server ADD COLUMN sync_endpoint TEXT DEFAULT '/internal/account-summary'");
    }
    if (!cols.includes('sync_enabled')) {
      db.run("ALTER TABLE Server ADD COLUMN sync_enabled INTEGER DEFAULT 1");
    }
    if (!cols.includes('is_active')) {
      db.run("ALTER TABLE Server ADD COLUMN is_active INTEGER DEFAULT 1");
    }
    if (!cols.includes('bandwidth_limit_tb')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_limit_tb REAL DEFAULT 0");
    }
    if (!cols.includes('bandwidth_user_daily_gb')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_user_daily_gb REAL DEFAULT 8");
    }
    if (!cols.includes('bandwidth_daily_gb')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_daily_gb REAL DEFAULT 0");
    }
    if (!cols.includes('bandwidth_monthly_used_tb')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_monthly_used_tb REAL DEFAULT 0");
    }
    if (!cols.includes('bandwidth_remaining_tb')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_remaining_tb REAL DEFAULT 0");
    }
    if (!cols.includes('bandwidth_estimated_capacity')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_estimated_capacity INTEGER DEFAULT 0");
    }
    if (!cols.includes('bandwidth_last_sync_at')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_last_sync_at INTEGER DEFAULT 0");
    }
    if (!cols.includes('bandwidth_alert_last_notified_at')) {
      db.run("ALTER TABLE Server ADD COLUMN bandwidth_alert_last_notified_at INTEGER DEFAULT 0");
    }

    // Jalankan normalisasi setelah migrasi kolom ter-queue
    db.run("UPDATE Server SET support_ssh = 1 WHERE support_ssh IS NULL");
    db.run("UPDATE Server SET support_vmess = 1 WHERE support_vmess IS NULL");
    db.run("UPDATE Server SET support_vless = 1 WHERE support_vless IS NULL");
    db.run("UPDATE Server SET support_trojan = 1 WHERE support_trojan IS NULL");
    db.run("UPDATE Server SET support_shadowsocks = 1 WHERE support_shadowsocks IS NULL");
    db.run("UPDATE Server SET support_zivpn = 0 WHERE support_zivpn IS NULL");
    db.run("UPDATE Server SET support_udp_http = 0 WHERE support_udp_http IS NULL");
    db.run("UPDATE Server SET support_zivpn = 1 WHERE service = 'zivpn' AND support_zivpn = 0");
    db.run("UPDATE Server SET harga_1ip = COALESCE(NULLIF(harga_1ip, 0), harga, 0)");
    db.run("UPDATE Server SET harga_2ip = COALESCE(NULLIF(harga_2ip, 0), harga, 0)");
    db.run("UPDATE Server SET harga_reseller_1ip = COALESCE(NULLIF(harga_reseller_1ip, 0), harga_reseller, harga_1ip, harga, 0)");
    db.run("UPDATE Server SET harga_reseller_2ip = COALESCE(NULLIF(harga_reseller_2ip, 0), harga_reseller, harga_2ip, harga, 0)");
    db.run("UPDATE Server SET harga_1ip_30hari = COALESCE(NULLIF(harga_1ip_30hari, 0), COALESCE(harga_1ip, harga, 0) * 30)");
    db.run("UPDATE Server SET harga_2ip_30hari = COALESCE(NULLIF(harga_2ip_30hari, 0), COALESCE(harga_2ip, harga, 0) * 30)");
    db.run("UPDATE Server SET harga_reseller_1ip_30hari = COALESCE(NULLIF(harga_reseller_1ip_30hari, 0), COALESCE(harga_reseller_1ip, harga_reseller, harga_1ip, harga, 0) * 30)");
    db.run("UPDATE Server SET harga_reseller_2ip_30hari = COALESCE(NULLIF(harga_reseller_2ip_30hari, 0), COALESCE(harga_reseller_2ip, harga_reseller, harga_2ip, harga, 0) * 30)");
    db.run("UPDATE Server SET harga_mode_harian_enabled = 1 WHERE harga_mode_harian_enabled IS NULL");
    db.run("UPDATE Server SET harga_mode_30hari_enabled = 0 WHERE harga_mode_30hari_enabled IS NULL");
    db.run("UPDATE Server SET sync_port = 8789 WHERE sync_port IS NULL OR sync_port = 0");
    db.run("UPDATE Server SET sync_endpoint = '/internal/account-summary' WHERE sync_endpoint IS NULL OR TRIM(sync_endpoint) = ''");
    db.run("UPDATE Server SET sync_enabled = 1 WHERE sync_enabled IS NULL");
    db.run("UPDATE Server SET is_active = 1 WHERE is_active IS NULL");
    db.run("UPDATE Server SET bandwidth_limit_tb = 0 WHERE bandwidth_limit_tb IS NULL");
    db.run("UPDATE Server SET bandwidth_user_daily_gb = 8 WHERE bandwidth_user_daily_gb IS NULL OR bandwidth_user_daily_gb <= 0");
    db.run("UPDATE Server SET bandwidth_daily_gb = 0 WHERE bandwidth_daily_gb IS NULL");
    db.run("UPDATE Server SET bandwidth_monthly_used_tb = 0 WHERE bandwidth_monthly_used_tb IS NULL");
    db.run("UPDATE Server SET bandwidth_remaining_tb = 0 WHERE bandwidth_remaining_tb IS NULL");
    db.run("UPDATE Server SET bandwidth_estimated_capacity = 0 WHERE bandwidth_estimated_capacity IS NULL");
    db.run("UPDATE Server SET bandwidth_last_sync_at = 0 WHERE bandwidth_last_sync_at IS NULL");
    db.run("UPDATE Server SET bandwidth_alert_last_notified_at = 0 WHERE bandwidth_alert_last_notified_at IS NULL");
  });
});
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  saldo INTEGER DEFAULT 0,
  CONSTRAINT unique_user_id UNIQUE (user_id)
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel users:', err.message);
  } else {
    logger.info('Users table created or already exists');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount INTEGER,
  type TEXT,
  reference_id TEXT,
  timestamp INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel transactions:', err.message);
  } else {
    logger.info('Transactions table created or already exists');
    
    // Add reference_id column if it doesn't exist
    db.get("PRAGMA table_info(transactions)", (err, rows) => {
      if (err) {
        logger.error('Kesalahan memeriksa struktur tabel:', err.message);
        return;
      }
      
      db.get("SELECT * FROM transactions WHERE reference_id IS NULL LIMIT 1", (err, row) => {
        if (err && err.message.includes('no such column')) {
          // Column doesn't exist, add it
          db.run("ALTER TABLE transactions ADD COLUMN reference_id TEXT", (err) => {
            if (err) {
              logger.error('Kesalahan menambahkan kolom reference_id:', err.message);
            } else {
              logger.info('Kolom reference_id berhasil ditambahkan ke tabel transactions');
            }
          });
        } else if (row) {
          // Update existing transactions with reference_id
          db.all("SELECT id, user_id, type, timestamp FROM transactions WHERE reference_id IS NULL", [], (err, rows) => {
            if (err) {
              logger.error('Kesalahan mengambil transaksi tanpa reference_id:', err.message);
              return;
            }
            
            rows.forEach(row => {
              const referenceId = `account-${row.type}-${row.user_id}-${row.timestamp}`;
              db.run("UPDATE transactions SET reference_id = ? WHERE id = ?", [referenceId, row.id], (err) => {
                if (err) {
                  logger.error(`Kesalahan mengupdate reference_id untuk transaksi ${row.id}:`, err.message);
                } else {
                  logger.info(`Berhasil mengupdate reference_id untuk transaksi ${row.id}`);
                }
              });
            });
          });
        }
      });
    });
  }
});

db.run(`CREATE TABLE IF NOT EXISTS broadcast_polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  created_by INTEGER,
  created_at INTEGER,
  is_active INTEGER DEFAULT 1
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel broadcast_polls:', err.message);
  }
});

db.run(`CREATE TABLE IF NOT EXISTS broadcast_poll_votes (
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  voted_at INTEGER,
  PRIMARY KEY (poll_id, user_id)
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel broadcast_poll_votes:', err.message);
  }
});

db.run(`CREATE TABLE IF NOT EXISTS download_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_unique_id TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER DEFAULT 0,
  uploaded_by INTEGER,
  created_at INTEGER
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel download_configs:', err.message);
  }
});

// ── Migrasi: kolom baru di tabel existing ────────────────
db.run(`ALTER TABLE users ADD COLUMN saldo_akrab INTEGER DEFAULT 0`, (err) => {
  if (err && !err.message.includes('duplicate column')) logger.error('migrate saldo_akrab:', err.message);
});
db.run(`ALTER TABLE pending_deposits ADD COLUMN wallet_type TEXT DEFAULT 'vpn'`, (err) => {
  if (err && !err.message.includes('duplicate column')) logger.error('migrate wallet_type:', err.message);
});

// ── Tabel Baru: akrab_orders ─────────────────────────────
db.run(`CREATE TABLE IF NOT EXISTS akrab_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reff_id TEXT UNIQUE,
  produk TEXT,
  tujuan TEXT,
  amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
)`, (err) => {
  if (err) logger.error('Kesalahan membuat tabel akrab_orders:', err.message);
});

// ── Tabel Baru: akrab_preorders ──────────────────────────
// Kolom baru: produk_kode, tujuan, harga untuk auto-beli
db.run(`CREATE TABLE IF NOT EXISTS akrab_preorders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tipe TEXT NOT NULL,
  produk_kode TEXT,
  tujuan TEXT,
  harga INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
)`, (err) => {
  if (err) logger.error('Kesalahan membuat tabel akrab_preorders:', err.message);
});
// Migrasi kolom baru jika tabel sudah ada
['produk_kode TEXT', 'tujuan TEXT', 'harga INTEGER DEFAULT 0'].forEach(col => {
  const colName = col.split(' ')[0];
  db.run(`ALTER TABLE akrab_preorders ADD COLUMN ${col}`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      logger.error(`migrate akrab_preorders.${colName}:`, err.message);
    }
  });
});

// ── Tabel Baru: smm_orders ───────────────────────────────
db.run(`CREATE TABLE IF NOT EXISTS smm_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id TEXT,
  service_id INTEGER,
  target TEXT,
  quantity INTEGER DEFAULT 0,
  amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
)`, (err) => {
  if (err) logger.error('Kesalahan membuat tabel smm_orders:', err.message);
});

// ── Tabel Baru: markup_config ────────────────────────────
db.run(`CREATE TABLE IF NOT EXISTS markup_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  service TEXT NOT NULL,
  user_id INTEGER,
  type TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0
)`, (err) => {
  if (err) logger.error('Kesalahan membuat tabel markup_config:', err.message);
});

const userState = {};
const lastMenuMessageId = new Map();
const allResellerStatsSessions = new Map();
const ORDERKUOTA_CHECK_REPLY_TEXT = ' Sudah Bayar, Cek Status';
logger.info('User state initialized');

const dbAllAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

const dbRunAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) return reject(err);
    resolve(this);
  });
});

const dbGetAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
});

const SERVER_PROTOCOL_SUPPORT = {
  ssh: { column: 'support_ssh', label: 'SSH', defaultEnabled: 1 },
  vmess: { column: 'support_vmess', label: 'VMess', defaultEnabled: 1 },
  vless: { column: 'support_vless', label: 'VLess', defaultEnabled: 1 },
  trojan: { column: 'support_trojan', label: 'Trojan', defaultEnabled: 1 },
  shadowsocks: { column: 'support_shadowsocks', label: 'Shadowsocks', defaultEnabled: 1 },
  zivpn: { column: 'support_zivpn', label: 'ZIVPN', defaultEnabled: 0 },
  udp_http: { column: 'support_udp_http', label: 'UDP HTTP', defaultEnabled: 0 }
};

const SERVER_PROTOCOL_KEYS = Object.keys(SERVER_PROTOCOL_SUPPORT);

function getServerProtocolSupport(type) {
  return SERVER_PROTOCOL_SUPPORT[String(type || '').toLowerCase()] || null;
}

function isServerProtocolEnabled(server, type) {
  const protocol = getServerProtocolSupport(type);
  if (!protocol) return true;
  return Number(server?.[protocol.column] ?? protocol.defaultEnabled) === 1;
}

function formatServerProtocolStatusLine(server) {
  return SERVER_PROTOCOL_KEYS
    .map((key) => {
      const protocol = SERVER_PROTOCOL_SUPPORT[key];
      const enabled = Number(server?.[protocol.column] ?? protocol.defaultEnabled) === 1;
      return `${protocol.label}:${enabled ? 'ON' : 'OFF'}`;
    })
    .join(' | ');
}

function sanitizeDownloadConfigName(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60);
}

async function getDownloadConfigRows() {
  return dbAllAsync(
    `SELECT id, name, file_id, file_name, file_size, uploaded_by, created_at
     FROM download_configs
     ORDER BY id DESC`
  );
}

async function sendDownloadConfigMenu(ctx) {
  const rows = await getDownloadConfigRows();
  if (!rows.length) {
    return ctx.reply('Belum ada config yang tersedia. Silakan cek lagi nanti.', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Kembali', callback_data: 'send_main_menu' }]]
      }
    });
  }

  const keyboard = rows.map((row) => ([{
    text: row.name || row.file_name || `Config ${row.id}`,
    callback_data: `download_config_${row.id}`
  }]));
  keyboard.push([{ text: 'Kembali', callback_data: 'send_main_menu' }]);

  return ctx.reply('Pilih config yang ingin didownload:', {
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendAdminDownloadConfigMenu(ctx) {
  const rows = await getDownloadConfigRows();
  const lines = rows.length
    ? rows.map((row, idx) => `${idx + 1}. ${escapeHtml(row.name || row.file_name || `Config ${row.id}`)}`).join('\n')
    : 'Belum ada config yang diupload.';

  const keyboard = [
    [{ text: 'Upload Config Baru', callback_data: 'admin_config_upload' }]
  ];

  rows.slice(0, 20).forEach((row) => {
    keyboard.push([
      { text: `Hapus: ${row.name || row.file_name || `Config ${row.id}`}`.slice(0, 60), callback_data: `admin_config_delete_${row.id}` }
    ]);
  });

  keyboard.push([{ text: 'Kembali', callback_data: 'admin_menu_tools' }]);

  const payload = {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  };

  const text =
    '<b>DOWNLOAD CONFIG</b>\n\n' +
    lines + '\n\n' +
    'Upload file config sebagai document, lalu beri nama config.';

  if (ctx.updateType === 'callback_query') {
    return ctx.editMessageText(text, payload).catch(() => ctx.reply(text, payload));
  }

  return ctx.reply(text, payload);
}

async function reserveAccountChargeAtomic(userId, amount, type, action = 'other') {
  const referenceId = `account-${action}-${type}-${userId}-${Date.now()}`;

  try {
    await dbRunAsync('BEGIN IMMEDIATE TRANSACTION');

    const updateResult = await dbRunAsync(
      'UPDATE users SET saldo = saldo - ? WHERE user_id = ? AND saldo >= ?',
      [amount, userId, amount]
    );

    if (!updateResult || Number(updateResult.changes || 0) === 0) {
      throw new Error('SALDO_NOT_ENOUGH_OR_USER_NOT_FOUND');
    }

    await dbRunAsync(
      'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, 'account_pending', referenceId, Date.now()]
    );

    await dbRunAsync('COMMIT');
    return { ok: true, referenceId };
  } catch (error) {
    try {
      await dbRunAsync('ROLLBACK');
    } catch (_) {}
    return { ok: false, error: error?.message || 'UNKNOWN' };
  }
}

async function finalizeReservedAccountCharge(referenceId, finalType) {
  try {
    const result = await dbRunAsync(
      'UPDATE transactions SET type = ? WHERE reference_id = ? AND type = ?',
      [finalType, referenceId, 'account_pending']
    );
    if (!result || Number(result.changes || 0) === 0) {
      throw new Error('PENDING_TRANSACTION_NOT_FOUND');
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'UNKNOWN' };
  }
}

async function cancelReservedAccountCharge(userId, amount, referenceId) {
  try {
    await dbRunAsync('BEGIN IMMEDIATE TRANSACTION');
    await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, userId]);
    await dbRunAsync(
      'UPDATE transactions SET type = ? WHERE reference_id = ? AND type = ?',
      ['account_canceled', referenceId, 'account_pending']
    );
    await dbRunAsync('COMMIT');
    return { ok: true };
  } catch (error) {
    try {
      await dbRunAsync('ROLLBACK');
    } catch (_) {}
    return { ok: false, error: error?.message || 'UNKNOWN' };
  }
}

function normalizeSyncHost(rawHost) {
  const value = String(rawHost || '').trim();
  if (!value) return '';
  const cleaned = value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return cleaned.split('/')[0].trim();
}

function normalizeSyncEndpoint(rawEndpoint) {
  const value = String(rawEndpoint || '').trim();
  if (!value) return '/internal/account-summary';
  return value.startsWith('/') ? value : `/${value}`;
}

function buildTunnelSyncCandidateUrls(host, port, endpoint) {
  const safeHost = String(host || '').trim();
  const safeEndpoint = normalizeSyncEndpoint(endpoint);
  const safePort = Number(port);
  const hasPort = Number.isFinite(safePort) && safePort > 0;

  const urls = [];
  if (hasPort) {
    urls.push(`http://${safeHost}:${safePort}${safeEndpoint}`);
    urls.push(`https://${safeHost}:${safePort}${safeEndpoint}`);
  }
  urls.push(`http://${safeHost}${safeEndpoint}`);
  urls.push(`https://${safeHost}${safeEndpoint}`);
  return [...new Set(urls)];
}

async function requestTunnelSync(server, endpoint, requestConfig = {}, method = 'get', body = null) {
  const req = buildTunnelSyncRequest(server, endpoint);
  const candidateUrls = buildTunnelSyncCandidateUrls(req.host, req.port, req.endpoint);
  const headers = {
    'x-sync-token': req.token,
    ...(requestConfig.headers || {})
  };

  let lastError = null;
  for (const url of candidateUrls) {
    try {
      if (method === 'post') {
        return await axios.post(url, body, { ...requestConfig, headers });
      }
      return await axios.get(url, { ...requestConfig, headers });
    } catch (error) {
      lastError = error;
      if (error?.response) break;
    }
  }

  throw lastError || new Error('request gagal');
}

async function fetchTunnelAccountSummary(server) {
  const req = buildTunnelSyncRequest(server);

  let response;
  try {
    response = await requestTunnelSync(
      server,
      req.endpoint,
      { timeout: 15000 },
      'get'
    );
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`API summary gagal: ${error.response.data.message}`);
    }
    throw new Error(error.message || 'request gagal');
  }

  const data = response?.data || {};
  if (!data.ok) {
    throw new Error(`API summary gagal: ${data.message || 'unknown error'}`);
  }

  const ssh = Number(data.ssh || 0);
  const vmess = Number(data.vmess || 0);
  const vless = Number(data.vless || 0);
  const trojan = Number(data.trojan || 0);
  const total = Number(data.total || (ssh + vmess + vless + trojan));

  // Prioritas: hitung akun aktif non-trial dari export-accounts
  // agar /syncservernow tidak memasukkan akun trial ke total akun aktif berbayar.
  const normalizeStatus = (raw) => String(raw || '').trim().toUpperCase();
  const isTrialUsername = (raw) => /^trial/i.test(String(raw || '').trim());
  const countPaidActive = (accounts) => {
    if (!Array.isArray(accounts)) return 0;
    return accounts.filter((acc) => {
      const username = String(acc?.username || '').trim();
      if (!username || isTrialUsername(username)) return false;
      const status = normalizeStatus(acc?.status);
      if (!status) return true; // beberapa endpoint export tidak kirim status
      return status === 'AKTIF' || status === 'ACTIVE';
    }).length;
  };

  try {
    const [sshExport, vmessExport, vlessExport, trojanExport] = await Promise.all([
      fetchTunnelExportAccounts(server, 'ssh', 50000),
      fetchTunnelExportAccounts(server, 'vmess', 50000),
      fetchTunnelExportAccounts(server, 'vless', 50000),
      fetchTunnelExportAccounts(server, 'trojan', 50000)
    ]);

    const paidSsh = countPaidActive(sshExport.accounts);
    const paidVmess = countPaidActive(vmessExport.accounts);
    const paidVless = countPaidActive(vlessExport.accounts);
    const paidTrojan = countPaidActive(trojanExport.accounts);
    const paidTotal = paidSsh + paidVmess + paidVless + paidTrojan;

    return {
      ssh: paidSsh,
      vmess: paidVmess,
      vless: paidVless,
      trojan: paidTrojan,
      total: paidTotal
    };
  } catch (exportErr) {
    logger.warn(`[SyncServer] fallback summary count (export-accounts gagal): ${exportErr.message}`);
    return { ssh, vmess, vless, trojan, total };
  }
}
function buildTunnelSyncRequest(server, endpointOverride = null) {
  const host = normalizeSyncHost(server.sync_host || server.domain);
  if (!host) throw new Error('domain/sync_host server belum diisi');

  const token = String(server.auth || '').trim();
  if (!token) throw new Error('auth token server kosong');

  const port = Number(server.sync_port) || 8789;
  const summaryEndpoint = normalizeSyncEndpoint(server.sync_endpoint);
  const endpoint = endpointOverride
    ? normalizeSyncEndpoint(endpointOverride)
    : summaryEndpoint;

  return {
    host,
    token,
    port,
    summaryEndpoint,
    endpoint,
    url: `http://${host}:${port}${endpoint}`
  };
}

function parseDateExpToTimestamp(dateExp) {
  const value = String(dateExp || '').trim();
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d, 23, 59, 59, 999).getTime();
}

function calcRemainingDaysFromDateExp(dateExp) {
  const value = String(dateExp || '').trim();
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expDay = new Date(y, mo, d);
  const msPerDay = 24 * 60 * 60 * 1000;

  const diffDays = Math.floor((expDay.getTime() - todayStart.getTime()) / msPerDay);
  return Math.max(0, diffDays);
}

async function fetchOwnedAccountsByTelegramFromServer(server, telegramUserId) {
  try {
    const userId = String(telegramUserId || '').trim();
    if (!userId) return [];

    const host = String(server?.sync_host || server?.domain || '').trim();
    const authToken = String(server?.auth || '').trim();
    if (!host || !authToken) return [];

    const response = await axios.get(`http://${host}/vps/my-accounts`, {
      timeout: 15000,
      headers: {
        Authorization: authToken,
        'x-telegram-user-id': userId
      },
      params: {
        telegram_user_id: userId,
        include_inactive: '1'
      }
    });

    const data = response?.data || {};
    const accounts = Array.isArray(data?.data?.accounts)
      ? data.data.accounts
      : Array.isArray(data?.accounts)
        ? data.accounts
        : [];

    const serverId = Number(server?.id || 0);
    const serverName = String(server?.nama_server || server?.domain || ('ID ' + serverId)).trim();
    const serverDomain = String(server?.domain || '').trim();

    return accounts.map((item) => {
      const type = String(item?.type || 'ssh').trim().toLowerCase() || 'ssh';
      const username = String(item?.username || '').trim();
      const dateExp = String(item?.date_exp || '').trim();
      const expiresAt = Number(item?.expires_at || 0) || parseDateExpToTimestamp(dateExp);
      return {
        id: null,
        type,
        username,
        password: String(item?.password || '').trim(),
        server_id: serverId,
        server_name: serverName,
        domain: String(item?.domain || serverDomain).trim(),
        date_exp: dateExp,
        expires_at: expiresAt || null,
        quota: Number(item?.quota || 0),
        limitip: Number(item?.limitip || 0),
        status: String(item?.status || '').trim().toUpperCase()
      };
    }).filter((item) => item.username);
  } catch (e) {
    logger.warn(`Gagal fetch owned accounts dari server ${server?.id || '-'}: ${e.message}`);
    return [];
  }
}

async function fetchTunnelAccountExpiryByUsername(server, username) {
  try {
    const req = buildTunnelSyncRequest(server);
    const expiryEndpoint = req.summaryEndpoint.endsWith('/account-summary')
      ? req.summaryEndpoint.replace(/account-summary$/, 'account-expiry')
      : '/internal/account-expiry';

    const response = await requestTunnelSync(
      server,
      expiryEndpoint,
      { timeout: 15000, params: { username } },
      'get'
    );

    const data = response?.data || {};
    if (!data.ok || !data.found) {
      return { found: false };
    }

    return {
      found: true,
      service: String(data.service || '').toLowerCase(),
      dateExp: String(data.date_exp || '').trim(),
      expiresAt: parseDateExpToTimestamp(data.date_exp)
    };
  } catch (error) {
    const msg = error?.response?.data?.message || error.message || 'request gagal';
    logger.warn(`fetchTunnelAccountExpiryByUsername gagal: ${msg}`);
    return { found: false };
  }
}

function formatDateYmdLocal(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function fetchTunnelExpirySummaryByDate(server, dateYmd) {
  const req = buildTunnelSyncRequest(server);
  const expirySummaryEndpoint = req.summaryEndpoint.endsWith('/account-summary')
    ? req.summaryEndpoint.replace(/account-summary$/, 'expiry-summary')
    : '/internal/expiry-summary';

  let response;
  try {
    response = await requestTunnelSync(
      server,
      expirySummaryEndpoint,
      { timeout: 15000, params: { date: dateYmd } },
      'get'
    );
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`API expiry-summary gagal: ${error.response.data.message}`);
    }
    throw new Error(error.message || 'request gagal');
  }

  const data = response?.data || {};
  if (!data.ok) {
    throw new Error(`API expiry-summary gagal: ${data.message || 'unknown error'}`);
  }

  const ssh = Number(data.ssh || 0);
  const vmess = Number(data.vmess || 0);
  const vless = Number(data.vless || 0);
  const trojan = Number(data.trojan || 0);
  const totalExpired = Number(
    data.total_expired ??
    data.total ??
    data.expired_total ??
    (ssh + vmess + vless + trojan)
  );

  return { date: dateYmd, ssh, vmess, vless, trojan, totalExpired };
}

async function fetchTunnelVnstatDailySummary(server) {
  const req = buildTunnelSyncRequest(server);
  const vnstatEndpoint = req.summaryEndpoint.endsWith('/account-summary')
    ? req.summaryEndpoint.replace(/account-summary$/, 'vnstat-daily')
    : '/internal/vnstat-daily';

  let response;
  try {
    response = await requestTunnelSync(
      server,
      vnstatEndpoint,
      { timeout: 20000 },
      'get'
    );
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`API vnstat-daily gagal: ${error.response.data.message}`);
    }
    throw new Error(error.message || 'request gagal');
  }

  const data = response?.data || {};
  if (!data.ok) {
    throw new Error(`API vnstat-daily gagal: ${data.message || 'unknown error'}`);
  }

  const totalGb = Number(data.total_gb || data.totalGb || 0);
  const monthTotalTb = Number(
    data.month_total_tb ??
    data.monthTotalTb ??
    (Number(data.month_total_gb || 0) / 1024)
  );

  return {
    date: String(data.date || '').trim(),
    totalGb: Number.isFinite(totalGb) ? totalGb : 0,
    monthTotalTb: Number.isFinite(monthTotalTb) ? monthTotalTb : 0
  };
}

function normalizeMigrationType(rawType) {
  const value = String(rawType || '').trim().toLowerCase();
  if (value === 'udp' || value === 'udp_http' || value === 'zivpn') return 'zivpn';
  if (value === 'ssh' || value === 'vmess' || value === 'vless' || value === 'trojan') return value;
  return '';
}

function isSupportedMigrationType(type) {
  const t = normalizeMigrationType(type);
  return t === 'ssh' || t === 'zivpn';
}

async function fetchTunnelExportAccounts(server, accountType, limit) {
  const req = buildTunnelSyncRequest(server);
  const exportEndpoint = req.summaryEndpoint.endsWith('/account-summary')
    ? req.summaryEndpoint.replace(/account-summary$/, 'export-accounts')
    : '/internal/export-accounts';

  let response;
  try {
    response = await requestTunnelSync(
      server,
      exportEndpoint,
      { timeout: 30000, params: { type: accountType, limit } },
      'get'
    );
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`API export-accounts gagal: ${error.response.data.message}`);
    }
    throw new Error(error.message || 'request gagal');
  }

  const data = response?.data || {};
  if (!data.ok) {
    throw new Error(`API export-accounts gagal: ${data.message || 'unknown error'}`);
  }

  return {
    type: String(data.type || accountType).toLowerCase(),
    exported: Number(data.exported || 0),
    accounts: Array.isArray(data.accounts) ? data.accounts : []
  };
}

async function importTunnelAccounts(server, accountType, accounts) {
  const req = buildTunnelSyncRequest(server);
  const importEndpoint = req.summaryEndpoint.endsWith('/account-summary')
    ? req.summaryEndpoint.replace(/account-summary$/, 'import-accounts')
    : '/internal/import-accounts';

  let response;
  try {
    response = await requestTunnelSync(
      server,
      importEndpoint,
      { timeout: 60000 },
      'post',
      { type: accountType, accounts }
    );
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`API import-accounts gagal: ${error.response.data.message}`);
    }
    throw new Error(error.message || 'request gagal');
  }

  const data = response?.data || {};
  if (!data.ok) {
    throw new Error(`API import-accounts gagal: ${data.message || 'unknown error'}`);
  }

  return {
    imported: Number(data.imported || 0),
    skipped: Number(data.skipped || 0),
    usernames: Array.isArray(data.usernames) ? data.usernames : [],
    type: String(data.type || accountType).toLowerCase()
  };
}

async function deleteTunnelAccounts(server, accountType, usernames) {
  const req = buildTunnelSyncRequest(server);
  const deleteEndpoint = req.summaryEndpoint.endsWith('/account-summary')
    ? req.summaryEndpoint.replace(/account-summary$/, 'delete-accounts')
    : '/internal/delete-accounts';

  let response;
  try {
    response = await requestTunnelSync(
      server,
      deleteEndpoint,
      { timeout: 45000 },
      'post',
      { type: accountType, usernames }
    );
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`API delete-accounts gagal: ${error.response.data.message}`);
    }
    throw new Error(error.message || 'request gagal');
  }

  const data = response?.data || {};
  if (!data.ok) {
    throw new Error(`API delete-accounts gagal: ${data.message || 'unknown error'}`);
  }

  return {
    deleted: Number(data.deleted || 0),
    type: String(data.type || accountType).toLowerCase()
  };
}

async function deleteAllTunnelAccounts(server, accountType) {
  const req = buildTunnelSyncRequest(server);
  const endpoint = req.summaryEndpoint.endsWith('/account-summary')
    ? req.summaryEndpoint.replace(/account-summary$/, 'delete-all-accounts')
    : '/internal/delete-all-accounts';

  let response;
  try {
    response = await requestTunnelSync(
      server,
      endpoint,
      { timeout: 60000 },
      'post',
      { type: accountType }
    );
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(`API delete-all-accounts gagal: ${error.response.data.message}`);
    }
    throw new Error(error.message || 'request gagal');
  }

  const data = response?.data || {};
  if (!data.ok) {
    throw new Error(`API delete-all-accounts gagal: ${data.message || 'unknown error'}`);
  }

  return {
    type: String(data.type || accountType).toLowerCase(),
    deletedDb: Number(data.deleted_db || data.deleted || 0),
    deletedZivpn: Number(data.deleted_zivpn || 0)
  };
}

async function migrateTunnelAccountsBetweenServers(sourceServer, targetServer, type, limit) {
  const normalizedType = normalizeMigrationType(type);
  if (!normalizedType) {
    throw new Error('Jenis akun migrasi tidak valid.');
  }

  const maxLimit = Math.max(1, Math.min(500, Number(limit || 0)));
  const exported = await fetchTunnelExportAccounts(sourceServer, normalizedType, maxLimit);
  if (!exported.accounts.length) {
    return { type: normalizedType, requested: maxLimit, exported: 0, imported: 0, skipped: 0, deleted: 0 };
  }

  const imported = await importTunnelAccounts(targetServer, normalizedType, exported.accounts);
  const usernamesToDelete = Array.isArray(imported.usernames) ? imported.usernames : [];
  const importedSet = new Set(usernamesToDelete.map((u) => String(u || '').toLowerCase()));
  const migratedAccounts = exported.accounts
    .filter((acc) => importedSet.has(String(acc?.username || '').toLowerCase()))
    .map((acc) => ({
      username: String(acc?.username || '').trim(),
      password: String(acc?.password || '').trim(),
      dateExp: String(acc?.date_exp || '').trim(),
      days: Number(acc?.days || 0)
    }));
  let deleted = 0;
  if (usernamesToDelete.length > 0) {
    const deletedResult = await deleteTunnelAccounts(sourceServer, normalizedType, usernamesToDelete);
    deleted = deletedResult.deleted;
  }
  return {
    type: normalizedType,
    requested: maxLimit,
    exported: exported.accounts.length,
    imported: imported.imported,
    skipped: imported.skipped,
    deleted,
    migratedAccounts
  };
}

function getDaysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getRemainingDaysInCurrentMonthInclusive() {
  const now = new Date();
  const daysInMonth = getDaysInCurrentMonth();
  return Math.max(1, daysInMonth - now.getDate() + 1);
}

function getElapsedDaysInCurrentMonth() {
  return Math.max(1, new Date().getDate());
}

const BANDWIDTH_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function calculateServerEffectiveCapacity(input) {
  const usedAccounts = Math.max(0, Number(input.usedAccounts || 0));
  const manualLimitRaw = Number(input.manualLimit || 0);
  const bandwidthLimitTb = Number(input.bandwidthLimitTb || 0);
  const rawDailyBandwidthGb = Math.max(0, Number(input.dailyBandwidthGb || 0));
  const fallbackPerUserDailyGb = Math.max(0, Number(input.fallbackPerUserDailyGb || 8));
  const monthUsedTb = Math.max(0, Number(input.monthUsedTb || 0));
  const projectionDays = Math.max(1, Number(input.projectionDays || 30));
  const elapsedDays = Math.max(1, Number(input.elapsedDaysInMonth || getElapsedDaysInCurrentMonth()));
  const monthUsedGb = monthUsedTb * 1024;
  const avgDailyFromMonthGb = monthUsedGb > 0 ? (monthUsedGb / elapsedDays) : 0;
  // Pakai nilai harian yang lebih aman agar tidak under-estimate ketika data daily stale/rendah.
  const effectiveDailyBandwidthGb = Math.max(rawDailyBandwidthGb, avgDailyFromMonthGb);

  const hasManualLimit = Number.isFinite(manualLimitRaw) && manualLimitRaw > 0;
  const manualLimit = hasManualLimit ? Math.floor(manualLimitRaw) : 0;

  const hasBandwidthLimit = Number.isFinite(bandwidthLimitTb) && bandwidthLimitTb > 0;
  if (!hasBandwidthLimit) {
    const projectedMonthlyTbFromToday = (effectiveDailyBandwidthGb * projectionDays) / 1024;
    return {
      hasBandwidthLimit: false,
      effectiveLimit: hasManualLimit ? manualLimit : 0,
      remainingSlots: hasManualLimit ? Math.max(0, manualLimit - usedAccounts) : null,
      isFull: hasManualLimit ? usedAccounts >= manualLimit : false,
      estimatedCapacityByBandwidth: 0,
      safeUsersFromTodayProjection: 0,
      safeUsersForRemainingMonth: 0,
      projectedMonthlyTbFromToday,
      monthlyRemainingTb: null,
      estimatedPerUserDailyGb: 0,
      effectiveDailyBandwidthGb
    };
  }

  const perUserDailyGbFromEffectiveUsage = usedAccounts > 0 && effectiveDailyBandwidthGb > 0
    ? (effectiveDailyBandwidthGb / usedAccounts)
    : 0;
  const estimatedPerUserDailyGb = perUserDailyGbFromEffectiveUsage > 0
    ? perUserDailyGbFromEffectiveUsage
    : (fallbackPerUserDailyGb > 0 ? fallbackPerUserDailyGb : 8);
  const daysInMonth = projectionDays;
  const remainingDaysInMonth = getRemainingDaysInCurrentMonthInclusive();

  let safeUsersFromTodayProjection = 0;
  if (estimatedPerUserDailyGb > 0) {
    safeUsersFromTodayProjection = Math.floor((bandwidthLimitTb * 1024) / (estimatedPerUserDailyGb * daysInMonth));
  }
  safeUsersFromTodayProjection = Math.max(0, safeUsersFromTodayProjection);

  const monthlyRemainingTb = Math.max(0, bandwidthLimitTb - monthUsedTb);
  let safeUsersForRemainingMonth = safeUsersFromTodayProjection;
  if (estimatedPerUserDailyGb > 0) {
    safeUsersForRemainingMonth = Math.floor((monthlyRemainingTb * 1024) / (estimatedPerUserDailyGb * remainingDaysInMonth));
  }
  safeUsersForRemainingMonth = Math.max(0, safeUsersForRemainingMonth);

  const estimatedCapacityByBandwidth = Math.max(0, Math.min(safeUsersFromTodayProjection, safeUsersForRemainingMonth));
  const projectedMonthlyTbFromToday = (effectiveDailyBandwidthGb * projectionDays) / 1024;

  const effectiveLimit = hasManualLimit
    ? Math.min(manualLimit, estimatedCapacityByBandwidth)
    : estimatedCapacityByBandwidth;

  return {
    hasBandwidthLimit: true,
    effectiveLimit,
    remainingSlots: Math.max(0, effectiveLimit - usedAccounts),
    isFull: usedAccounts >= effectiveLimit,
    estimatedCapacityByBandwidth,
    safeUsersFromTodayProjection,
    safeUsersForRemainingMonth,
    projectedMonthlyTbFromToday,
    monthlyRemainingTb,
    estimatedPerUserDailyGb,
    effectiveDailyBandwidthGb
  };
}

async function sendBandwidthRiskAlert(payload) {
  const lines = [
    'PERINGATAN BANDWIDTH SERVER',
    '',
    `Server: ${payload.serverName}`,
    `Host: ${payload.host}`,
    `User aktif saat ini: ${payload.usedAccounts}`,
    `Traffic hari ini: ${payload.dailyGb.toFixed(2)} GB`,
    `Rata-rata/user/hari: ${payload.avgPerUserGb.toFixed(3)} GB`,
    `Proyeksi 30 hari: ${payload.projectedMonthlyTb.toFixed(2)} TB`,
    `Limit BW bulanan: ${payload.limitTb.toFixed(2)} TB`,
    `Batas aman user (estimasi): ${payload.safeUsers} user`
  ];
  const message = lines.join('\n');

  const targets = new Set();
  if (Number(BW_NOTIF_GROUP_ID_NUM)) targets.add(Number(BW_NOTIF_GROUP_ID_NUM));
  if (targets.size === 0) {
    logger.warn('Notif peringatan bandwidth dilewati: group id notif bandwidth belum diset.');
    return;
  }

  for (const chatId of targets) {
    try {
      await bot.telegram.sendMessage(chatId, message);
    } catch (err) {
      logger.warn(`Gagal kirim notif bandwidth ke ${chatId}: ${err.message}`);
    }
  }
}

async function sendBandwidthReportToGroup(chatId) {
  const targetChatId = Number(chatId);
  if (!Number.isFinite(targetChatId)) return;

  const allRows = await dbAllAsync(
    'SELECT id, nama_server, domain, sync_host, total_create_akun, batas_create_akun, bandwidth_limit_tb, bandwidth_daily_gb, bandwidth_monthly_used_tb, bandwidth_user_daily_gb FROM Server ORDER BY nama_server COLLATE NOCASE ASC'
  );
  if (!allRows || allRows.length === 0) {
    await bot.telegram.sendMessage(targetChatId, 'Laporan bandwidth: belum ada server.');
    return;
  }

  const rows = allRows.filter((srv) => Number(srv.bandwidth_limit_tb || 0) > 0);
  if (rows.length === 0) {
    await bot.telegram.sendMessage(targetChatId, 'Laporan bandwidth: belum ada server yang di-set limit bandwidth.');
    return;
  }

  const header = [
    'LAPORAN BANDWIDTH SERVER (3 JAM)',
    `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
    ''
  ];
  const lines = [...header];

  rows.forEach((srv, idx) => {
    const capacity = calculateServerEffectiveCapacity({
      usedAccounts: srv.total_create_akun,
      manualLimit: srv.batas_create_akun,
      bandwidthLimitTb: srv.bandwidth_limit_tb,
      dailyBandwidthGb: srv.bandwidth_daily_gb,
      fallbackPerUserDailyGb: srv.bandwidth_user_daily_gb,
      monthUsedTb: srv.bandwidth_monthly_used_tb
    });
    const bwLimitTb = Number(srv.bandwidth_limit_tb || 0);
    const riskOver = capacity.hasBandwidthLimit && capacity.projectedMonthlyTbFromToday > bwLimitTb ? 'YA' : 'TIDAK';
    const host = normalizeSyncHost(srv.sync_host || srv.domain) || '-';
    const manualLimit = Number(srv.batas_create_akun || 0);
    const manualLimitText = manualLimit > 0 ? String(manualLimit) : 'Unlimited';

    lines.push(`${idx + 1}. ${srv.nama_server || '-'}`);
    lines.push(`- Host: ${host}`);
    lines.push(`- Akun Terpakai: ${Number(srv.total_create_akun || 0)}/${manualLimitText}`);
    lines.push(`- Bandwidth Hari Ini (raw): ${Number(srv.bandwidth_daily_gb || 0).toFixed(2)} GB`);
    lines.push(`- Bandwidth Hari Ini (efektif): ${Number(capacity.effectiveDailyBandwidthGb || 0).toFixed(2)} GB`);
    lines.push(`- Bandwidth Bulan Ini: ${Number(srv.bandwidth_monthly_used_tb || 0).toFixed(2)}/${bwLimitTb > 0 ? bwLimitTb.toFixed(2) : '-'} TB`);
    lines.push(`- Proyeksi 30 Hari: ${capacity.projectedMonthlyTbFromToday.toFixed(2)} TB`);
    lines.push(`- Batas Aman User (BW): ${capacity.hasBandwidthLimit ? capacity.estimatedCapacityByBandwidth : '-'}`);
    lines.push(`- Risiko Over BW: ${riskOver}`);
    lines.push('');
  });

  let buffer = '';
  for (const line of lines) {
    const candidate = buffer ? `${buffer}\n${line}` : line;
    if (candidate.length > 3500) {
      await bot.telegram.sendMessage(targetChatId, buffer);
      buffer = line;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) await bot.telegram.sendMessage(targetChatId, buffer);
}

function formatBandwidthReportInterval(minutes) {
  const m = Math.max(1, Math.floor(Number(minutes) || 0));
  if (m % 60 === 0) {
    const h = m / 60;
    return `${h} jam`;
  }
  return `${m} menit`;
}

function parseBandwidthIntervalInput(raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  const jamMatch = text.match(/^(\d+)\s*(jam|j)$/);
  if (jamMatch) return Number(jamMatch[1]) * 60;

  const menitMatch = text.match(/^(\d+)\s*(menit|m)$/);
  if (menitMatch) return Number(menitMatch[1]);

  return null;
}

async function syncServerUsageFromTunnel(trigger = 'manual', options = {}) {
  const targetServerId = options.serverId ? Number(options.serverId) : null;
  const force = options.force === true;
  const whereParts = ['1=1'];
  const params = [];

  if (Number.isFinite(targetServerId)) {
    whereParts.push('id = ?');
    params.push(targetServerId);
  }

  const servers = await dbAllAsync(
    `SELECT id, nama_server, domain, auth, batas_create_akun, total_create_akun,
            sync_host, sync_port, sync_endpoint, sync_enabled,
            bandwidth_limit_tb, bandwidth_user_daily_gb,
            bandwidth_daily_gb, bandwidth_monthly_used_tb,
            bandwidth_alert_last_notified_at
     FROM Server
     WHERE ${whereParts.join(' AND ')}`,
    params
  );

  const result = {
    checked: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    totals: { used: 0, remaining: 0, capacity: 0, unlimitedServers: 0, syncedServers: 0 }
  };

  const makeGroupKey = (server) => normalizeSyncHost(server.sync_host || server.domain) || (`id-${server.id}`);

  const groups = new Map();
  const skippedGroupKeys = new Set();

  for (const server of servers) {
    if (!force && !Number.isFinite(targetServerId) && Number(server.sync_enabled) === 0) {
      skippedGroupKeys.add(makeGroupKey(server));
      continue;
    }

    const key = makeGroupKey(server);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(server);
  }

  result.skipped = skippedGroupKeys.size;

  for (const groupServers of groups.values()) {
    const primary = groupServers[0];
    result.checked += 1;

    const syncAuth = String(groupServers.find((s) => String(s.auth || '').trim())?.auth || '').trim();
    const syncPort = Number(groupServers.find((s) => Number(s.sync_port) > 0)?.sync_port || primary.sync_port) || 8789;
    const syncEndpoint = normalizeSyncEndpoint(groupServers.find((s) => String(s.sync_endpoint || '').trim())?.sync_endpoint || primary.sync_endpoint);
    const summaryRequestServer = { ...primary, auth: syncAuth || primary.auth, sync_port: syncPort, sync_endpoint: syncEndpoint };

    try {
      const counts = await fetchTunnelAccountSummary(summaryRequestServer);
      let vnstatSummary = null;
      try {
        vnstatSummary = await fetchTunnelVnstatDailySummary(summaryRequestServer);
      } catch (vnErr) {
        logger.warn(`[SyncServer:${trigger}] vnstat skip ${primary.nama_server}: ${vnErr.message}`);
      }

      for (const server of groupServers) {
        const dailyBandwidthGb = vnstatSummary ? Number(vnstatSummary.totalGb || 0) : Number(server.bandwidth_daily_gb || 0);
        const monthUsedTb = vnstatSummary ? Number(vnstatSummary.monthTotalTb || 0) : Number(server.bandwidth_monthly_used_tb || 0);
        const capacity = calculateServerEffectiveCapacity({
          usedAccounts: counts.total,
          manualLimit: server.batas_create_akun,
          bandwidthLimitTb: server.bandwidth_limit_tb,
          dailyBandwidthGb,
          fallbackPerUserDailyGb: server.bandwidth_user_daily_gb,
          monthUsedTb
        });

        await dbRunAsync(
          'UPDATE Server SET total_create_akun = ?, bandwidth_daily_gb = ?, bandwidth_monthly_used_tb = ?, bandwidth_remaining_tb = ?, bandwidth_estimated_capacity = ?, bandwidth_last_sync_at = ? WHERE id = ?',
          [
            counts.total,
            dailyBandwidthGb,
            monthUsedTb,
            capacity.monthlyRemainingTb === null ? 0 : capacity.monthlyRemainingTb,
            capacity.estimatedCapacityByBandwidth,
            Date.now(),
            server.id
          ]
        );
      }

      const groupManualLimit = groupServers
        .map((s) => Number(s.batas_create_akun || 0))
        .filter((v) => Number.isFinite(v) && v > 0)
        .reduce((max, cur) => Math.max(max, cur), 0);
      const groupBandwidthLimitTb = groupServers
        .map((s) => Number(s.bandwidth_limit_tb || 0))
        .filter((v) => Number.isFinite(v) && v > 0)
        .reduce((max, cur) => Math.max(max, cur), 0);
      const groupFallbackDailyGb = groupServers
        .map((s) => Number(s.bandwidth_user_daily_gb || 0))
        .filter((v) => Number.isFinite(v) && v > 0)
        .reduce((max, cur) => Math.max(max, cur), 0);
      const groupDailyGb = vnstatSummary ? Number(vnstatSummary.totalGb || 0) : Number(primary.bandwidth_daily_gb || 0);
      const groupMonthTb = vnstatSummary ? Number(vnstatSummary.monthTotalTb || 0) : Number(primary.bandwidth_monthly_used_tb || 0);

      const capacity = calculateServerEffectiveCapacity({
        usedAccounts: counts.total,
        manualLimit: groupManualLimit,
        bandwidthLimitTb: groupBandwidthLimitTb,
        dailyBandwidthGb: groupDailyGb,
        fallbackPerUserDailyGb: groupFallbackDailyGb || 8,
        monthUsedTb: groupMonthTb
      });

      const latestAlertTs = groupServers
        .map((s) => Number(s.bandwidth_alert_last_notified_at || 0))
        .filter((v) => Number.isFinite(v) && v > 0)
        .reduce((max, cur) => Math.max(max, cur), 0);
      const nowTs = Date.now();
      const shouldAlertOverBandwidth =
        capacity.hasBandwidthLimit &&
        groupBandwidthLimitTb > 0 &&
        capacity.projectedMonthlyTbFromToday > groupBandwidthLimitTb;
      const cooldownPassed = latestAlertTs <= 0 || (nowTs - latestAlertTs) >= BANDWIDTH_ALERT_COOLDOWN_MS;

      if (shouldAlertOverBandwidth && cooldownPassed) {
        await sendBandwidthRiskAlert({
          serverName: primary.nama_server || '-',
          host: normalizeSyncHost(primary.sync_host || primary.domain) || '-',
          usedAccounts: counts.total,
          dailyGb: groupDailyGb,
          avgPerUserGb: capacity.estimatedPerUserDailyGb,
          projectedMonthlyTb: capacity.projectedMonthlyTbFromToday,
          limitTb: groupBandwidthLimitTb,
          safeUsers: capacity.estimatedCapacityByBandwidth
        });
        for (const server of groupServers) {
          await dbRunAsync(
            'UPDATE Server SET bandwidth_alert_last_notified_at = ? WHERE id = ?',
            [nowTs, server.id]
          );
        }
      }

      result.updated += 1;
      result.totals.used += counts.total;
      result.totals.syncedServers += 1;

      if (capacity.remainingSlots === null) {
        result.totals.unlimitedServers += 1;
      } else {
        result.totals.remaining += capacity.remainingSlots;
        result.totals.capacity += capacity.effectiveLimit;
      }

      logger.info(
        `[SyncServer:${trigger}] ${primary.nama_server} => akun ${counts.total}/${capacity.effectiveLimit || '-'}, bw ${groupMonthTb.toFixed(2)}/${groupBandwidthLimitTb || 0} TB (group ${groupServers.length} row)`
      );
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        serverId: primary.id,
        serverName: primary.nama_server,
        message: err.message
      });
      logger.error(`[SyncServer:${trigger}] Gagal sync ${primary.nama_server}: ${err.message}`);
    }
  }

  return result;
}

// Tambah di section command, setelah command 'admin'
bot.command('edithargareseller', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
    return ctx.reply('Format salah. Gunakan: /edithargareseller <domain> <harga>');
  }

  const [domain, hargaReseller] = args.slice(1);
  if (!/^\d+$/.test(hargaReseller)) {
    return ctx.reply('harga reseller harus berupa angka.');
  }

  db.run(
    'UPDATE Server SET harga_reseller = ? WHERE domain = ?',
    [parseInt(hargaReseller, 10), domain],
    function(err) {
      if (err) {
        logger.error('Error saat update harga reseller:', err.message);
        return ctx.reply('Terjadi kesalahan saat update harga reseller.');
      }
      if (this.changes === 0) {
        return ctx.reply('Server dengan domain tersebut tidak ditemukan.');
      }
      return ctx.reply(`Harga reseller untuk ${domain} berhasil diupdate ke Rp ${Number(hargaReseller).toLocaleString('id-ID')}`);
    }
  );
});

bot.command('checkpaymentconfig', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  await ctx.reply('Memeriksa konfigurasi payment gateway...');

  try {
    reloadRuntimePaymentConfig();
    const readiness = getPaymentGatewayReadiness();

    const currentVars = loadVars();
    let message = '<b>KONFIGURASI PAYMENT GATEWAY</b>\n\n';
    message += `Mode aktif: <code>${escapeHtmlLocal(formatGatewayModeLabel())}</code>\n\n`;

    message += '<b>OrderKuota</b>\n';
    message += `- Aktif: ${isGatewayEnabled('orderkuota') ? 'YA' : 'TIDAK'}\n`;
    message += `- Siap dipakai: ${readiness.orderkuota.ready ? 'YA' : 'TIDAK'}\n`;
    if (!readiness.orderkuota.ready) {
      message += `- Kurang: <code>${escapeHtmlLocal(readiness.orderkuota.missing.join(', '))}</code>\n`;
    }
    message += `- Gateway URL: <code>${escapeHtmlLocal(PAYMENT_GATEWAY_BASE_URL)}</code>\n`;
    message += `- RajaServer API Key: <code>${escapeHtmlLocal(maskSecret(RAJASERVER_API_KEY))}</code>\n`;
    message += `- DATA_QRIS: <code>${DATA_QRIS ? 'Tersimpan' : 'Belum diisi'}</code>\n`;
    message += `- ORKUT Username: <code>${escapeHtmlLocal(currentVars.ORKUT_USERNAME || 'Belum diisi')}</code>\n`;
    message += `- ORKUT Token: <code>${escapeHtmlLocal(maskSecret(currentVars.ORKUT_TOKEN))}</code>\n`;
    message += `- Expired QRIS: <code>${ORDERKUOTA_QR_EXPIRE_MINUTES} menit</code>\n`;
    message += `- Minimal TopUp: <code>Rp ${Math.round(getMinTopupByProvider('orderkuota')).toLocaleString('id-ID')}</code>\n`;
    message += `- Interval polling cek: <code>${ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS} detik</code>\n`;
    message += `- Cooldown tombol cek: <code>${ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS} detik</code>\n`;
    message += `- Maksimal tekan tombol: <code>${ORDERKUOTA_CHECK_MAX_TAPS}x per transaksi</code>\n`;
    message += `- Auto-stop polling: <code>${ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES} menit</code>\n\n`;

    message += '<b>GoPay</b>\n';
    message += `- Aktif: ${isGatewayEnabled('gopay') ? 'YA' : 'TIDAK'}\n`;
    message += `- Siap dipakai: ${readiness.gopay.ready ? 'YA' : 'TIDAK'}\n`;
    if (!readiness.gopay.ready) {
      message += `- Kurang: <code>${escapeHtmlLocal(readiness.gopay.missing.join(', '))}</code>\n`;
    }
    message += `- Base URL: <code>${escapeHtmlLocal(GOPAY_API_BASE_URL)}</code>\n`;
    message += `- API Key: <code>${escapeHtmlLocal(maskSecret(GOPAY_API_KEY))}</code>\n`;
    message += `- Expired QRIS: <code>${GOPAY_QR_EXPIRE_MINUTES} menit</code>\n`;
    message += `- Minimal TopUp: <code>Rp ${Math.round(getMinTopupByProvider('gopay')).toLocaleString('id-ID')}</code>\n`;

    if (isGatewayEnabled('gopay') && GOPAY_API_KEY) {
      try {
        const testRes = await axios.post(
          `${normalizeHttpUrl(GOPAY_API_BASE_URL) || 'https://api-gopay.sawargipay.cloud'}/transactions`,
          {},
          {
            headers: {
              Authorization: `Bearer ${GOPAY_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 8000
          }
        );
        const count = Number(testRes?.data?.data?.transactions?.length || 0);
        message += `- Test API: Berhasil (transaksi terbaca: ${count})\n`;
      } catch (err) {
        message += `- Test API: Gagal (${escapeHtmlLocal(String(err.message || 'unknown error'))})\n`;
      }
    }

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(`Gagal memeriksa konfigurasi: ${error.message}`);
  }
});

bot.command('syncservernow', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  try {
    await ctx.reply('Menjalankan sinkronisasi server...');
    const result = await syncServerUsageFromTunnel('manual_command', { force: true });

    const lines = [
      'Sync server selesai.',
      `Dicek: ${result.checked}`,
      `Berhasil: ${result.updated}`,
      `Gagal: ${result.failed}`,
      `Dilewati: ${result.skipped}`,
      '',
      `Total akun aktif: ${result.totals.used}`,
      `Total akun tersisa: ${result.totals.remaining}`,
      `Total kapasitas: ${result.totals.capacity}`
    ];

    if (result.errors.length > 0) {
      const preview = result.errors.slice(0, 5)
        .map((e) => `- ${e.serverName || e.serverId}: ${e.message}`)
        .join('\n');
      lines.push('', 'Detail gagal (maks 5):', preview);
    }

    await ctx.reply(lines.join('\n'));
  } catch (err) {
    logger.error('Gagal menjalankan sync server manual:', err.message);
    await ctx.reply('Gagal menjalankan sinkronisasi server.');
  }
});

bot.command('setserverbw', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  const args = ctx.message.text.trim().split(/\s+/);
  if (args.length < 3 || args.length > 4) {
    return ctx.reply(
      'Format salah.\n' +
      'Gunakan: /setserverbw <server_id> <limit_tb> [avg_gb_per_user_per_hari]\n' +
      'Contoh: /setserverbw 1 25 8'
    );
  }

  const serverId = Number(args[1]);
  const limitTb = Number(args[2]);
  const avgUserDailyGb = args[3] !== undefined ? Number(args[3]) : 8;

  if (!Number.isFinite(serverId) || serverId <= 0) {
    return ctx.reply('server_id harus angka yang valid.');
  }
  if (!Number.isFinite(limitTb) || limitTb < 0) {
    return ctx.reply('limit_tb harus angka >= 0. Pakai 0 untuk menonaktifkan limit bandwidth.');
  }
  if (!Number.isFinite(avgUserDailyGb) || avgUserDailyGb <= 0) {
    return ctx.reply('avg_gb_per_user_per_hari harus angka > 0.');
  }

  db.run(
    'UPDATE Server SET bandwidth_limit_tb = ?, bandwidth_user_daily_gb = ? WHERE id = ?',
    [limitTb, avgUserDailyGb, serverId],
    async function (err) {
      if (err) {
        logger.error('Gagal set limit bandwidth server:', err.message);
        return ctx.reply('Terjadi kesalahan saat menyimpan limit bandwidth server.');
      }
      if (this.changes === 0) {
        return ctx.reply('Server tidak ditemukan.');
      }

      try {
        await syncServerUsageFromTunnel('setserverbw', { serverId, force: true });
      } catch (syncErr) {
        logger.warn(`Sync setelah setserverbw gagal: ${syncErr.message}`);
      }

      return ctx.reply(
        `Limit bandwidth server #${serverId} berhasil diupdate.\n` +
        `- Limit bulanan: ${limitTb.toFixed(2)} TB\n` +
        `- Asumsi rata-rata: ${avgUserDailyGb.toFixed(2)} GB/user/hari`
      );
    }
  );
});
// =================== COMMAND HAPUS SALDO ===================
bot.command('hapussaldo', async (ctx) => {
  try {
    const adminId = ctx.from.id;
    
    // Hanya admin
    if (!adminIds.includes(adminId)) {
      return ctx.reply(' *Hanya admin yang bisa menggunakan command ini!*', { parse_mode: 'Markdown' });
    }
    
    const args = ctx.message.text.trim().split(/\s+/);
    if (args.length !== 3) {
      return ctx.reply(' *Format salah!*\n\nGunakan:\n`/hapussaldo <user_id> <jumlah>`\n\nContoh:\n`/hapussaldo 123456789 50000`', { parse_mode: 'Markdown' });
    }
    
    const targetUserId = args[1].trim();
    const amount = parseInt(args[2], 10);
    
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(' *Jumlah harus angka positif lebih dari 0!*', { parse_mode: 'Markdown' });
    }
    
    // Cek apakah user ada
    db.get('SELECT user_id, saldo FROM users WHERE user_id = ?', [targetUserId], (err, user) => {
      if (err) {
        logger.error(' Error cek user:', err.message);
        return ctx.reply(' Terjadi kesalahan saat memeriksa user.');
      }
      
      if (!user) {
        return ctx.reply(` *User dengan ID ${targetUserId} tidak ditemukan!*`, { parse_mode: 'Markdown' });
      }
      
      // Cek apakah saldo mencukupi
      if (user.saldo < amount) {
        return ctx.reply('❌ <b>Saldo Tidak Cukup</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n┃ 💳 <b>Saldo User</b>  : <code>Rp '+user.saldo.toLocaleString('id-ID')+'</code>\n┃ 💰 <b>Jumlah Hapus</b>: <code>Rp '+amount.toLocaleString('id-ID')+'</code>\n┃ 📉 <b>Kekurangan</b>  : <code>Rp '+(amount - user.saldo).toLocaleString('id-ID')+'</code>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>', { parse_mode: 'HTML' });
      }
      
      // Lakukan pengurangan saldo
      db.run('UPDATE users SET saldo = saldo - ? WHERE user_id = ?', [amount, targetUserId], function (err) {
        if (err) {
          logger.error(' Error hapus saldo:', err.message);
          return ctx.reply(' Gagal menghapus saldo.');
        }
        
        if (this.changes === 0) {
          return ctx.reply(' Tidak ada user yang diupdate. Pastikan ID benar.');
        }
        
        // Ambil saldo terbaru
        db.get('SELECT saldo FROM users WHERE user_id = ?', [targetUserId], (err2, updatedRow) => {
          if (err2) {
            ctx.reply(` Saldo sebesar *Rp ${amount.toLocaleString('id-ID')}* berhasil dihapus dari user \`${targetUserId}\`.`);
          } else {
            ctx.reply(
              '✅ <b>Saldo Berhasil Dihapus</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n┃ 💰 <b>Dihapus</b>    : <code>Rp '+amount.toLocaleString('id-ID')+'</code>\n┃ 👤 <b>User</b>       : <code>'+targetUserId+'</code>\n┃ 💳 <b>Saldo Kini</b>  : <code>Rp '+updatedRow.saldo.toLocaleString('id-ID')+'</code>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>',
              { parse_mode: 'HTML' }
            );
          }
          
          // Log ke transactions
          const referenceId = `remove_saldo_${targetUserId}_${Date.now()}`;
          db.run(
            'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
            [targetUserId, amount, 'saldo_removed', referenceId, Date.now()],
            (err3) => {
              if (err3) logger.error('Gagal log transaksi hapus saldo:', err3.message);
            }
          );
          
          // Log di filestat
          logger.info(`Admin ${adminId} menghapus saldo Rp${amount} dari user ${targetUserId}. Saldo akhir: Rp${updatedRow ? updatedRow.saldo : 'N/A'}`);
        });
      });
    });
    
  } catch (e) {
    logger.error(' Error in /hapussaldo:', e);
    return ctx.reply(' Terjadi kesalahan internal.');
  }
});

//resellerstat
bot.command('resellerstats', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Cek apakah user reseller
    const isReseller = await isUserReseller(userId);
    
    if (!isReseller) {
      return ctx.reply(' *Fitur ini hanya untuk reseller!*', { parse_mode: 'Markdown' });
    }
    
    // Ambil saldo user
    db.get('SELECT saldo FROM users WHERE user_id = ?', [userId], async (err, user) => {
      if (err) {
        logger.error(' Error ambil saldo:', err.message);
        return ctx.reply(' Terjadi kesalahan saat mengambil data.');
      }
      
      const saldo = user ? user.saldo : 0;
      
      // Hitung tanggal awal dan akhir bulan ini
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const startTimestamp = firstDay.getTime();
      const endTimestamp = lastDay.getTime();
      
      // Query transaksi bulan ini
      const query = `
        SELECT type, COUNT(*) as count, SUM(amount) as total 
        FROM transactions 
        WHERE user_id = ? 
          AND timestamp >= ? 
          AND timestamp <= ?
          AND type IN ('ssh', 'vmess', 'vless', 'trojan', 'shadowsocks', 'zivpn', 'udp_http')
          AND reference_id NOT LIKE 'account-trial-%'
        GROUP BY type
      `;
      
      db.all(query, [userId, startTimestamp, endTimestamp], async (err, rows) => {
        if (err) {
          logger.error(' Error ambil transaksi:', err.message);
          return ctx.reply(' Terjadi kesalahan saat mengambil transaksi.');
        }
        
        const totalTopup = await new Promise((resolve) => {
          db.get(
            `SELECT SUM(amount) as total FROM transactions
             WHERE user_id = ? AND timestamp >= ? AND timestamp <= ? AND type = 'deposit'`,
            [userId, startTimestamp, endTimestamp],
            (err2, row2) => resolve(!err2 && row2 && row2.total ? row2.total : 0)
          );
        });

        // Hitung total akun bulan ini
        let totalAccounts = 0;
        let totalRevenue = 0;
        const typeDetails = [];
        
        rows.forEach(row => {
          totalAccounts += row.count;
          totalRevenue += row.total || 0;
          const safeType = row.type.toUpperCase().replace(/_/g, '\\_');
          typeDetails.push(`• ${safeType}: ${row.count} akun`);
        });
        
        // Format pesan
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                          "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const currentMonth = monthNames[now.getMonth()];
        const currentYear = now.getFullYear();
        
        const message = 
          ` *STATISTIK RESELLER*\n` +
          ` Periode: ${currentMonth} ${currentYear}\n` +
          ` ID Reseller: ${userId}\n\n` +
          ` *Saldo Saat Ini:* Rp ${saldo.toLocaleString('id-ID')}\n` +
          ` *Top Up Bulan Ini:* Rp ${totalTopup.toLocaleString('id-ID')}\n\n` +
          ` *AKTIVITAS BULAN INI:*\n` +
          (typeDetails.length > 0 ? typeDetails.join('\n') : '• Belum ada transaksi') + `\n\n` +
          ` *TOTAL BULAN INI:*\n` +
          `• Jumlah Akun: ${totalAccounts} akun\n` +
          `• Total Pendapatan: Rp ${totalRevenue.toLocaleString('id-ID')}\n\n` +
          ` *Catatan:*\n` +
          `• Data diambil dari 1 ${currentMonth} ${currentYear}\n` +
          `• Hanya menampilkan transaksi pembuatan/perpanjangan akun\n` +
          `• Update real-time setiap transaksi`;
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        
        // Log
        logger.info(` Stats reseller ditampilkan untuk ${userId}: ${totalAccounts} akun bulan ini`);
      });
    });
    
  } catch (error) {
    logger.error(' Error di /resellerstats:', error);
    await ctx.reply(' Terjadi kesalahan saat memproses permintaan.');
  }
});

//allreseller stat
bot.command('allresellerstats', async (ctx) => {
  console.log('🔍 [ALLRESELLERSTATS] Handler called by', ctx.from?.id);
  try {
    const adminId = ctx.from?.id;
    if (!adminId) {
      console.log('❌ [ALLRESELLERSTATS] No admin ID');
      return ctx.reply('❌ Tidak bisa mendapatkan ID user.');
    }

    // Cek admin
    if (!adminIds.includes(adminId)) {
      console.log('❌ [ALLRESELLERSTATS] Not admin:', adminId);
      return ctx.reply('🚫 Hanya admin yang bisa menggunakan command ini!');
    }

    console.log('✅ [ALLRESELLERSTATS] Admin verified:', adminId);

    // Ambil resellers
    const resellers = listResellersSync();
    console.log('📊 [ALLRESELLERSTATS] Resellers found:', resellers?.length || 0);
    
    if (!resellers || resellers.length === 0) {
      return ctx.reply('📭 Belum ada reseller terdaftar.');
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startTimestamp = firstDay.getTime();
    const endTimestamp = lastDay.getTime();

    console.log('📅 [ALLRESELLERSTATS] Period:', startTimestamp, '-', endTimestamp);

    let totalAllAccounts = 0;
    let totalAllRevenue = 0;
    let totalAllTopup = 0;
    const resellerStats = [];

    // Loop dengan try-catch per reseller
    for (const resellerId of resellers) {
      try {
        console.log('🔄 [ALLRESELLERSTATS] Processing reseller:', resellerId);

        // Ambil saldo
        const user = await new Promise((resolve) => {
          db.get('SELECT saldo FROM users WHERE user_id = ?', [resellerId], (err, row) => {
            if (err) {
              console.error('❌ [ALLRESELLERSTATS] DB saldo error:', err.message);
              return resolve({ saldo: 0 });
            }
            resolve(row || { saldo: 0 });
          });
        });

        // Ambil transactions
        const transactions = await new Promise((resolve) => {
          db.all(
            `SELECT COUNT(*) as count, SUM(amount) as total FROM transactions
             WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
             AND type IN ('ssh', 'vmess', 'vless', 'trojan', 'shadowsocks', 'zivpn', 'udp_http')
             AND reference_id NOT LIKE 'account-trial-%'`,
            [resellerId, startTimestamp, endTimestamp],
            (err, rows) => {
              if (err) {
                console.error('❌ [ALLRESELLERSTATS] DB transactions error:', err.message);
                return resolve({ count: 0, total: 0 });
              }
              resolve((rows && rows[0]) || { count: 0, total: 0 });
            }
          );
        });

        // Ambil topup
        const topupTotal = await new Promise((resolve) => {
          db.get(
            `SELECT SUM(amount) as total FROM transactions
             WHERE user_id = ? AND timestamp >= ? AND timestamp <= ? AND type = 'deposit'`,
            [resellerId, startTimestamp, endTimestamp],
            (err, row) => {
              if (err) {
                console.error('❌ [ALLRESELLERSTATS] DB topup error:', err.message);
                return resolve(0);
              }
              resolve((row && row.total) ? row.total : 0);
            }
          );
        });

        const saldo = Number(user?.saldo) || 0;
        const count = Number(transactions?.count) || 0;
        const total = Number(transactions?.total) || 0;
        const topup = Number(topupTotal) || 0;

        totalAllAccounts += count;
        totalAllRevenue += total;
        totalAllTopup += topup;

        resellerStats.push({ resellerId, saldo, count, total, topup });
        console.log('✅ [ALLRESELLERSTATS] Reseller processed:', resellerId, { saldo, count, total, topup });

      } catch (loopErr) {
        console.error('❌ [ALLRESELLERSTATS] Loop error for', resellerId, ':', loopErr.message);
        continue;
      }
    }

    console.log('📊 [ALLRESELLERSTATS] Total stats:', { totalAllAccounts, totalAllRevenue, totalAllTopup });

    // Sort by revenue
    resellerStats.sort((a, b) => b.total - a.total);

    // Format entries
    const entries = [];
    for (const stat of resellerStats) {
      try {
        let usernameText = '-';
        try {
          const username = await getUsernameById(stat.resellerId);
          usernameText = username ? `@${String(username).replace(/^@/, '')}` : '-';
        } catch (e) {
          console.warn('⚠️ [ALLRESELLERSTATS] getUsernameById error for', stat.resellerId, ':', e.message);
        }

        const displayId = `<b>${String(stat.resellerId)}</b>`;
        const safeHtml = (s) => {
          try {
            return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s);
          } catch (e) {
            return String(s);
          }
        };

        const entry =
          `<b>${safeHtml(usernameText)}</b> [${displayId}]\n` +
          `Saldo: Rp ${Number(stat.saldo || 0).toLocaleString('id-ID')} | Akun: ${Number(stat.count || 0)}\n` +
          `Pendapatan: Rp ${Number(stat.total || 0).toLocaleString('id-ID')} | TopUp: Rp ${Number(stat.topup || 0).toLocaleString('id-ID')}\n` +
          `─────────────────`;
        
        entries.push(entry);
      } catch (entryErr) {
        console.error('❌ [ALLRESELLERSTATS] Entry format error:', entryErr.message);
        continue;
      }
    }

    console.log('📝 [ALLRESELLERSTATS] Entries formatted:', entries.length);

    const totalResellers = resellers.length;
    const periodText = safeHtmlGlobal(now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }));
    
    const summaryText =
      `\n<b>📈 RINGKASAN:</b>\n` +
      `• <b>Total Reseller:</b> ${totalResellers} orang\n` +
      `• <b>Total Akun Bulan Ini:</b> ${Number(totalAllAccounts || 0)} akun\n` +
      `• <b>Total Pendapatan:</b> Rp ${Number(totalAllRevenue || 0).toLocaleString('id-ID')}\n` +
      `• <b>Total Top Up:</b> Rp ${Number(totalAllTopup || 0).toLocaleString('id-ID')}\n` +
      `• <b>Periode:</b> ${periodText}\n` +
      `• <b>Update:</b> ${safeHtmlGlobal(now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }))}`;

    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
    const pages = [];
    
    for (let page = 0; page < totalPages; page += 1) {
      const start = page * pageSize;
      const body = entries.slice(start, start + pageSize).join('\n');
      const header =
        `<b>📊 STATISTIK SEMUA RESELLER</b>\n` +
        `<i>📅 Periode: ${periodText}</i>\n` +
        `<i>📄 Halaman ${page + 1}/${totalPages}</i>\n\n`;
      const withSummary = page === totalPages - 1 ? `\n${summaryText}` : '';
      pages.push(`${header}${body}${withSummary}`);
    }

    console.log('📄 [ALLRESELLERSTATS] Pages created:', pages.length);

    const sessionKey = `${ctx.chat.id}:${adminId}`;
    allResellerStatsSessions.set(sessionKey, {
      ownerId: adminId,
      chatId: ctx.chat.id,
      pages,
      updatedAt: Date.now()
    });

    // Keyboard di-handle di auto-split loop

    console.log('📤 [ALLRESELLERSTATS] Sending reply, page 0 length:', pages[0]?.length || 0);

    // Auto-split jika message terlalu panjang (> 3900 chars untuk safety margin)
    const MAX_LEN = 3900;
    for (let pi = 0; pi < pages.length; pi++) {
      let msg = pages[pi];
      if (msg.length <= MAX_LEN) {
        const opts = { parse_mode: 'HTML' };
        // Tambah keyboard Next/Prev
        const navButtons = [];
        if (pi > 0) navButtons.push({ text: '◀️ Prev', callback_data: 'allresellerstats_page_' + (pi - 1) });
        if (pi < totalPages - 1) navButtons.push({ text: 'Next ▶️', callback_data: 'allresellerstats_page_' + (pi + 1) });
        if (navButtons.length > 0) opts.reply_markup = { inline_keyboard: [navButtons] };
        await ctx.reply(msg, opts);
        console.log('✅ [ALLRESELLERSTATS] Page', pi + 1, 'sent, length:', msg.length);
      } else {
        // Split message jadi beberapa bagian
        console.log('⚠️ [ALLRESELLERSTATS] Page', pi + 1, 'too long:', msg.length, '- splitting');
        const chunks = [];
        while (msg.length > 0) {
          if (msg.length <= MAX_LEN) {
            chunks.push(msg);
            break;
          }
          // Cari newline terakhir sebelum MAX_LEN
          let splitAt = msg.lastIndexOf('\n', MAX_LEN);
          if (splitAt <= 0) splitAt = MAX_LEN;
          
          // Ambil chunk dan tutup semua tag HTML yang terbuka
          let chunk = msg.substring(0, splitAt);
          const openTags = (chunk.match(/<(b|i|code|pre|a|s|u)(\s[^>]*)?>/g) || []);
          const closeTags = (chunk.match(/<\/(b|i|code|pre|a|s|u)>/g) || []);
          
          // Hitung tag yang belum ditutup
          const tagMap = {};
          for (const ot of openTags) {
            const tagName = ot.match(/<(b|i|code|pre|a|s|u)/)[1];
            tagMap[tagName] = (tagMap[tagName] || 0) + 1;
          }
          for (const ct of closeTags) {
            const tagName = ct.match(/<\/(b|i|code|pre|a|s|u)>/)[1];
            tagMap[tagName] = (tagMap[tagName] || 0) - 1;
          }
          
          // Tambahkan tag penutup yang kurang
          let closingStr = '';
          for (const [tag, count] of Object.entries(tagMap)) {
            for (let i = 0; i < count; i++) {
              closingStr += '</' + tag + '>';
            }
          }
          
          // Cari tag pembuka di sisa message yang tidak ada pembukanya
          let rest = msg.substring(splitAt);
          let openingStr = '';
          for (const [tag, count] of Object.entries(tagMap)) {
            for (let i = 0; i < count; i++) {
              openingStr += '<' + tag + '>';
            }
          }
          rest = openingStr + rest;
          
          chunks.push(chunk + closingStr);
          msg = rest;
        }
        for (let ci = 0; ci < chunks.length; ci++) {
          const opts = { parse_mode: 'HTML' };
          // Hanya tambah keyboard di chunk terakhir dari page terakhir
          if (pi === pages.length - 1 && ci === chunks.length - 1) {
            const navButtons = [];
            if (pi > 0) navButtons.push({ text: '◀️ Prev', callback_data: 'allresellerstats_page_' + (pi - 1) });
            if (pi < totalPages - 1) navButtons.push({ text: 'Next ▶️', callback_data: 'allresellerstats_page_' + (pi + 1) });
            if (navButtons.length > 0) opts.reply_markup = { inline_keyboard: [navButtons] };
          }
          await ctx.reply(chunks[ci], opts);
          console.log('✅ [ALLRESELLERSTATS] Chunk', ci + 1, 'of page', pi + 1, 'sent, length:', chunks[ci].length);
        }
      }
    }

    console.log('✅ [ALLRESELLERSTATS] All pages sent successfully');
    logger.info(`✅ Admin ${adminId} melihat statistik semua reseller`);

  } catch (error) {
    console.error('❌ [ALLRESELLERSTATS] FATAL ERROR:', error.message);
    console.error('❌ [ALLRESELLERSTATS] Stack:', error.stack);
    logger.error('❌ Error di /allresellerstats:', error.message);
    logger.error('Stack:', error.stack);
    await ctx.reply('❌ Terjadi kesalahan saat memproses permintaan. Error: ' + error.message);
  }
});

// Helper function
function safeHtmlGlobal(s) {
  try {
    return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s);
  } catch (e) {
    return String(s);
  }
}

bot.action(/allresellerstats_page_(\d+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});
    const adminId = ctx.from.id;
    if (!adminIds.includes(adminId)) {
      return ctx.reply(' Hanya admin yang bisa menggunakan menu ini!');
    }

    const sessionKey = `${ctx.chat.id}:${adminId}`;
    const session = allResellerStatsSessions.get(sessionKey);
    if (!session || !Array.isArray(session.pages) || session.pages.length === 0) {
      return ctx.reply(' Sesi statistik reseller sudah habis. Jalankan /allresellerstats lagi.');
    }

    const maxAgeMs = 10 * 60 * 1000;
    if (Date.now() - Number(session.updatedAt || 0) > maxAgeMs) {
      allResellerStatsSessions.delete(sessionKey);
      return ctx.reply(' Sesi statistik reseller sudah kadaluarsa. Jalankan /allresellerstats lagi.');
    }

    const totalPages = session.pages.length;
    let page = Number(ctx.match[1] || 0);
    if (!Number.isFinite(page)) page = 0;
    page = Math.max(0, Math.min(totalPages - 1, page));

    const row = [];
    if (page > 0) row.push({ text: '⬅ Prev', callback_data: `allresellerstats_page_${page - 1}` });
    if (page < totalPages - 1) row.push({ text: 'Next ', callback_data: `allresellerstats_page_${page + 1}` });
    const editOptions = { parse_mode: 'HTML' };
    if (row.length) editOptions.reply_markup = { inline_keyboard: [row] };
    await ctx.editMessageText(session.pages[page], editOptions);
  } catch (error) {
    logger.error(' Error pagination allresellerstats:', error.message);
    await ctx.reply(' Terjadi kesalahan saat membuka halaman statistik reseller.');
  }
});

//  FUNGSI UNTUK ESCAPE HTML (untuk aman)
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getResellerStatsForPeriod(userId, startTimestamp, endTimestamp) {
  return new Promise((resolve) => {
    db.get(
      `SELECT COUNT(*) as count
       FROM transactions
       WHERE user_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
        AND type IN ('ssh', 'vmess', 'vless', 'trojan', 'shadowsocks', 'zivpn', 'udp_http')
        AND reference_id NOT LIKE 'account-trial-%'`,
      [userId, startTimestamp, endTimestamp],
      (err, row) => {
        const count = !err && row ? row.count : 0;
        db.get(
          `SELECT SUM(amount) as total
           FROM transactions
           WHERE user_id = ?
             AND timestamp >= ?
             AND timestamp <= ?
             AND type = 'deposit'`,
          [userId, startTimestamp, endTimestamp],
          (err2, row2) => {
            const total = !err2 && row2 && row2.total ? row2.total : 0;
            resolve({ count, topup: total });
          }
        );
      }
    );
  });
}

async function evaluateResellerTermsForPeriod(startTimestamp, endTimestamp, periodLabel) {
  const terms = loadResellerTerms();
  const resellers = listResellersSync();
  if (resellers.length === 0) return;

  for (const resellerId of resellers) {
    const stats = await getResellerStatsForPeriod(resellerId, startTimestamp, endTimestamp);
    const failedTopup = stats.topup < terms.min_topup;

    if (failedTopup) {
      removeReseller(resellerId);
      const message =
        `Syarat reseller bulan ${periodLabel} tidak terpenuhi.\n\n` +
        `Top up: ${formatRupiah(stats.topup)} (minimal ${formatRupiah(terms.min_topup)})\n\n` +
        'Status reseller dinonaktifkan. Untuk aktif kembali, hubungi admin.';
      try {
        await bot.telegram.sendMessage(resellerId, message);
      } catch (err) {
        logger.error('Gagal kirim notifikasi demote reseller:', err.message);
      }
      logger.info(`Reseller ${resellerId} diturunkan karena tidak memenuhi syarat bulan ${periodLabel}`);
    }
  }
}

////
bot.command('addserverzivpn_reseller', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Tidak ada izin.');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  const params = parts.slice(1);

  if (!(params.length === 7 || params.length === 10)) {
    return ctx.reply(
      ' Format:\n`/addserverzivpn_reseller <domain> <auth> <harga_user_1ip> <harga_user_2ip> <harga_reseller_1ip> <harga_reseller_2ip> <nama_server> <quota> <iplimit> <batas_create_akun>`\n\n' +
      'Format lama (7 argumen) masih didukung, semua harga akan disamakan.',
      { parse_mode: 'Markdown' }
    );
  }

  let domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas;
  if (params.length === 7) {
    [domain, auth, harga1, nama_server, quota, iplimit, batas] = params;
    harga2 = harga1;
    hargaRes1 = harga1;
    hargaRes2 = harga1;
  } else {
    [domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas] = params;
  }

  if (![harga1, harga2, hargaRes1, hargaRes2, quota, iplimit, batas].every(v => /^\d+$/.test(v))) {
    return ctx.reply(' harga, quota, iplimit, batas harus angka.');
  }

  db.run(
    `INSERT INTO Server
     (domain, auth, harga, harga_reseller, harga_1ip, harga_2ip, harga_reseller_1ip, harga_reseller_2ip, nama_server, quota, iplimit, batas_create_akun, total_create_akun, is_reseller_only, support_zivpn, support_udp_http, service)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 0, 'ssh')`,
    [
      domain,
      auth,
      parseInt(harga1),
      parseInt(hargaRes1),
      parseInt(harga1),
      parseInt(harga2),
      parseInt(hargaRes1),
      parseInt(hargaRes2),
      nama_server,
      parseInt(quota),
      parseInt(iplimit),
      parseInt(batas)
    ],
    (err) => {
      if (err) {
        logger.error(err.message);
        return ctx.reply(' Gagal menambahkan server ZIVPN reseller.');
      }

      ctx.reply(
        ` Server *ZIVPN Reseller* \`${nama_server}\` berhasil ditambahkan.\n` +
        `• Harga User 1IP: Rp${parseInt(harga1).toLocaleString('id-ID')}\n` +
        `• Harga User 2IP: Rp${parseInt(harga2).toLocaleString('id-ID')}\n` +
        `• Harga Reseller 1IP: Rp${parseInt(hargaRes1).toLocaleString('id-ID')}\n` +
        `• Harga Reseller 2IP: Rp${parseInt(hargaRes2).toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
      );
    }
  );
});

//////
bot.command(['start', 'menu'], async (ctx) => {
  logger.info('Start or Menu command received');
  
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'Pengguna';

  // Hapus pesan /start atau /menu agar tidak menumpuk
  if (ctx.message && ctx.message.text && (ctx.message.text.startsWith('/start') || ctx.message.text.startsWith('/menu'))) {
    try { await ctx.deleteMessage(); } catch (e) {}
  }

  ctx.state = ctx.state || {};
  ctx.state.forceNewMenu = true;

  // Simpan user ke DB
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (err) { logger.error('Kesalahan saat memeriksa user_id:', err.message); return; }
    if (!row) {
      db.run('INSERT INTO users (user_id) VALUES (?)', [userId], async (err) => {
        if (err) { logger.error('Kesalahan saat menyimpan user_id:', err.message); return; }
        logger.info(`User ID ${userId} berhasil disimpan`);
        // Kirim pesan sambutan untuk user baru
        try {
          await ctx.reply(
            `👋 *Selamat datang di ${NAMA_STORE}!*\n\n` +
            `👋 *Selamat datang di ${NAMA_STORE}!*\n\n` +
            `Halo *${userName}*, terima kasih sudah bergabung! 🎉\n\n` +
            `📌 *Cara mulai:*\n` +
            `1️⃣ Top up saldo dulu via menu *💳 Top Up*\n` +
            `   • Saldo VPN → beli akun VPN & suntik followers\n` +
            `   • Saldo Tembak Kuota → beli Akrab & PPOB\n\n` +
            `2️⃣ Pilih layanan:\n` +
            `   🔑 *Akun VPN* → SSH, VMess, VLess, Trojan\n` +
            `   🤝 *Akrab* → tembak kuota XL prabayar\n` +
            `   💉 *Suntik* → tambah followers medsos\n\n` +
            `❓ Butuh bantuan? Ketuk menu *📞 Hubungi Admin*\n` +
            `_Selamat berbelanja!_ 🛒`,
            { parse_mode: 'Markdown' }
          );
        } catch (_) {}
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────

  await sendMainMenu(ctx);
});

cleanupExpiredAccounts();
////////////////
// Manual admin command: /addsaldo <user_id> <jumlah>
bot.command('addsaldo', async (ctx) => {
  try {
    const userId = ctx.message.from.id;

    // hanya admin
    if (!adminIds || !adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.');
    }

    const args = ctx.message.text.trim().split(/\s+/);
    if (args.length !== 3) {
      return ctx.reply(' Format salah.\nGunakan:\n`/addsaldo <user_id> <jumlah>`', { parse_mode: 'Markdown' });
    }

    const targetUserId = args[1].trim();
    const amount = parseInt(args[2], 10);

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(' Jumlah saldo harus berupa angka dan lebih dari 0.');
    }

    // Cek apakah user ada
    db.get('SELECT saldo FROM users WHERE user_id = ?', [targetUserId], (err, row) => {
      if (err) {
        logger.error(' Gagal memeriksa user_id:', err.message);
        return ctx.reply(' Terjadi kesalahan saat memeriksa user.');
      }

      if (!row) {
        return ctx.reply(` User dengan ID ${targetUserId} belum terdaftar di database.`);
      }

      // Lakukan update saldo
      db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [amount, targetUserId], function (err) {
        if (err) {
          logger.error(' Gagal menambah saldo:', err.message);
          return ctx.reply(' Gagal menambah saldo.');
        }

        // pastikan ada perubahan (this.changes tersedia karena function)
        if (this.changes === 0) {
          return ctx.reply(' Tidak ada user yang diupdate. Pastikan ID benar.');
        }

// Ambil saldo terbaru dan kirim ke Telegram + log
db.get('SELECT saldo FROM users WHERE user_id = ?', [targetUserId], async (err2, updatedRow) => {
  if (err2 || !updatedRow) {
    logger.info(`Admin ${ctx.from.id} menambah saldo Rp${amount} ke user ${targetUserId}, namun gagal membaca saldo terbaru.`);
    await ctx.reply(` Saldo sebesar Rp${amount.toLocaleString()} berhasil ditambahkan ke user ${targetUserId}.`);
    await bot.telegram.sendMessage(
      targetUserId,
      ` Saldo Anda berhasil ditambahkan admin.\n` +
      ` Nominal: Rp${amount.toLocaleString('id-ID')}`
    ).catch((notifyErr) => {
      logger.error(`Gagal kirim notifikasi tambah saldo ke ${targetUserId}: ${notifyErr.message}`);
    });
    return;
  }

          // Kirim pesan ke Telegram dengan saldo akhir
          await ctx.reply(
            ` Saldo sebesar *Rp${amount.toLocaleString()}* berhasil ditambahkan ke user \`${targetUserId}\`.\n Saldo user sekarang: *Rp${updatedRow.saldo.toLocaleString()}*`,
            { parse_mode: 'Markdown' }
          );
          await bot.telegram.sendMessage(
            targetUserId,
            ` Saldo Anda berhasil ditambahkan admin.\n` +
            ` Nominal: Rp${amount.toLocaleString('id-ID')}\n` +
            ` Saldo sekarang: Rp${updatedRow.saldo.toLocaleString('id-ID')}`
          ).catch((notifyErr) => {
            logger.error(`Gagal kirim notifikasi tambah saldo ke ${targetUserId}: ${notifyErr.message}`);
          });

          // Log di file
          logger.info(`Admin ${ctx.from.id} menambah saldo Rp${amount} ke user ${targetUserId}. Saldo user sekarang: Rp${updatedRow.saldo}`);
        });
      });
    });
  } catch (e) {
    logger.error(' Error in /addsaldo command:', e);
    return ctx.reply(' Terjadi kesalahan internal saat memproses perintah.');
  }
});

//////////////////
bot.command('debugcekstok', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) return;
  try {
    const [stokV1Resp, stokV2Resp] = await Promise.all([
      akrabModule.cekStokAkrab(KHFY_ENDPOINT).catch(() => null),
      akrabModule.cekStokAkrabV2(KHFY_ENDPOINT).catch(() => null),
    ]);

    let body = '<b>Debug Slot Map</b>\n\n';
    body += '<b>V1 (XLA) raw response:</b>\n<pre>' + JSON.stringify(stokV1Resp, null, 2).slice(0, 800) + '</pre>\n\n';
    body += '<b>V2 (XDA) raw response:</b>\n<pre>' + JSON.stringify(stokV2Resp, null, 2).slice(0, 800) + '</pre>';

    await ctx.reply(body, { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply('Error: ' + err.message);
  }
});

bot.command('debugakrab', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) return;
  try {
    const products = await akrabModule.getProducts(KHFY_ENDPOINT, KHFY_API_KEY);
    const grup = (ctx.message.text.split(/\s+/)[1] || 'xla').toLowerCase();
    const re = grup === 'xda' ? /^XDA/i : /^XLA/i;
    const list = (products || []).filter(p => re.test(p.kode_produk || p.code || ''));
    if (!list.length) {
      // Tampilkan sample mentah jika filter tidak ketemu
      const sample = (products || []).slice(0, 3);
      return ctx.reply(
        `❌ Tidak ada produk ${grup.toUpperCase()}.\n\nTotal produk diterima: ${(products || []).length}\nSample 3 produk mentah:\n<pre>${JSON.stringify(sample, null, 2).slice(0, 2000)}</pre>\n\nKetik /debugakrabraw untuk lihat response API mentah.`,
        { parse_mode: 'HTML' }
      );
    }
    const lines = list.slice(0, 25).map(p => {
      const kode = p.kode_produk || p.code || '-';
      const nama = (p.nama_produk || p.name || '-').slice(0, 25);
      const harga = p.harga ?? p.price ?? '-';
      const hargaFinal = p.harga_final ?? '-';
      const kosong = p.kosong ?? 0;
      const provider = p.kode_provider || '-';
      return `<code>${kode}</code> | ${nama}\n   harga:${harga} final:${hargaFinal} k:${kosong} prov:${provider}`;
    });
    await ctx.reply(`<b>Debug ${grup.toUpperCase()} (${list.length} produk)</b>\nKetik /debugakrab xda untuk lihat XDA\n\n${lines.join('\n')}`, { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply('Error: ' + err.message);
  }
});

// Debug: tampilkan response HTTP MENTAH dari endpoint list_product
bot.command('debugakrabraw', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) return;
  try {
    const axios = require('axios');
const QRCode = require('qrcode');
    const url = `${KHFY_ENDPOINT}/api_v2/list_product`;
    const resp = await axios.get(url, { params: { api_key: KHFY_API_KEY }, timeout: 20000, validateStatus: () => true });
    const data = resp.data;
    let info = `<b>RAW list_product</b>\n`;
    info += `URL: <code>${KHFY_ENDPOINT}/api_v2/list_product</code>\n`;
    info += `HTTP Status: ${resp.status}\n`;
    info += `Tipe data: ${Array.isArray(data) ? 'array' : typeof data}\n`;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      info += `Keys: ${Object.keys(data).join(', ')}\n`;
    }
    info += `\n<pre>${JSON.stringify(data, null, 2).slice(0, 3000)}</pre>`;
    await ctx.reply(info, { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply('Error: ' + (err.message || err) + (err.response ? `\nHTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 500)}` : ''));
  }
});

bot.command('admin', async (ctx) => {
  logger.info('Admin menu requested');
  
  if (!adminIds.includes(ctx.from.id)) {
    await ctx.reply(' Anda tidak memiliki izin untuk mengakses menu admin.');
    return;
  }

  await sendAdminMenu(ctx);
});

async function sendMainMenu(ctx) {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || '-';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const VPN_TYPES = '"ssh","vmess","vless","trojan","shadowsocks","udp_http","zivpn"';
  const NOT_TRIAL = 'reference_id NOT LIKE "account-trial-%"';

  // ── Semua query DB jalan paralel ──────────────────────────────────────────
  const [
    saldoRow, saldoAkrabVal, isResellerVal,
    userTodayRow, userWeekRow, userMonthRow,
    globalTodayRow, globalWeekRow, globalMonthRow,
    globalAllRow, jumlahPenggunaRow,
    activeAccountRow, nearestExpiryRow
  ] = await Promise.all([
    new Promise(r => db.get('SELECT saldo FROM users WHERE user_id = ?', [userId], (e, row) => r(row))),
    dbH.getSaldoAkrab(db, userId).catch(() => 0),
    isUserReseller(userId).catch(() => false),
    new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE user_id=? AND timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [userId, todayStart], (e, row) => r(row))),
    new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE user_id=? AND timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [userId, weekStart],  (e, row) => r(row))),
    new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE user_id=? AND timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [userId, monthStart], (e, row) => r(row))),
    new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [todayStart], (e, row) => r(row))),
    new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [weekStart],  (e, row) => r(row))),
    new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [monthStart], (e, row) => r(row))),
    new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [], (e, row) => r(row))),
    new Promise(r => db.get('SELECT COUNT(*) AS c FROM users', [], (e, row) => r(row))),
    new Promise(r => db.get('SELECT COUNT(*) as c FROM accounts WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)', [userId, Date.now()], (e, row) => r(row))),
    new Promise(r => db.get('SELECT MIN(expires_at) as nearest FROM accounts WHERE user_id = ? AND expires_at > ?', [userId, Date.now()], (e, row) => r(row))),
  ]).catch(() => Array(13).fill(null));

  const saldo        = saldoRow ? (saldoRow.saldo || 0) : 0;
  const saldoAkrab   = saldoAkrabVal || 0;
  const isReseller   = !!isResellerVal;
  const userToday    = userTodayRow  ? (userTodayRow.c  || 0) : 0;
  const userWeek     = userWeekRow   ? (userWeekRow.c   || 0) : 0;
  const userMonth    = userMonthRow  ? (userMonthRow.c  || 0) : 0;
  const globalToday  = globalTodayRow ? (globalTodayRow.c || 0) : 0;
  const globalWeek   = globalWeekRow  ? (globalWeekRow.c  || 0) : 0;
  const globalMonth  = globalMonthRow ? (globalMonthRow.c || 0) : 0;
  const globalAll    = globalAllRow   ? (globalAllRow.c   || 0) : 0;
  const jumlahPengguna = jumlahPenggunaRow ? (jumlahPenggunaRow.c || 0) : 0;
  const activeAccounts = activeAccountRow ? (activeAccountRow.c || 0) : 0;
  const nearestExpiry  = nearestExpiryRow ? (nearestExpiryRow.nearest || 0) : 0;
  const statusReseller = isReseller ? 'Reseller' : 'Bukan Reseller';
  const latency = (Math.random() * 0.1 + 0.01).toFixed(2);

  // Hitung sisa hari akun terdekat expired
  let expiryLine = '';
  if (activeAccounts > 0 && nearestExpiry > 0) {
    const sisaHari = Math.ceil((nearestExpiry - Date.now()) / (24 * 60 * 60 * 1000));
    const expiryWarn = sisaHari <= 3 ? ' ⚠️' : '';
    expiryLine = `\n<code>├ Akun aktif : ${activeAccounts} (exp terdekat: ${sisaHari} hari${expiryWarn})</code>`;
  } else if (activeAccounts > 0) {
    expiryLine = `\n<code>├ Akun aktif : ${activeAccounts}</code>`;
  }

  const messageText = `<code>┏━━━━━━━━━━━━━━━━━━━━━┓</code>
   ✨ <b>${NAMA_STORE}</b> ✨
<code>┗━━━━━━━━━━━━━━━━━━━━━┛</code>

👤 <b>Informasi Akun</b>
<code>├ Nama   : ${userName}</code>
<code>├ ID     : ${userId}</code>
<code>├ Status : ${statusReseller}</code>
<code>├ Saldo VPN        : Rp ${Number(saldo || 0).toLocaleString('id-ID')}</code>
<code>└ Saldo Tembak Kuota: Rp ${Number(saldoAkrab || 0).toLocaleString('id-ID')}</code>

📊 <b>Transaksi Kamu</b>
<code>├ 📅 Hari ini   : ${userToday}</code>
<code>├ 📆 Minggu ini : ${userWeek}</code>
<code>└ 🗓️ Bulan ini  : ${userMonth}</code>

🌍 <b>Transaksi Global</b>
<code>├ Hari   : ${globalToday}</code>
<code>├ Minggu : ${globalWeek}</code>
<code>├ Bulan  : ${globalMonth}</code>
<code>└ Total  : ${globalAll}</code>

⚙️ <b>${jumlahPengguna} user · ${latency}ms</b>`;

  // Buat keyboard dasar untuk semua user
  const testMenuEnabled = loadTestMenuSetting();
  let keyboard = [
    [
      { text: 'Akun VPN', callback_data: 'menu_vpn', style: 'success' },
      { text: 'Akrab', callback_data: 'menu_akrab', style: 'success' }
    ],
    [
      { text: 'Suntik', callback_data: 'menu_suntik', style: 'primary' },
      { text: 'Top Up', callback_data: 'menu_topup', style: 'primary' }
    ],
    [
      { text: 'PPOB', callback_data: 'menu_ppob', style: 'primary' },
      { text: 'Tools', callback_data: 'menu_tools', style: 'primary' }
    ],
    ...(isReseller
      ? [[{ text: 'Admin', callback_data: 'hubungi_admin', style: 'danger' }]]
      : [[{ text: 'Admin', callback_data: 'hubungi_admin', style: 'danger' },
          { text: 'Jadi Reseller', callback_data: 'jadi_reseller', style: 'danger' }]]),
    ...(testMenuEnabled ? [[
      { text: 'Test', callback_data: 'admin_test_menu' },
      { text: 'Refresh', callback_data: 'send_main_menu', style: 'danger' }
    ]] : [[
      { text: 'Refresh', callback_data: 'send_main_menu', style: 'danger' }
    ]]),
  ];

  // Satu tombol Top Up yang membuka submenu (VPN + Tembak Kuota)
  // (sudah ada di keyboard di atas)

  if (loadScNexusMenuSetting()) {
    keyboard.push([
      { text: '🚀 SC 1FORCR NEXUS', url: 'https://t.me/sc1forcrnexusbot' }
    ]);
  }

  // Jika user adalah reseller, tambahkan tombol khusus di bawah Akun VPN
  if (isReseller) {
    keyboard.splice(1, 0, [
      { text: 'Statistik Saya', callback_data: 'reseller_stats', style: 'primary' }
    ]);
    logger.info(' Menu reseller ditampilkan untuk user: ' + userId);
  }

  try {
    if (ctx.updateType === 'callback_query') {
      try {
        await ctx.editMessageText(messageText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
          lastMenuMessageId.set(userId, ctx.callbackQuery.message.message_id);
        }
      } catch (error) {
        if (error && error.response && error.response.error_code === 400 &&
            (error.response.description.includes('message is not modified') ||
             error.response.description.includes('message to edit not found') ||
             error.response.description.includes('message can\'t be edited'))
        ) {
          logger.info('Edit message diabaikan karena pesan sudah diedit/dihapus atau tidak berubah.');
        } else {
          logger.error('Error saat mengedit menu utama:', error);
        }
      }
    } else {
      try {
        const forceNewMenu = ctx.state && ctx.state.forceNewMenu;
        const isStartCommand = forceNewMenu || (ctx.message && typeof ctx.message.text === 'string' && (ctx.message.text.startsWith('/start') || ctx.message.text.startsWith('/menu')));
        if (isStartCommand) {
          if (lastMenuMessageId.has(userId)) {
            try {
              await ctx.telegram.deleteMessage(userId, lastMenuMessageId.get(userId));
            } catch (e) {
              // ignore if cannot delete
            }
          }
          const sent = await ctx.reply(messageText, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          if (sent && sent.message_id) {
            lastMenuMessageId.set(userId, sent.message_id);
          }
          logger.info('Main menu sent');
          return;
        }

        if (lastMenuMessageId.has(userId)) {
          try {
            await ctx.telegram.editMessageText(
              userId,
              lastMenuMessageId.get(userId),
              null,
              messageText,
              { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
            );
          } catch (e) {
            // fallback: hapus lama lalu kirim baru
            try {
              await ctx.telegram.deleteMessage(userId, lastMenuMessageId.get(userId));
            } catch (delErr) {
              // ignore jika tidak bisa dihapus
            }
            const sent = await ctx.reply(messageText, {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
            if (sent && sent.message_id) {
              lastMenuMessageId.set(userId, sent.message_id);
            }
          }
        } else {
          const sent = await ctx.reply(messageText, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          if (sent && sent.message_id) {
            lastMenuMessageId.set(userId, sent.message_id);
          }
        }
      } catch (error) {
        logger.error('Error saat mengirim menu utama:', error);
      }
    }
    logger.info('Main menu sent');
  } catch (error) {
    logger.error('Error umum saat mengirim menu utama:', error);
  }
}

bot.command('hapuslog', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Tidak ada izin!');
  try {
    if (fs.existsSync('bot-combined.log')) fs.unlinkSync('bot-combined.log');
    if (fs.existsSync('bot-error.log')) fs.unlinkSync('bot-error.log');
    ctx.reply('Log berhasil dihapus.');
    logger.info('Log file dihapus oleh admin.');
  } catch (e) {
    ctx.reply('Gagal menghapus log: ' + e.message);
    logger.error('Gagal menghapus log: ' + e.message);
  }
});

bot.command('restartserver', async (ctx) => {
  const userId = ctx.from?.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('Tidak ada izin!');
  }

  const rawTarget = (ctx.message?.text || '').split(' ').slice(1).join(' ').trim();
  const defaultTarget = process.env.pm_id || process.env.name || 'all';
  const target = rawTarget || String(defaultTarget);

  if (!/^[a-zA-Z0-9_.-]+$/.test(target)) {
    return ctx.reply('Target restart tidak valid. Gunakan nama app PM2 atau id numerik.');
  }

  await ctx.reply('Menjalankan restart PM2: ' + target);

  exec('pm2 restart ' + target, (error, stdout, stderr) => {
    if (error) {
      logger.error('Gagal restart PM2 via Telegram: ' + error.message);
      return ctx.reply('Gagal restart PM2: ' + error.message);
    }

    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    const safeOutput = output ? output.slice(0, 1200) : 'OK';
    return ctx.reply('Restart PM2 berhasil.\n' + safeOutput);
  });
});

async function sendHelpAdmin(ctx) {
  const userId = ctx.from?.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }
  
  const helpMessage = `
📋 *Daftar Perintah Admin:*

💰 *Saldo*
1. /addsaldo \`<user_id> <jumlah>\` — Tambah saldo user
2. /hapussaldo \`<user_id> <jumlah>\` — Hapus saldo user

🖥️ *Server*
3. /addserver — Tambah server baru
4. /addserver\\_reseller — Tambah server khusus reseller
5. /addserverzivpn — Tambah server ZIVPN
6. /addserverzivpn\\_reseller — Tambah server ZIVPN reseller
7. /editnama \`<domain> <nama>\` — Edit nama server
8. /editdomain \`<old> <new>\` — Edit domain server
9. /editauth \`<domain> <auth>\` — Edit auth server
10. /editharga \`<domain> <harga>\` — Edit harga server
11. /editlimitcreate \`<domain> <batas>\` — Edit batas buat akun
12. /editlimitip \`<domain> <limit>\` — Edit batas IP server
13. /editlimitquota \`<domain> <quota>\` — Edit quota server
14. /edittotalcreate \`<domain> <total>\` — Edit total akun server
15. /syncservernow — Sinkronisasi akun & bandwidth server
16. /setserverbw \`<id> <limit_tb> [avg_gb]\` — Set limit bandwidth

🤝 *Reseller*
17. /addressel \`<user_id>\` — Tambah reseller baru
18. /delressel \`<user_id>\` — Hapus reseller
19. /resellerstats — Statistik reseller sendiri
20. /allresellerstats — Statistik semua reseller

📣 *Broadcast*
21. /broadcast \`<pesan>\` — Siaran ke semua user
22. /broadcastreseller \`<pesan>\` — Siaran ke reseller
23. /broadcastpoll \`Pertanyaan | Opsi A | Opsi B\` — Polling ke semua user

💳 *Payment*
24. /checkpaymentconfig — Cek konfigurasi payment API

📊 *Dashboard & Log*
25. /summary — Dashboard ringkasan harian
26. /exportusers — Export semua data user ke CSV
27. /blacklist \`<user_id>\` — Blokir user dari bot
28. /unblacklist \`<user_id>\` — Buka blokir user
29. /listblacklist — Lihat daftar user yang diblokir
30. /hapuslog — Hapus file log bot
31. /restartserver \`[target]\` — Restart app PM2

_Gunakan perintah dengan format yang benar untuk menghindari kesalahan._
`;
  ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

bot.command('helpadmin', async (ctx) => {
  await sendHelpAdmin(ctx);
});

// ── Command /summary — Dashboard Harian Admin ──────────────────────────────
bot.command('summary', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply('⛔ Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }
  await sendAdminDailyDashboard(ctx);
});

// ── Fitur 7: /exportusers ─────────────────────────────────────────────────────
bot.command('exportusers', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply('⛔ Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  try {
    await ctx.reply('⏳ Memproses export data user...');

    const users = await new Promise((resolve, reject) =>
      db.all('SELECT user_id, saldo, saldo_akrab FROM users ORDER BY user_id ASC', [], (err, rows) =>
        err ? reject(err) : resolve(rows || [])
      )
    );

    const resellerSet = new Set(listResellersSync().map(String));

    // Buat CSV
    const header = 'user_id,saldo_vpn,saldo_akrab,status\n';
    const rows = users.map(u => {
      const status = resellerSet.has(String(u.user_id)) ? 'reseller' : 'user';
      return `${u.user_id},${u.saldo || 0},${u.saldo_akrab || 0},${status}`;
    }).join('\n');
    const csv = header + rows;

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const fileName = `users_export_${ts}.csv`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, csv, 'utf8');

    await ctx.telegram.sendDocument(
      ctx.from.id,
      { source: filePath, filename: fileName },
      {
        caption:
          `📊 <b>Export Data User</b>\n` +
          `<code>──────────────────────</code>\n` +
          `✦ Total User     : ${users.length}\n` +
          `✦ Total Reseller : ${resellerSet.size}\n` +
          `✦ Waktu          : ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
          `<code>──────────────────────</code>\n` +
          `<i>Format: user_id, saldo_vpn, saldo_akrab, status</i>`,
        parse_mode: 'HTML'
      }
    );

    try { fs.unlinkSync(filePath); } catch (_) {}
    logger.info(`[ExportUsers] Admin ${ctx.from.id} export ${users.length} user`);
  } catch (err) {
    logger.error('[ExportUsers] Error: ' + err.message);
    await ctx.reply('❌ Gagal export data user: ' + err.message);
  }
});

bot.action('admin_daily_dashboard', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return;
  await sendAdminDailyDashboard(ctx);
});

// ── Fitur 8: Blacklist commands ───────────────────────────────────────────────
bot.command('blacklist', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('⛔ Tidak ada izin.');
  const args = ctx.message.text.trim().split(/\s+/);
  if (args.length < 2 || !/^\d+$/.test(args[1])) {
    return ctx.reply('Format: `/blacklist <user_id>`', { parse_mode: 'Markdown' });
  }
  const targetId = args[1];
  const list = loadBlacklist();
  if (list.includes(targetId)) {
    return ctx.reply(`ℹ️ User \`${targetId}\` sudah ada di blacklist.`, { parse_mode: 'Markdown' });
  }
  list.push(targetId);
  saveBlacklist(list);
  logger.info(`Admin ${ctx.from.id} blacklist user ${targetId}`);
  await ctx.reply(`⛔ User \`${targetId}\` berhasil diblokir.`, { parse_mode: 'Markdown' });
  // Notif ke user
  bot.telegram.sendMessage(targetId, '⛔ Akun kamu telah diblokir dari bot ini. Hubungi admin jika ada pertanyaan.').catch(() => {});
});

bot.command('unblacklist', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('⛔ Tidak ada izin.');
  const args = ctx.message.text.trim().split(/\s+/);
  if (args.length < 2 || !/^\d+$/.test(args[1])) {
    return ctx.reply('Format: `/unblacklist <user_id>`', { parse_mode: 'Markdown' });
  }
  const targetId = args[1];
  const list = loadBlacklist().filter(id => id !== targetId);
  saveBlacklist(list);
  logger.info(`Admin ${ctx.from.id} unblacklist user ${targetId}`);
  await ctx.reply(`✅ User \`${targetId}\` berhasil dihapus dari blacklist.`, { parse_mode: 'Markdown' });
  bot.telegram.sendMessage(targetId, '✅ Akun kamu telah dibuka blokirnya. Silakan gunakan bot kembali.').catch(() => {});
});

bot.command('listblacklist', async (ctx) => {
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('⛔ Tidak ada izin.');
  const list = loadBlacklist();
  if (!list.length) return ctx.reply('ℹ️ Blacklist kosong.');
  await ctx.reply(`⛔ *Daftar Blacklist (${list.length} user):*\n\n` + list.map((id, i) => `${i + 1}. \`${id}\``).join('\n'), { parse_mode: 'Markdown' });
});

async function sendAdminDailyDashboard(ctx) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);

    const VPN_TYPES = '"ssh","vmess","vless","trojan","shadowsocks","udp_http","zivpn"';
    const NOT_TRIAL = 'reference_id NOT LIKE "account-trial-%"';

    const [
      txTodayRow, txWeekRow, txMonthRow,
      topupTodayRow, topupMonthRow,
      totalUserRow, activeUserRow,
      serverRow
    ] = await Promise.all([
      new Promise(r => db.get(`SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as total FROM transactions WHERE timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [todayStart], (e, row) => r(row))),
      new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [weekStart], (e, row) => r(row))),
      new Promise(r => db.get(`SELECT COUNT(*) as c FROM transactions WHERE timestamp>=? AND type IN (${VPN_TYPES}) AND ${NOT_TRIAL}`, [monthStart], (e, row) => r(row))),
      new Promise(r => db.get(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE timestamp>=? AND type='deposit'`, [todayStart], (e, row) => r(row))),
      new Promise(r => db.get(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE timestamp>=? AND type='deposit'`, [monthStart], (e, row) => r(row))),
      new Promise(r => db.get('SELECT COUNT(*) as c FROM users', [], (e, row) => r(row))),
      new Promise(r => db.get(`SELECT COUNT(DISTINCT user_id) as c FROM transactions WHERE timestamp>=? AND type IN (${VPN_TYPES})`, [sevenDaysAgo], (e, row) => r(row))),
      new Promise(r => db.all('SELECT nama_server, total_create_akun, batas_create_akun FROM Server ORDER BY nama_server COLLATE NOCASE ASC', [], (e, rows) => r(rows || []))),
    ]).catch(() => Array(8).fill(null));

    const txToday   = txTodayRow  ? (txTodayRow.c  || 0) : 0;
    const incToday  = txTodayRow  ? (txTodayRow.total || 0) : 0;
    const txWeek    = txWeekRow   ? (txWeekRow.c   || 0) : 0;
    const txMonth   = txMonthRow  ? (txMonthRow.c  || 0) : 0;
    const topToday  = topupTodayRow ? (topupTodayRow.total || 0) : 0;
    const topMonth  = topupMonthRow ? (topupMonthRow.total || 0) : 0;
    const totalUser = totalUserRow  ? (totalUserRow.c  || 0) : 0;
    const activeUser = activeUserRow ? (activeUserRow.c || 0) : 0;
    const servers   = Array.isArray(serverRow) ? serverRow : [];

    const serverLines = servers.slice(0, 8).map(s => {
      const batas = Number(s.batas_create_akun || 0);
      const total = Number(s.total_create_akun || 0);
      const pct = batas > 0 ? Math.round((total / batas) * 100) : 0;
      const bar = batas > 0 ? `${total}/${batas} (${pct}%)` : `${total}/∞`;
      return `<code>├ ${(s.nama_server || '-').slice(0, 18).padEnd(18)} : ${bar}</code>`;
    }).join('\n');

    const timeStr = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const text =
      `📊 <b>DASHBOARD HARIAN</b>\n` +
      `<code>──────────────────────</code>\n` +
      `🕐 <i>${timeStr}</i>\n\n` +
      `🛒 <b>Transaksi Akun VPN</b>\n` +
      `<code>├ Hari ini  : ${txToday} akun (Rp ${Number(incToday).toLocaleString('id-ID')})</code>\n` +
      `<code>├ Minggu ini: ${txWeek} akun</code>\n` +
      `<code>└ Bulan ini : ${txMonth} akun</code>\n\n` +
      `💰 <b>Top Up Masuk</b>\n` +
      `<code>├ Hari ini  : Rp ${Number(topToday).toLocaleString('id-ID')}</code>\n` +
      `<code>└ Bulan ini : Rp ${Number(topMonth).toLocaleString('id-ID')}</code>\n\n` +
      `👥 <b>User</b>\n` +
      `<code>├ Total     : ${totalUser} user</code>\n` +
      `<code>└ Aktif 7hr : ${activeUser} user</code>\n\n` +
      (serverLines ? `🖥️ <b>Kapasitas Server</b>\n${serverLines}\n\n` : '') +
      `<i>Gunakan /summary kapan saja untuk refresh.</i>`;

    const replyMarkup = {
      inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'admin_daily_dashboard' }, { text: '🔙 Menu Admin', callback_data: 'admin_menu' }]]
    };

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: replyMarkup })
        .catch(async () => { await ctx.reply(text, { parse_mode: 'HTML', reply_markup: replyMarkup }); });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: replyMarkup });
    }
  } catch (err) {
    logger.error('sendAdminDailyDashboard error: ' + err.message);
    await ctx.reply('❌ Gagal memuat dashboard. Coba lagi.');
  }
}

//////////
bot.command('addserver_reseller', async (ctx) => {
  try {
    const params = ctx.message.text.trim().split(/\s+/).slice(1);
    if (!(params.length === 7 || params.length === 10)) {
      return ctx.reply(
        ' Format salah!\n\n' +
        'Format baru:\n/addserver_reseller <domain> <auth> <harga_user_1ip> <harga_user_2ip> <harga_reseller_1ip> <harga_reseller_2ip> <nama_server> <quota> <iplimit> <batas_create_akun>\n\n' +
        'Format lama (7 argumen) masih didukung, semua harga akan disamakan.',
        { parse_mode: 'Markdown' }
      );
    }

    let domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas_create_akun;
    if (params.length === 7) {
      [domain, auth, harga1, nama_server, quota, iplimit, batas_create_akun] = params;
      harga2 = harga1;
      hargaRes1 = harga1;
      hargaRes2 = harga1;
    } else {
      [domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas_create_akun] = params;
    }

    if (![harga1, harga2, hargaRes1, hargaRes2, quota, iplimit, batas_create_akun].every(v => /^\d+$/.test(v))) {
      return ctx.reply(' Semua nilai harga/quota/iplimit/batas harus angka.', { parse_mode: 'Markdown' });
    }

    db.run(`INSERT INTO Server (domain, auth, harga, harga_reseller, harga_1ip, harga_2ip, harga_reseller_1ip, harga_reseller_2ip, nama_server, quota, iplimit, batas_create_akun, is_reseller_only, total_create_akun, support_zivpn, support_udp_http, service) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 'ssh')`,
      [
        domain,
        auth,
        parseInt(harga1),
        parseInt(hargaRes1),
        parseInt(harga1),
        parseInt(harga2),
        parseInt(hargaRes1),
        parseInt(hargaRes2),
        nama_server,
        quota,
        iplimit,
        batas_create_akun
      ],
      function (err) {
        if (err) {
          logger.error(' Gagal menambah server reseller:', err.message);
          return ctx.reply(' *Gagal menambah server reseller.*', { parse_mode: 'Markdown' });
        }
        ctx.reply(
          ' *Server khusus reseller berhasil ditambahkan!*\n' +
          `• Harga User 1IP: Rp${parseInt(harga1).toLocaleString('id-ID')}\n` +
          `• Harga User 2IP: Rp${parseInt(harga2).toLocaleString('id-ID')}\n` +
          `• Harga Reseller 1IP: Rp${parseInt(hargaRes1).toLocaleString('id-ID')}\n` +
          `• Harga Reseller 2IP: Rp${parseInt(hargaRes2).toLocaleString('id-ID')}`,
          { parse_mode: 'Markdown' }
        );
      }
    );
  } catch (e) {
    logger.error('Error di /addserver_reseller:', e);
    ctx.reply(' *Terjadi kesalahan.*', { parse_mode: 'Markdown' });
  }
});
//////////
async function broadcastToAllUsers(payload) {
  return new Promise((resolve) => {
    db.all('SELECT user_id FROM users', [], async (err, rows) => {
      if (err) {
        logger.error('Kesalahan saat mengambil daftar pengguna:', err.message);
        return resolve({ ok: 0, fail: 0, error: err.message });
      }

      let ok = 0;
      let fail = 0;
      const DELAY_MS = 35; // ~28 msg/detik, aman di bawah limit Telegram 30/detik

      for (const row of rows || []) {
        try {
          if (payload?.type === 'photo' && payload?.fileId) {
            const options = {};
            if (payload.caption) options.caption = payload.caption;
            await bot.telegram.sendPhoto(row.user_id, payload.fileId, options);
          } else {
            await bot.telegram.sendMessage(row.user_id, String(payload?.text || ''), { parse_mode: payload?.parse_mode || undefined });
          }
          ok++;
        } catch (e) {
          // Retry sekali jika rate limit (429)
          if (e.response && e.response.error_code === 429) {
            const retryAfter = (e.response.parameters && e.response.parameters.retry_after) || 5;
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            try {
              await bot.telegram.sendMessage(row.user_id, String(payload?.text || ''), { parse_mode: payload?.parse_mode || undefined });
              ok++;
            } catch (_) { fail++; }
          } else {
            fail++;
            logger.warn('Gagal kirim broadcast ke ' + row.user_id + ': ' + (e.message || e));
          }
        }
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      resolve({ ok, fail });
    });
  });
}

async function broadcastMessageToAllUsers(message) {
  return broadcastToAllUsers({ type: 'text', text: String(message || '') });
}

async function broadcastMessageToResellers(message) {
  const resellerIds = listResellersSync()
    .map((id) => Number(String(id || '').trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (resellerIds.length === 0) {
    return { ok: 0, fail: 0, total: 0 };
  }

  let ok = 0;
  let fail = 0;
  for (const resellerId of resellerIds) {
    try {
      await bot.telegram.sendMessage(resellerId, message);
      ok += 1;
    } catch (err) {
      fail += 1;
      logger.warn(`Gagal kirim broadcast reseller ke ${resellerId}: ${err.message}`);
    }
  }
  return { ok, fail, total: resellerIds.length };
}

function buildBroadcastPollText(question, options, counts, totalVotes, userChoiceIndex = -1) {
  const lines = ['*Polling Broadcast*', '', question, ''];
  for (let i = 0; i < options.length; i++) {
    const count = Number(counts[i] || 0);
    const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
    const me = userChoiceIndex === i ? ' (pilihan kamu)' : '';
    lines.push((i + 1) + '. ' + options[i] + ' -> ' + count + ' vote (' + pct + '%)' + me);
  }
  lines.push('');
  lines.push('Total vote: ' + totalVotes);
  return lines.join('\n');
}

function buildBroadcastPollKeyboard(pollId, options) {
  const rows = options.map((opt, idx) => ([{ text: opt, callback_data: 'bpv_' + pollId + '_' + idx }]));
  rows.push([{ text: 'Refresh Hasil', callback_data: 'bpr_' + pollId }]);
  return { inline_keyboard: rows };
}

async function createBroadcastPoll(question, options, createdBy) {
  const now = Date.now();
  const result = await dbRunAsync(
    'INSERT INTO broadcast_polls (question, options_json, created_by, created_at, is_active) VALUES (?, ?, ?, ?, 1)',
    [question, JSON.stringify(options), Number(createdBy || 0), now]
  );
  return result.lastID;
}

async function getBroadcastPollById(pollId) {
  const rows = await dbAllAsync(
    'SELECT id, question, options_json, is_active FROM broadcast_polls WHERE id = ? LIMIT 1',
    [pollId]
  );
  const row = rows[0];
  if (!row) return null;
  let options = [];
  try {
    const parsed = JSON.parse(row.options_json || '[]');
    options = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    options = [];
  }
  return {
    id: Number(row.id),
    question: String(row.question || ''),
    isActive: Number(row.is_active || 0) === 1,
    options
  };
}

async function getBroadcastPollStats(pollId, optionCount) {
  const rows = await dbAllAsync(
    'SELECT option_index, COUNT(*) as c FROM broadcast_poll_votes WHERE poll_id = ? GROUP BY option_index',
    [pollId]
  );
  const counts = new Array(optionCount).fill(0);
  let total = 0;
  for (const row of rows) {
    const idx = Number(row.option_index);
    const c = Number(row.c || 0);
    if (idx >= 0 && idx < optionCount) {
      counts[idx] = c;
      total += c;
    }
  }
  return { counts, total };
}

async function getUserBroadcastPollChoice(pollId, userId) {
  const rows = await dbAllAsync(
    'SELECT option_index FROM broadcast_poll_votes WHERE poll_id = ? AND user_id = ? LIMIT 1',
    [pollId, userId]
  );
  if (!rows[0]) return -1;
  return Number(rows[0].option_index);
}

async function upsertBroadcastPollVote(pollId, userId, optionIndex) {
  const now = Date.now();
  await dbRunAsync('DELETE FROM broadcast_poll_votes WHERE poll_id = ? AND user_id = ?', [pollId, userId]);
  await dbRunAsync(
    'INSERT INTO broadcast_poll_votes (poll_id, user_id, option_index, voted_at) VALUES (?, ?, ?, ?)',
    [pollId, userId, optionIndex, now]
  );
}

const BROADCAST_POLL_RETENTION_DAYS = 7;

async function cleanupOldBroadcastPolls(retentionDays = BROADCAST_POLL_RETENTION_DAYS) {
  try {
    const threshold = Date.now() - (Math.max(1, Number(retentionDays) || 7) * 24 * 60 * 60 * 1000);
    const oldRows = await dbAllAsync(
      'SELECT id FROM broadcast_polls WHERE COALESCE(created_at, 0) > 0 AND created_at < ?',
      [threshold]
    );
    if (!oldRows.length) return 0;

    const ids = oldRows.map(r => Number(r.id)).filter(Number.isFinite);
    if (!ids.length) return 0;

    await dbRunAsync('BEGIN IMMEDIATE TRANSACTION');
    for (const id of ids) {
      await dbRunAsync('DELETE FROM broadcast_poll_votes WHERE poll_id = ?', [id]);
      await dbRunAsync('DELETE FROM broadcast_polls WHERE id = ?', [id]);
    }
    await dbRunAsync('COMMIT');

    logger.info('Cleanup polling broadcast: ' + ids.length + ' polling lama dihapus');
    return ids.length;
  } catch (err) {
    try { await dbRunAsync('ROLLBACK'); } catch (_) {}
    logger.error('Gagal cleanup polling broadcast:', err.message);
    return 0;
  }
}

async function broadcastPollToAllUsers(question, options, createdBy = 0) {
  const pollId = await createBroadcastPoll(question, options, createdBy);
  const stats = await getBroadcastPollStats(pollId, options.length);
  const text = buildBroadcastPollText(question, options, stats.counts, stats.total, -1);
  const keyboard = buildBroadcastPollKeyboard(pollId, options);

  return new Promise((resolve) => {
    db.all('SELECT user_id FROM users', [], async (err, rows) => {
      if (err) {
        logger.error('Kesalahan saat mengambil daftar pengguna untuk polling:', err.message);
        return resolve({ ok: 0, fail: 0, pollId, error: err.message });
      }

      let ok = 0;
      let fail = 0;

      for (const row of rows || []) {
        try {
          await bot.telegram.sendMessage(row.user_id, text, { parse_mode: 'Markdown', reply_markup: keyboard });
          ok++;
        } catch (e) {
          fail++;
          logger.warn('Gagal kirim poll ke ' + row.user_id + ': ' + (e.message || e));
        }
      }

      resolve({ ok, fail, pollId });
    });
  });
}

//////////
bot.action(/bpv_(\d+)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const pollId = Number(ctx.match[1]);
  const optionIndex = Number(ctx.match[2]);
  const userId = Number(ctx.from.id);

  try {
    const poll = await getBroadcastPollById(pollId);
    if (!poll || !poll.isActive) {
      return ctx.reply('Polling tidak ditemukan atau sudah ditutup.');
    }

    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
      return ctx.reply('Opsi polling tidak valid.');
    }

    await upsertBroadcastPollVote(pollId, userId, optionIndex);
    const stats = await getBroadcastPollStats(pollId, poll.options.length);
    const myChoice = await getUserBroadcastPollChoice(pollId, userId);
    const text = buildBroadcastPollText(poll.question, poll.options, stats.counts, stats.total, myChoice);
    const keyboard = buildBroadcastPollKeyboard(pollId, poll.options);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch (e) {
    const errText = String(
      e?.response?.description ||
      e?.description ||
      e?.message ||
      e
    );

    if (/message is not modified/i.test(errText)) {
      return ctx.answerCbQuery('Belum ada perubahan hasil.', { show_alert: false }).catch(() => {});
    }

    logger.error('Error vote broadcast poll: ' + errText);
    await ctx.reply('Terjadi kesalahan saat menyimpan vote.');
  }
});

bot.action(/bpr_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const pollId = Number(ctx.match[1]);
  const userId = Number(ctx.from.id);

  try {
    const poll = await getBroadcastPollById(pollId);
    if (!poll || !poll.isActive) {
      return ctx.reply('Polling tidak ditemukan atau sudah ditutup.');
    }

    const stats = await getBroadcastPollStats(pollId, poll.options.length);
    const myChoice = await getUserBroadcastPollChoice(pollId, userId);
    const text = buildBroadcastPollText(poll.question, poll.options, stats.counts, stats.total, myChoice);
    const keyboard = buildBroadcastPollKeyboard(pollId, poll.options);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch (e) {
    const errText = String(
      e?.response?.description ||
      e?.description ||
      e?.message ||
      e
    );

    if (/message is not modified/i.test(errText)) {
      return ctx.answerCbQuery('Belum ada perubahan hasil.', { show_alert: false }).catch(() => {});
    }

    logger.error('Error refresh broadcast poll: ' + errText);
    await ctx.reply('Terjadi kesalahan saat refresh hasil polling.');
  }
});

bot.command('broadcast', async (ctx) => {
  const userId = ctx.message.from.id;
  logger.info(`Broadcast command received from user_id: ${userId}`);
  if (!adminIds.includes(userId)) {
      logger.info(` User ${userId} tidak memiliki izin untuk menggunakan perintah ini.`);
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const commandPattern = /^\/broadcast(?:@\w+)?\s*/i;
  const rawText = ctx.message.text || '';
  const repliedMessage = ctx.message.reply_to_message || null;
  const sourcePhoto = repliedMessage?.photo?.length
    ? repliedMessage.photo[repliedMessage.photo.length - 1]
    : (ctx.message.photo?.length ? ctx.message.photo[ctx.message.photo.length - 1] : null);

  if (sourcePhoto?.file_id) {
    const rawCaption = repliedMessage
      ? (repliedMessage.caption || repliedMessage.text || '')
      : (ctx.message.caption || '');
    const caption = repliedMessage ? rawCaption : rawCaption.replace(commandPattern, '').trim();
    const result = await broadcastToAllUsers({
      type: 'photo',
      fileId: sourcePhoto.file_id,
      caption: caption || ''
    });

    return ctx.reply(
      ' Broadcast foto selesai.\n' +
      '- Berhasil: ' + result.ok + '\n' +
      '- Gagal: ' + result.fail
    );
  }

  const message = repliedMessage
    ? (repliedMessage.text || repliedMessage.caption || '')
    : rawText.replace(commandPattern, '');

  if (!String(message || '').trim()) {
      logger.info(' Pesan untuk disiarkan tidak diberikan.');
      return ctx.reply(
        ' Mohon berikan pesan untuk disiarkan.\n' +
        'Kamu juga bisa kirim foto + caption pakai /broadcast.',
        { parse_mode: 'Markdown' }
      );
  }

  const result = await broadcastMessageToAllUsers(String(message).trim());
  return ctx.reply(
    ' Broadcast pesan selesai.\n' +
    '- Berhasil: ' + result.ok + '\n' +
    '- Gagal: ' + result.fail
  );
});

bot.on('photo', async (ctx, next) => {
  try {
    const caption = String(ctx.message?.caption || '').trim();
    if (!/^\/broadcast(?:@\w+)?(\s|$)/i.test(caption)) {
      return next();
    }

    const userId = Number(ctx.message?.from?.id || 0);
    if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
    }

    const photos = ctx.message?.photo || [];
    const sourcePhoto = photos.length ? photos[photos.length - 1] : null;
    if (!sourcePhoto?.file_id) {
      return ctx.reply(' Foto tidak ditemukan. Coba kirim ulang.');
    }

    const textCaption = caption.replace(/^\/broadcast(?:@\w+)?\s*/i, '').trim();
    const result = await broadcastToAllUsers({
      type: 'photo',
      fileId: sourcePhoto.file_id,
      caption: textCaption
    });

    return ctx.reply(
      ' Broadcast foto selesai.\n' +
      '- Berhasil: ' + result.ok + '\n' +
      '- Gagal: ' + result.fail
    );
  } catch (err) {
    logger.error('Gagal proses broadcast foto dari caption:', err.message || err);
    return ctx.reply(' Terjadi kesalahan saat broadcast foto.');
  }
});

bot.command('broadcastreseller', async (ctx) => {
  const userId = Number(ctx.message?.from?.id || 0);
  if (!adminIds.includes(userId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const rawText = ctx.message.text || '';
  const message = ctx.message.reply_to_message
    ? (ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || '')
    : rawText.replace(/^\/broadcastreseller(?:@\w+)?\s*/i, '');

  if (!message || !String(message).trim()) {
    return ctx.reply(
      ' Mohon berikan pesan untuk reseller.\n\n' +
      'Contoh:\n`/broadcastreseller Halo reseller, ada update harga.`',
      { parse_mode: 'Markdown' }
    );
  }

  const result = await broadcastMessageToResellers(String(message).trim());
  if (result.total === 0) {
    return ctx.reply('ℹ Belum ada reseller terdaftar.');
  }

  return ctx.reply(
    ` Broadcast reseller selesai.\n` +
    `- Total reseller: ${result.total}\n` +
    `- Berhasil: ${result.ok}\n` +
    `- Gagal: ${result.fail}`
  );
});


bot.command('broadcastpoll', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  const rawText = (ctx.message.text || '').replace(/^\/broadcastpoll(?:@\w+)?\s*/i, '').trim();
  const sourceText = ctx.message.reply_to_message
    ? ((ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || '').trim())
    : rawText;

  if (!sourceText) {
    return ctx.reply(
      'Format: /broadcastpoll Pertanyaan | Opsi A | Opsi B [| Opsi C ...]\n' +
      'Minimal 2 opsi, maksimal 10 opsi.'
    );
  }

  const parts = sourceText.split('|').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) {
    return ctx.reply('Format salah. Minimal: Pertanyaan | Opsi A | Opsi B');
  }

  const question = parts[0];
  const options = parts.slice(1, 11);

  if (question.length < 5) {
    return ctx.reply('Pertanyaan terlalu pendek. Minimal 5 karakter.');
  }

  if (options.length < 2) {
    return ctx.reply('Opsi polling minimal 2 pilihan.');
  }

  const pollResult = await broadcastPollToAllUsers(question, options, userId);

  return ctx.reply(
    'Polling siaran selesai.\n' +
    '- Berhasil: ' + pollResult.ok + '\n' +
    '- Gagal: ' + pollResult.fail + '\n' +
    '- ID Polling: ' + pollResult.pollId + '\n\n' +
    'Hasil polling ini bersifat global (gabungan semua user).'
  );
});
//command addserver biasa potato//command addserver biasa potato
bot.command('addserver', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  const params = parts.slice(1);

  // Format baru: wajib dua harga user + dua harga reseller
  // Format lama (7 arg) masih didukung, semua harga disamakan.
  if (!(params.length === 7 || params.length === 10)) {
    return ctx.reply(
      ' Format salah.\n' +
      'Format baru:\n`/addserver <domain> <auth> <harga_user_1ip> <harga_user_2ip> <harga_reseller_1ip> <harga_reseller_2ip> <nama_server> <quota> <iplimit> <batas_create_akun>`\n\n' +
      'Format lama (7 argumen) masih bisa dipakai, semua harga akan disamakan.',
      { parse_mode: 'Markdown' }
    );
  }

  let domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas_create_akun;

  if (params.length === 7) {
    [domain, auth, harga1, nama_server, quota, iplimit, batas_create_akun] = params;
    harga2 = harga1;
    hargaRes1 = harga1;
    hargaRes2 = harga1;
  } else {
    [domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas_create_akun] = params;
  }

  const numberOnlyRegex = /^\d+$/;
  if (
    ![harga1, harga2, hargaRes1, hargaRes2, quota, iplimit, batas_create_akun].every(v => numberOnlyRegex.test(v))
  ) {
    return ctx.reply(' Semua nilai harga/quota/iplimit/batas harus berupa angka.', { parse_mode: 'Markdown' });
  }

  const service = userState[ctx.chat.id]?.service || 'ssh';
  const hargaInt1 = parseInt(harga1);
  const hargaInt2 = parseInt(harga2);
  const hargaResInt1 = parseInt(hargaRes1);
  const hargaResInt2 = parseInt(hargaRes2);

  db.run(
    "INSERT INTO Server (domain, auth, harga, harga_reseller, harga_1ip, harga_2ip, harga_reseller_1ip, harga_reseller_2ip, nama_server, quota, iplimit, batas_create_akun, total_create_akun, support_zivpn, support_udp_http, service) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)",
    [
      domain,
      auth,
      hargaInt1, // harga dasar = harga paket 1IP user
      hargaResInt1,
      hargaInt1,
      hargaInt2,
      hargaResInt1,
      hargaResInt2,
      nama_server,
      parseInt(quota),
      parseInt(iplimit),
      parseInt(batas_create_akun),
      service
    ],
    function (err) {
      if (err) {
        logger.error(' Kesalahan saat menambahkan server:', err.message);
        return ctx.reply(' Kesalahan saat menambahkan server.', { parse_mode: 'Markdown' });
      }

      delete userState[ctx.chat.id];

      ctx.reply(
        ` Server \`${nama_server}\` berhasil ditambahkan.\n` +
        `• Harga User 1IP: Rp${hargaInt1.toLocaleString('id-ID')}\n` +
        `• Harga User 2IP: Rp${hargaInt2.toLocaleString('id-ID')}\n` +
        `• Harga Reseller 1IP: Rp${hargaResInt1.toLocaleString('id-ID')}\n` +
        `• Harga Reseller 2IP: Rp${hargaResInt2.toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
      );
    }
  );
});

//command addserver zivpn
bot.command('addserverzivpn', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  const params = parts.slice(1);

  if (!(params.length === 7 || params.length === 10)) {
    return ctx.reply(
      ' Format salah.\n' +
      'Format baru:\n`/addserverzivpn <domain> <auth> <harga_user_1ip> <harga_user_2ip> <harga_reseller_1ip> <harga_reseller_2ip> <nama_server> <quota> <iplimit> <batas_create_akun>`\n\n' +
      'Format lama (7 argumen) masih bisa dipakai, semua harga akan disamakan.',
      { parse_mode: 'Markdown' }
    );
  }

  let domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas_create_akun;

  if (params.length === 7) {
    [domain, auth, harga1, nama_server, quota, iplimit, batas_create_akun] = params;
    harga2 = harga1;
    hargaRes1 = harga1;
    hargaRes2 = harga1;
  } else {
    [domain, auth, harga1, harga2, hargaRes1, hargaRes2, nama_server, quota, iplimit, batas_create_akun] = params;
  }

  const numberOnlyRegex = /^\d+$/;
  if (![harga1, harga2, hargaRes1, hargaRes2, quota, iplimit, batas_create_akun].every(v => numberOnlyRegex.test(v))) {
    return ctx.reply(' Semua nilai harga/quota/iplimit/batas harus berupa angka.');
  }

  db.run(
    "INSERT INTO Server (domain, auth, harga, harga_reseller, harga_1ip, harga_2ip, harga_reseller_1ip, harga_reseller_2ip, nama_server, quota, iplimit, batas_create_akun, total_create_akun, support_zivpn, support_udp_http, service) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, 'ssh')",
    [
      domain,
      auth,
      parseInt(harga1),
      parseInt(hargaRes1),
      parseInt(harga1),
      parseInt(harga2),
      parseInt(hargaRes1),
      parseInt(hargaRes2),
      nama_server,
      parseInt(quota),
      parseInt(iplimit),
      parseInt(batas_create_akun)
    ],
    function (err) {
      if (err) {
        logger.error(' Kesalahan saat menambahkan server ZIVPN:', err.message);
        return ctx.reply(' Kesalahan saat menambahkan server ZIVPN.');
      }

      ctx.reply(
        ` Server ZIVPN \`${nama_server}\` berhasil ditambahkan.\n` +
        `• Harga User 1IP: Rp${parseInt(harga1).toLocaleString('id-ID')}\n` +
        `• Harga User 2IP: Rp${parseInt(harga2).toLocaleString('id-ID')}\n` +
        `• Harga Reseller 1IP: Rp${parseInt(hargaRes1).toLocaleString('id-ID')}\n` +
        `• Harga Reseller 2IP: Rp${parseInt(hargaRes2).toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
      );
    }
  );
});

//////
bot.command('editharga', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/editharga <domain> <harga>`', { parse_mode: 'Markdown' });
  }

  const [domain, harga] = args.slice(1);

  if (!/^\d+$/.test(harga)) {
      return ctx.reply(' `harga` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("INSERT INTO Server (domain, auth, harga, nama_server, quota, iplimit, batas_create_akun, total_create_akun, support_zivpn, support_udp_http, service) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'ssh')", 
      [domain, auth, parseInt(harga), nama_server, parseInt(quota), parseInt(iplimit), parseInt(batas_create_akun)], function(err) {
      if (err) {
          logger.error(' Kesalahan saat menambahkan server:', err.message);
          return ctx.reply(' Kesalahan saat menambahkan server.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Server \`${nama_server}\` berhasil ditambahkan.`, { parse_mode: 'Markdown' });
  });
});


bot.command('editnama', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/editnama <domain> <nama_server>`', { parse_mode: 'Markdown' });
  }

  const [domain, nama_server] = args.slice(1);

  db.run("UPDATE Server SET nama_server = ? WHERE domain = ?", [nama_server, domain], function(err) {
      if (err) {
          logger.error(' Kesalahan saat mengedit nama server:', err.message);
          return ctx.reply(' Kesalahan saat mengedit nama server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply(' Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Nama server \`${domain}\` berhasil diubah menjadi \`${nama_server}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editdomain', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/editdomain <old_domain> <new_domain>`', { parse_mode: 'Markdown' });
  }

  const [old_domain, new_domain] = args.slice(1);

  db.run("UPDATE Server SET domain = ? WHERE domain = ?", [new_domain, old_domain], function(err) {
      if (err) {
          logger.error(' Kesalahan saat mengedit domain server:', err.message);
          return ctx.reply(' Kesalahan saat mengedit domain server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply(' Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Domain server \`${old_domain}\` berhasil diubah menjadi \`${new_domain}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editauth', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/editauth <domain> <auth>`', { parse_mode: 'Markdown' });
  }

  const [domain, auth] = args.slice(1);

  db.run("UPDATE Server SET auth = ? WHERE domain = ?", [auth, domain], function(err) {
      if (err) {
          logger.error(' Kesalahan saat mengedit auth server:', err.message);
          return ctx.reply(' Kesalahan saat mengedit auth server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply(' Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Auth server \`${domain}\` berhasil diubah menjadi \`${auth}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editlimitquota', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/editlimitquota <domain> <quota>`', { parse_mode: 'Markdown' });
  }

  const [domain, quota] = args.slice(1);

  if (!/^\d+$/.test(quota)) {
      return ctx.reply(' `quota` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET quota = ? WHERE domain = ?", [parseInt(quota), domain], function(err) {
      if (err) {
          logger.error(' Kesalahan saat mengedit quota server:', err.message);
          return ctx.reply(' Kesalahan saat mengedit quota server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply(' Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Quota server \`${domain}\` berhasil diubah menjadi \`${quota}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editlimitip', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/editlimitip <domain> <iplimit>`', { parse_mode: 'Markdown' });
  }

  const [domain, iplimit] = args.slice(1);

  if (!/^\d+$/.test(iplimit)) {
      return ctx.reply(' `iplimit` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET iplimit = ? WHERE domain = ?", [parseInt(iplimit), domain], function(err) {
      if (err) {
          logger.error(' Kesalahan saat mengedit iplimit server:', err.message);
          return ctx.reply(' Kesalahan saat mengedit iplimit server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply(' Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Iplimit server \`${domain}\` berhasil diubah menjadi \`${iplimit}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editlimitcreate', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/editlimitcreate <domain> <batas_create_akun>`', { parse_mode: 'Markdown' });
  }

  const [domain, batas_create_akun] = args.slice(1);

  if (!/^\d+$/.test(batas_create_akun)) {
      return ctx.reply(' `batas_create_akun` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET batas_create_akun = ? WHERE domain = ?", [parseInt(batas_create_akun), domain], function(err) {
      if (err) {
          logger.error(' Kesalahan saat mengedit batas_create_akun server:', err.message);
          return ctx.reply(' Kesalahan saat mengedit batas_create_akun server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply(' Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Batas create akun server \`${domain}\` berhasil diubah menjadi \`${batas_create_akun}\`.`, { parse_mode: 'Markdown' });
  });
});
bot.command('edittotalcreate', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply(' Format salah. Gunakan: `/edittotalcreate <domain> <total_create_akun>`', { parse_mode: 'Markdown' });
  }

  const [domain, total_create_akun] = args.slice(1);

  if (!/^\d+$/.test(total_create_akun)) {
      return ctx.reply(' `total_create_akun` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET total_create_akun = ? WHERE domain = ?", [parseInt(total_create_akun), domain], function(err) {
      if (err) {
          logger.error(' Kesalahan saat mengedit total_create_akun server:', err.message);
          return ctx.reply(' Kesalahan saat mengedit total_create_akun server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply(' Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(` Total create akun server \`${domain}\` berhasil diubah menjadi \`${total_create_akun}\`.`, { parse_mode: 'Markdown' });
  });
});
async function handleServiceAction(ctx, action) {
  let keyboard;
  if (action === 'create') {
    keyboard = [
      [{ text: 'Buat UDP ZIVPN', callback_data: 'create_zivpn' }],
      [
        { text: 'Buat Ssh/Ovpn', callback_data: 'create_ssh' },
        { text: 'Buat UDP HC', callback_data: 'create_udp_http' }
      ],
      [{ text: 'Buat Vmess', callback_data: 'create_vmess' }, { text: 'Buat Vless', callback_data: 'create_vless' }],
      [{ text: 'Buat Trojan', callback_data: 'create_trojan' }, { text: 'Kembali', callback_data: 'send_main_menu' }]
    ];
  } else if (action === 'trial') {
    keyboard = [
      [{ text: 'Trial UDP ZIVPN', callback_data: 'trial_zivpn' }],
      [
        { text: 'Trial Ssh/Ovpn', callback_data: 'trial_ssh' },
        { text: 'Trial UDP HTTP', callback_data: 'trial_udp_http' }
      ],
      [{ text: 'Trial Vmess', callback_data: 'trial_vmess' }, { text: 'Trial Vless', callback_data: 'trial_vless' }],
      [{ text: 'Trial Trojan', callback_data: 'trial_trojan' }, { text: 'Kembali', callback_data: 'send_main_menu' }]
    ];
  } else if (action === 'renew') {
    keyboard = [
      [{ text: 'Perpanjang UDP ZIVPN', callback_data: 'renew_zivpn' }],
      [
        { text: 'Perpanjang Ssh/Ovpn', callback_data: 'renew_ssh' },
        { text: 'Perpanjang UDP HTTP', callback_data: 'renew_udp_http' }
      ],
      [{ text: 'Perpanjang Vmess', callback_data: 'renew_vmess' }, { text: 'Perpanjang Vless', callback_data: 'renew_vless' }],
      [{ text: 'Perpanjang Trojan', callback_data: 'renew_trojan' }, { text: 'Kembali', callback_data: 'send_main_menu' }]
    ];
  } else if (action === 'del') {
    keyboard = [
      [
        { text: 'Hapus Ssh/Ovpn', callback_data: 'del_ssh' },
        { text: 'Hapus UDP HTTP', callback_data: 'del_udp_http' }
      ],
      [{ text: 'Hapus UDP ZIVPN', callback_data: 'del_zivpn' }],
      [{ text: 'Hapus Vmess', callback_data: 'del_vmess' }, { text: 'Hapus Vless', callback_data: 'del_vless' }],
      [{ text: 'Hapus Trojan', callback_data: 'del_trojan' }, { text: 'Kembali', callback_data: 'send_main_menu' }]
    ];
  } else if (action === 'lock') {
    keyboard = [
      [
        { text: 'Lock Ssh/Ovpn', callback_data: 'lock_ssh' },
        { text: 'Lock UDP HTTP', callback_data: 'lock_udp_http' }
      ],
      [{ text: 'Lock Vmess', callback_data: 'lock_vmess' }, { text: 'Lock Vless', callback_data: 'lock_vless' }],
      [{ text: 'Lock Trojan', callback_data: 'lock_trojan' }, { text: 'Kembali', callback_data: 'send_main_menu' }]
    ];
  } else if (action === 'unlock') {
    keyboard = [
      [
        { text: 'Unlock Ssh/Ovpn', callback_data: 'unlock_ssh' },
        { text: 'Unlock UDP HTTP', callback_data: 'unlock_udp_http' }
      ],
      [{ text: 'Unlock Vmess', callback_data: 'unlock_vmess' }, { text: 'Unlock Vless', callback_data: 'unlock_vless' }],
      [{ text: 'Unlock Trojan', callback_data: 'unlock_trojan' }, { text: 'Kembali', callback_data: 'send_main_menu' }]
    ];
  }
  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: keyboard
    });
    logger.info(`${action} service menu sent`);
  } catch (error) {
    if (error.response && error.response.error_code === 400) {
      await ctx.reply(`Pilih jenis layanan yang ingin Anda ${action}:`, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      logger.info(`${action} service menu sent as new message`);
    } else {
      logger.error(`Error saat mengirim menu ${action}:`, error);
    }
  }
}
async function sendAdminMenu(ctx) {
  const adminKeyboard = [
    // ── Manajemen ─────────────────────────────
    [{ text: '🖥️ Server', callback_data: 'admin_menu_server' },
     { text: '💰 Saldo & Topup', callback_data: 'admin_menu_saldo' }],
    [{ text: '🤝 Reseller', callback_data: 'admin_menu_reseller' },
     { text: '👥 User', callback_data: 'admin_menu_user' }],
    // ── Markup ────────────────────────────────
    [{ text: '📈 Markup', callback_data: 'admin_menu_markup' }],
    // ── Backup ────────────────────────────────
    [{ text: '💾 Backup & Restore', callback_data: 'admin_menu_backup' }],
    // ── Laporan ───────────────────────────────
    [{ text: '📊 Dashboard & Laporan', callback_data: 'admin_menu_laporan' }],
    // ── Tools & Setting ───────────────────────
    [{ text: '🔧 Tools', callback_data: 'admin_menu_tools' },
     { text: '⚙️ Setting', callback_data: 'admin_menu_setting' }],
    [{ text: '🔔 Notifikasi', callback_data: 'admin_menu_notif' }],
    [{ text: '🔙 Kembali', callback_data: 'send_main_menu' }]
  ];

  try {
    await ctx.editMessageText('👑 *MENU ADMIN*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: adminKeyboard
      }
    });
    logger.info('Admin menu sent');
  } catch (error) {
    if (error.response && error.response.error_code === 400) {
      try {
        await ctx.reply('👑 *MENU ADMIN*', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: adminKeyboard
          }
        });
        logger.info('Admin menu sent as new message');
      } catch (sendError) {
        logger.error('Error sending admin menu as new message:', sendError);
      }
    } else {
      logger.error('Error saat mengirim menu admin:', error);
    }
  }
}

async function sendServerIpLimitProtocolMenu(ctx, serverId, serverName) {
  const server = await dbGetAsync('SELECT id, nama_server, domain FROM Server WHERE id = ?', [serverId]).catch(() => null);
  if (!server) {
    return ctx.reply('Server tidak ditemukan.');
  }

  const currentRows = await dbAllAsync(
    'SELECT protocol, ip_package, iplimit FROM server_iplimit_rules WHERE server_id = ?',
    [serverId]
  ).catch(() => []);

  const currentMap = new Map();
  currentRows.forEach((row) => {
    const protocol = normalizeIpLimitProtocol(row.protocol);
    const pkg = Number(row.ip_package || 0) === 2 ? 2 : 1;
    if (!currentMap.has(protocol)) currentMap.set(protocol, {});
    currentMap.get(protocol)[pkg] = Number(row.iplimit || 0);
  });

  const lines = SERVER_IPLIMIT_PROTOCOLS.map((item) => {
    const values = currentMap.get(item.key) || {};
    const oneIp = Number.isFinite(values[1]) && values[1] >= 0 ? values[1] : getDefaultServerIpLimit(item.key, 1);
    const twoIp = Number.isFinite(values[2]) && values[2] >= 0 ? values[2] : getDefaultServerIpLimit(item.key, 2);
    return `- ${item.label}: 1IP=${oneIp}, 2IP=${twoIp}`;
  });

  const keyboard = [];
  for (let i = 0; i < SERVER_IPLIMIT_PROTOCOLS.length; i += 2) {
    keyboard.push(SERVER_IPLIMIT_PROTOCOLS.slice(i, i + 2).map((item) => ({
      text: item.label,
      callback_data: `edit_server_iplimit_rules_protocol_${serverId}_${item.key}`
    })));
  }
  keyboard.push([{ text: ' Kembali', callback_data: 'editserver_iplimit_rules' }]);

  await ctx.reply(
    `Pilih protocol untuk server:\n*${serverName || server.nama_server || server.domain || `ID ${serverId}`}*\n\n` +
    'Saat ini:\n' + lines.join('\n') + '\n\n' +
    'Setelah pilih protocol, kirim nilai IP untuk paket 1IP lalu 2IP.',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
  );
}

bot.action('admin_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await sendAdminMenu(ctx);
});

// ── Task 7.2 — Handler Setting API Keys ────────────────────────────────────
bot.action('admin_setting_api', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const isAdminUser = Array.isArray(adminIds) ? adminIds.includes(userId) : Number(adminIds) === userId;
  if (!isAdminUser) return ctx.answerCbQuery('Tidak ada izin!', { show_alert: true });

  const fayuStatus = FAYU_API_KEY      ? '' : '';
  const khfyStatus = KHFY_API_KEY      ? '' : '';
  const qrisStatus = (GOPAY_API_KEY || API_KEY || MERCHANT_ID) ? '' : '';
  const webhookBase      = WEBHOOK_URL ? WEBHOOK_URL.replace(/\/$/, '') : `http://YOUR_DOMAIN:${port}`;
  const webhookAkrab     = `${webhookBase}/webhook/akrab`;

  const msgText =
    ` <b>Setting API Keys & Konfigurasi</b>\n\n` +
    `${fayuStatus} FayuPedia SMM\n` +
    `${khfyStatus} Akrab\n` +
    `${qrisStatus} Payment Gateway\n\n` +
    ` <b>Webhook URLs:</b>\n` +
    `Akrab     : <code>${webhookAkrab}</code>\n` +
    (WEBHOOK_URL ? '' : `\n Set <b>Webhook URL</b> dulu agar URL di atas benar.\n`) +
    `\nPilih yang ingin diupdate:`;
  const replyMarkup = { inline_keyboard: [
    [{ text: `${fayuStatus} FayuPedia SMM`,   callback_data: 'setting_fayu'                    }],
    [{ text: `${khfyStatus} Akrab`,           callback_data: 'setting_khfy'                    }],
    [{ text: `${qrisStatus} Payment Gateway`, callback_data: 'payment_gateway_settings_menu'   }],
    [{ text: ' Set Webhook URL',            callback_data: 'setting_webhook_url'             }],
    [{ text: ' Menu Admin',                 callback_data: 'admin_menu'                      }]
  ]};

  await ctx.editMessageText(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup })
    .catch(async () => { await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup }); });
});

// ── Setting FayuPedia ───────────────────────────────────────────────────────
bot.action('setting_fayu', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const msgText =
    ` <b>FayuPedia SMM</b>\n\n` +
    `API ID saat ini: <code>${FAYU_API_ID || '-'}</code>\n` +
    `API Key: <code>${maskSecret(FAYU_API_KEY)}</code>\n\n` +
    `Pilih yang ingin diupdate:`;
  const replyMarkup = { inline_keyboard: [
    [{ text: 'Ganti API ID',  callback_data: 'setting_fayu_api_id'  }],
    [{ text: 'Ganti API Key', callback_data: 'setting_fayu_api_key' }],
    [{ text: ' Kembali',   callback_data: 'admin_setting_api'    }]
  ]};
  await ctx.editMessageText(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup })
    .catch(async () => { await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup }); });
});

bot.action('setting_fayu_api_id', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  userState[ctx.from.id] = { step: 'setting_input_fayu_api_id' };
  await ctx.editMessageText('Masukkan FayuPedia API ID baru:',
    { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_fayu' }]] }})
    .catch(async () => { await ctx.reply('Masukkan FayuPedia API ID baru:',
      { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_fayu' }]] }}); });
});

bot.action('setting_fayu_api_key', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  userState[ctx.from.id] = { step: 'setting_input_fayu_api_key' };
  await ctx.editMessageText('Masukkan FayuPedia API Key baru:',
    { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_fayu' }]] }})
    .catch(async () => { await ctx.reply('Masukkan FayuPedia API Key baru:',
      { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_fayu' }]] }}); });
});

// ── Setting Akrab (khfy) ────────────────────────────────────────────────────
bot.action('setting_khfy', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const msgText =
    ` <b>Akrab (khfy-store)</b>\n\n` +
    `API Key: <code>${maskSecret(KHFY_API_KEY)}</code>\n` +
    `Reseller ID: <code>${KHFY_RESELLER_ID || '-'}</code>\n\n` +
    `Pilih yang ingin diupdate:`;
  const replyMarkup = { inline_keyboard: [
    [{ text: 'Ganti API Key',     callback_data: 'setting_khfy_api_key'     }],
    [{ text: 'Ganti Reseller ID', callback_data: 'setting_khfy_reseller_id' }],
    [{ text: ' Kembali',        callback_data: 'admin_setting_api'        }]
  ]};
  await ctx.editMessageText(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup })
    .catch(async () => { await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup }); });
});

bot.action('setting_khfy_api_key', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  userState[ctx.from.id] = { step: 'setting_input_khfy_api_key' };
  await ctx.editMessageText('Masukkan Akrab API Key baru:',
    { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_khfy' }]] }})
    .catch(async () => { await ctx.reply('Masukkan Akrab API Key baru:',
      { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_khfy' }]] }}); });
});

bot.action('setting_khfy_reseller_id', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  userState[ctx.from.id] = { step: 'setting_input_khfy_reseller_id' };
  await ctx.editMessageText('Masukkan Reseller ID baru (contoh: NF01576):',
    { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_khfy' }]] }})
    .catch(async () => { await ctx.reply('Masukkan Reseller ID baru (contoh: NF01576):',
      { reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'setting_khfy' }]] }}); });
});

// ── Setting Webhook URL ─────────────────────────────────────────────────────
bot.action('setting_webhook_url', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const isAdminUser = Array.isArray(adminIds) ? adminIds.includes(ctx.from.id) : Number(adminIds) === ctx.from.id;
  if (!isAdminUser) return;
  userState[ctx.from.id] = { step: 'setting_input_webhook_url' };
  const msgText =
    ` <b>Set Webhook URL</b>\n\n` +
    `URL saat ini: <code>${WEBHOOK_URL || '(belum diset)'}</code>\n\n` +
    `Masukkan URL publik bot (HTTPS direkomendasikan).\n` +
    `Contoh: <code>https://bot.domain.com</code>\n\n` +
    `Bot akan otomatis generate:\n` +
    `• <code>/webhook/akrab</code> untuk Akrab`;
  await ctx.editMessageText(msgText, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'admin_setting_api' }]] }
  }).catch(async () => { await ctx.reply(msgText, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: ' Batal', callback_data: 'admin_setting_api' }]] }
  }); });
});

// ── Task 7.4 — Handler Markup Global Produk ────────────────────────────────
bot.action('admin_markup_global_menu', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const isAdminUser = Array.isArray(adminIds) ? adminIds.includes(userId) : Number(adminIds) === userId;
  if (!isAdminUser) return ctx.answerCbQuery('Tidak ada izin!', { show_alert: true });

  const markupSMM   = await dbH.getMarkup(db, 'global', 'smm',   null).catch(() => null);
  const markupAkrab = await dbH.getMarkup(db, 'global', 'akrab', null).catch(() => null);
  const fmtM = m => m ? (m.type === 'pct' ? m.value + '%' : 'Rp ' + Number(m.value).toLocaleString('id-ID')) : 'Tidak ada';

  const msgText =
    ` <b>Markup Global Produk</b>\n\n` +
    `SMM  : ${fmtM(markupSMM)}\n` +
    `Akrab: ${fmtM(markupAkrab)}`;
  const replyMarkup = { inline_keyboard: [
    [{ text: '🔙 Kembali ke Markup', callback_data: 'admin_menu_markup' }]
  ]};

  await ctx.editMessageText(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup })
    .catch(async () => { await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: replyMarkup }); });
});

async function sendAdminServerMenu(ctx) {
  const keyboard = [
    [{ text: '➕ Add Server', callback_data: 'addserver' }],
    [{ text: '⚙️ Kelola Server', callback_data: 'admin_manage_server' }],
    [{ text: '📡 Cek Bandwidth Server', callback_data: 'admin_check_bandwidth_servers' }],
    [{ text: '✏️ Edit Nama', callback_data: 'nama_server_edit' }],
    [
      { text: '💵 Harga User 1IP', callback_data: 'editserver_harga_1ip' },
      { text: '💵 Harga User 2IP', callback_data: 'editserver_harga_2ip' }
    ],
    [
      { text: '💰 Harga Reseller 1IP', callback_data: 'editserver_harga_reseller_1ip' },
      { text: '💰 Harga Reseller 2IP', callback_data: 'editserver_harga_reseller_2ip' }
    ],
    [{ text: '⏱️ Atur Harga Masa Aktif', callback_data: 'editserver_price_duration' }],
    [
      { text: '🌐 Edit Domain', callback_data: 'editserver_domain' },
      { text: '🔑 Edit Auth', callback_data: 'editserver_auth' }
    ],
    [
      { text: '📦 Edit Quota', callback_data: 'editserver_quota' },
      { text: '🔒 Edit Limit IP', callback_data: 'editserver_limit_ip' }
    ],
    [
      { text: '📋 List Server', callback_data: 'listserver' },
      { text: 'ℹ️ Detail Server', callback_data: 'detailserver' }
    ],
    [{ text: '🔧 Atur Limit IP Paket', callback_data: 'editserver_iplimit_rules' }],
    [
      { text: '🗑️ Hapus Server', callback_data: 'deleteserver' },
      { text: '♻️ Reset Server', callback_data: 'resetdb' }
    ],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }]
  ];

  await ctx.editMessageText('🖥️ *MENU SERVER*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendAdminSaldoMenu(ctx) {
  const manualEnabled = loadTopupManualSetting();
  const manualLabel = manualEnabled ? ' TopUp Manual: Aktif' : ' TopUp Manual: Nonaktif';
  const autoEnabled = loadTopupAutoSetting();
  const autoLabel = autoEnabled ? ' TopUp Otomatis: Aktif' : ' TopUp Otomatis: Nonaktif';
  const scNexusEnabled = loadScNexusMenuSetting();
  const scNexusLabel = scNexusEnabled ? ' Menu SC 1FORCR NEXUS: Aktif' : ' Menu SC 1FORCR NEXUS: Nonaktif';
  const keyboard = [
    [{ text: '🖼️ Upload QRIS', callback_data: 'upload_qris' }],
    [{ text: '🎁 Bonus Topup', callback_data: 'bonus_topup_menu' }],
    [{ text: scNexusLabel, callback_data: 'toggle_sc_nexus_menu' }],
    [{ text: autoLabel, callback_data: 'toggle_topup_auto' }],
    [{ text: manualLabel, callback_data: 'toggle_topup_manual' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }]
  ];

  await ctx.editMessageText('💰 *MENU SALDO*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendAdminResellerMenu(ctx) {
  const keyboard = [
    [
      { text: '➕ Tambah Reseller', callback_data: 'add_reseller_menu' },
      { text: '➖ Hapus Reseller', callback_data: 'del_reseller_menu' }
    ],
    [{ text: '📋 Syarat Reseller', callback_data: 'reseller_terms_menu' }],
    [{ text: '🔍 Trigger Cek Syarat', callback_data: 'reseller_terms_trigger' }],
    [{ text: '♻️ Restore Reseller', callback_data: 'reseller_restore' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }]
  ];

  await ctx.editMessageText('🤝 *MENU RESELLER*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

bot.action('add_reseller_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk melakukan tindakan ini.');
  }
  userState[ctx.chat.id] = { step: 'add_reseller_userid' };
  await ctx.reply('Masukkan ID Telegram user yang ingin dijadikan reseller:');
});

bot.action('del_reseller_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk melakukan tindakan ini.');
  }
  userState[ctx.chat.id] = { step: 'del_reseller_userid' };
  await ctx.reply('Masukkan ID Telegram reseller yang ingin dihapus:');
});

async function sendAdminToolsMenu(ctx) {
  const maintenance = loadMaintenanceSetting();
  const maintenanceLabel = maintenance.enabled
    ? `🔴 Maintenance: ON (${maintenance.estimate || 'estimasi belum diisi'})`
    : '🟢 Maintenance: OFF';
  const testMenuEnabled = loadTestMenuSetting();
  const testMenuLabel = testMenuEnabled ? '🧪 Test Transaksi : ON' : '🧪 Test Transaksi : OFF';
  const joinChannelSetting = loadJoinChannelSetting();
  const joinChannelLabel = joinChannelSetting.enabled
    ? '📢 Wajib Join Channel: ON'
    : '📢 Wajib Join Channel: OFF';
  const keyboard = [
    [{ text: '❓ Help Admin', callback_data: 'helpadmin_menu' }],
    [{ text: '📥 Kelola Download Config', callback_data: 'admin_download_config_menu' }],
    [{ text: '📣 Broadcast Kirim Pesan', callback_data: 'admin_broadcast_menu' }],
    [{ text: '📊 Broadcast Polling', callback_data: 'admin_broadcast_poll_menu' }],
    [{ text: '🔄 Sync Server Sekarang', callback_data: 'admin_sync_server_now' }],
    [{ text: '⏱️ Atur Auto Sync Server', callback_data: 'admin_sync_server_toggle_menu' }],
    [{ text: testMenuLabel, callback_data: 'toggle_test_menu' }],
    [{ text: '🧪 Menu Test Transaksi', callback_data: 'admin_test_menu' }],
    [{ text: '📋 Log Aktivitas Admin', callback_data: 'admin_view_activity_log' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }]
  ];

  await ctx.editMessageText('🛠️ *MENU TOOLS*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

function sanitizeNginxHostInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const withoutScheme = text.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
  return withoutScheme;
}

function buildNginxWebhookConfig(host, appPort = 6969) {
  const safeHost = sanitizeNginxHostInput(host);
  const safePort = Number(appPort) > 0 ? Number(appPort) : 6969;
  return (
`server {
    listen 80;
    server_name ${safeHost};

    location / {
        proxy_pass http://127.0.0.1:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`
  );
}

function isIpv4Host(host) {
  const h = String(host || '').trim();
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(h);
}

function isDomainHost(host) {
  const h = String(host || '').trim();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(h);
}

function setupNginxWebhookAuto(host, appPort = 6969) {
  const safeHost = sanitizeNginxHostInput(host);
  if (!safeHost || !/^[a-zA-Z0-9.-]+$/.test(safeHost)) {
    return { ok: false, message: 'Host/domain tidak valid.' };
  }

  const confName = 'botvpn-webhook.conf';
  const confPath = `/etc/nginx/sites-available/${confName}`;
  const enabledPath = `/etc/nginx/sites-enabled/${confName}`;
  const baseConfig = buildNginxWebhookConfig(safeHost, appPort);

  try {
    fs.writeFileSync(confPath, `${baseConfig}\n`, 'utf8');
    execSync(`ln -sfn ${confPath} ${enabledPath}`, { stdio: 'pipe' });
    execSync('nginx -t', { stdio: 'pipe' });
    execSync('systemctl reload nginx', { stdio: 'pipe' });
  } catch (err) {
    return { ok: false, message: `Gagal setup nginx: ${err.message}` };
  }

  // Jika host berupa IP, SSL Let's Encrypt tidak bisa dipasang.
  if (!isDomainHost(safeHost) || isIpv4Host(safeHost)) {
    return {
      ok: true,
      ssl: false,
      url: `http://${safeHost}/sc1forcr/events/multi-login`,
      message: 'Nginx aktif via HTTP (host berupa IP/non-domain).'
    };
  }

  // Coba issue SSL otomatis untuk domain.
  try {
    execSync(
      `certbot --nginx -d ${safeHost} --non-interactive --agree-tos --register-unsafely-without-email --redirect`,
      { stdio: 'pipe' }
    );
    execSync('nginx -t', { stdio: 'pipe' });
    execSync('systemctl reload nginx', { stdio: 'pipe' });
    return {
      ok: true,
      ssl: true,
      url: `https://${safeHost}/sc1forcr/events/multi-login`,
      message: 'Nginx + SSL aktif (HTTPS).'
    };
  } catch (err) {
    return {
      ok: true,
      ssl: false,
      url: `http://${safeHost}/sc1forcr/events/multi-login`,
      message: `SSL gagal dipasang (${err.message}). Fallback ke HTTP.`
    };
  }
}

async function sendNginxWebhookMenu(ctx) {
  const currentUrl = SC_MULTI_LOGIN_WEBHOOK_URL || '-';
  const message =
    '* SETUP NGINX WEBHOOK SC*\n\n' +
    `URL webhook saat ini: \`${currentUrl}\`\n\n` +
    'Menu ini bantu generate config Nginx untuk forward port 80 ke bot (6969), lalu set URL webhook SC.';

  const keyboard = [
    [{ text: ' Auto Setup Nginx + SSL', callback_data: 'nginx_webhook_auto_setup' }],
    [{ text: ' Generate Config Nginx', callback_data: 'nginx_webhook_generate' }],
    [{ text: ' Set URL Webhook dari Domain/IP', callback_data: 'nginx_webhook_set_url_from_host' }],
    [{ text: ' Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendMaintenanceMenu(ctx) {
  const maintenance = loadMaintenanceSetting();
  const statusText = maintenance.enabled ? 'AKTIF' : 'NONAKTIF';
  const estimateText = maintenance.estimate || 'belum ditentukan';
  const keyboard = [
    [{ text: maintenance.enabled ? ' Nonaktifkan Maintenance' : ' Aktifkan Maintenance', callback_data: 'maintenance_toggle' }],
    [{ text: ' Set Estimasi Maintenance', callback_data: 'maintenance_set_estimate' }],
    [{ text: ' Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.editMessageText(
    '* MODE MAINTENANCE BOT*\n\n' +
    `Status: *${statusText}*\n` +
    `Estimasi: *${estimateText}*\n\n` +
    'Contoh estimasi: `30 menit` atau `2 jam`.',
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }
  );
}

async function sendScWebhookSettingsMenu(ctx) {
  const tokenStatus = BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN ? ` ${maskSecret(BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN)}` : ' Belum diisi';
  const urlStatus = SC_MULTI_LOGIN_WEBHOOK_URL || '-';
  const message =
    '* WEBHOOK MULTI-LOGIN SC*\n\n' +
    `Token webhook: ${tokenStatus}\n` +
    `URL webhook: \`${escapeHtmlLocal(urlStatus)}\`\n\n` +
    'URL ini endpoint yang dipanggil server SC saat multi-login terdeteksi.';

  const keyboard = [
    [{ text: 'Set Token Webhook', callback_data: 'sc_webhook_set_token' }],
    [{ text: 'Set URL Webhook', callback_data: 'sc_webhook_set_url' }],
    [{ text: 'Test Webhook (kirim ke saya)', callback_data: 'sc_webhook_test' }],
    [{ text: 'Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendAdminSyncToggleMenu(ctx) {
  try {
    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server, domain, sync_enabled FROM Server ORDER BY nama_server COLLATE NOCASE ASC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    if (servers.length === 0) {
      return ctx.editMessageText('Tidak ada server yang tersedia.', {
        reply_markup: { inline_keyboard: [[{ text: 'Kembali', callback_data: 'admin_menu_tools' }]] }
      });
    }

    const inlineKeyboard = servers.map((server) => {
      const statusText = Number(server.sync_enabled) === 1 ? '[ON]' : '[OFF]';
      return [{
        text: statusText + ' ' + (server.nama_server || server.domain || ('ID ' + server.id)),
        callback_data: 'admin_sync_server_toggle_' + server.id
      }];
    });

    inlineKeyboard.push([{ text: 'Kembali', callback_data: 'admin_menu_tools' }]);

    await ctx.editMessageText(
      '*AUTO SYNC SERVER*\n\nPilih server untuk aktif/nonaktif autosync.\nLabel [ON] berarti ikut autosync, [OFF] berarti dilewati.',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      }
    );
  } catch (err) {
    logger.error('Gagal menampilkan menu toggle autosync:', err.message);
    await ctx.reply('Terjadi kesalahan saat membuka menu autosync server.');
  }
}


// ── Sub-menu Admin: Markup ────────────────────────────────────
bot.action('admin_menu_markup', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return;
  const mkVpn = await dbH.getMarkup(db, 'global', 'vpn', null).catch(()=>null);
  const mkSmm = await dbH.getMarkup(db, 'global', 'smm', null).catch(()=>null);
  const mkAkrab = await dbH.getMarkup(db, 'global', 'akrab', null).catch(()=>null);
  const mkPpob = await dbH.getMarkup(db, 'global', 'ppob', null).catch(()=>null);
  const fmt = mk => mk ? (mk.type==='pct' ? mk.value+'%' : 'Rp'+Number(mk.value).toLocaleString('id-ID')) : 'Belum diset';
  const text =
    '📈 <b>Pusat Markup</b>\n'+
    '<code>──────────────────────</code>\n'+
    '<b>🌐 Global (semua member)</b>\n'+
    '├ VPN    : '+fmt(mkVpn)+'\n'+
    '├ SMM    : '+fmt(mkSmm)+'\n'+
    '├ Akrab V1&V2 : '+fmt(mkAkrab)+'\n'+
    '├ Akrab V3 : '+fmt(mkV3)+'\n'+
    '<b>👤 Reseller</b>\n'+
    '└ Markup per reseller diset di menu Markup Admin\n\n'+
    '<b>💹 PPOB</b>\n'+
    '└ Global : '+fmt(mkPpob)+'\n\n'+
    '✦ Pilih kategori:';
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
    [{ text: '━━━ 🌐 GLOBAL ━━━', callback_data: 'noop' }],
    [{ text: '🔷 VPN',      callback_data: 'admin_markup_global_menu' },
     { text: '📱 SMM',      callback_data: 'smm_markup_menu'          }],
    [{ text: '🔵 Akrab V1 & V2', callback_data: 'akrab_v12_markup_sub' }],
    [{ text: '💹 PPOB', callback_data: 'ppob_markup_menu' }],
    [{ text: '━━━ 👤 RESELLER (per user) ━━━', callback_data: 'noop' }],
    [{ text: '🔷 VPN',      callback_data: 'admin_reseller_markup_vpn'   },
     { text: '🔵 Akrab',    callback_data: 'admin_reseller_markup_akrab' }],
    [{ text: '📱 SMM',      callback_data: 'admin_reseller_markup_smm'   },
     { text: '💹 PPOB',     callback_data: 'admin_reseller_markup_ppob'  }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }],
  ]}});
});

// ── Sub-menu Admin: Backup & Restore ─────────────────────────
bot.action('admin_menu_backup', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return;
  await ctx.editMessageText('💾 <b>Backup & Restore</b>\n\nPilih aksi:', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
    [{ text: '💾 Backup Global Sekarang', callback_data: 'admin_do_backup' }],
    [{ text: '📥 Restore dari File', callback_data: 'admin_do_restore_info' }],
    [{ text: '🗄️ Restore Database (DB)', callback_data: 'restore_db_menu' }],
    [{ text: '💾 Backup DB Sekarang', callback_data: 'auto_backup_now' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }],
  ]}});
});

// ── Sub-menu Admin: Dashboard & Laporan ──────────────────────
bot.action('admin_menu_laporan', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return;
  await ctx.editMessageText('📊 <b>Dashboard & Laporan</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
    [{ text: '📊 Dashboard Harian', callback_data: 'admin_daily_dashboard' }],
    [{ text: '📈 Pendapatan Hari Ini & Kemarin', callback_data: 'admin_income_summary' }],
    [{ text: '📊 Pendapatan Topup Bulanan', callback_data: 'admin_income_monthly_non_reseller' }],
    [{ text: '📋 Antrian Pre-Order', callback_data: 'admin_preorder_list' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }],
  ]}});
});

// ── Sub-menu Admin: Setting ───────────────────────────────────
bot.action('admin_menu_setting', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return;
  const maintenance = loadMaintenanceSetting();
  const maintenanceLabel = maintenance.enabled ? '🔴 Maintenance: ON' : '🟢 Maintenance: OFF';
  const joinChannelSetting = loadJoinChannelSetting();
  const joinLabel = joinChannelSetting.enabled ? '📢 Wajib Join: ON' : '📢 Wajib Join: OFF';
  await ctx.editMessageText('⚙️ <b>Setting</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
    [{ text: '⚙️ Setting API Keys', callback_data: 'admin_setting_api' }],
    [{ text: '💳 Setting Payment Gateway', callback_data: 'payment_gateway_settings_menu' }],
    [{ text: '🛒 Setting HidePulsa PPOB', callback_data: 'hidepulsa_settings_menu' }],
    [{ text: '🔗 Webhook Multi-Login SC', callback_data: 'sc_webhook_settings_menu' }],
    [{ text: '🌐 Setup Nginx Webhook', callback_data: 'nginx_webhook_menu' }],
    [{ text: maintenanceLabel, callback_data: 'maintenance_menu' }],
    [{ text: joinLabel, callback_data: 'join_channel_menu' }],
    [{ text: '📞 Kontak Admin', callback_data: 'admin_contact_settings_menu' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }],
  ]}});
});

// ── Sub-menu Admin: Notifikasi ────────────────────────────────
bot.action('admin_menu_notif', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return;
  await ctx.editMessageText('🔔 <b>Notifikasi</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
    [{ text: '🔔 Notif Create (Bot)', callback_data: 'notif_settings_menu' }],
    [{ text: '📡 Notif BW Server', callback_data: 'bw_notif_settings_menu' }],
    [{ text: '🔔 Setting Notif Group', callback_data: 'admin_notif_group_menu' }],
    [{ text: '🤝 Setting Notif Akrab Group', callback_data: 'admin_akrab_notif_group_menu' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }],
  ]}});
});

// ── Sub-menu Admin: User ──────────────────────────────────────
bot.action('admin_menu_user', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return;
  await ctx.editMessageText('👥 <b>Manajemen User</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
    [{ text: '👁️ Lihat Saldo User', callback_data: 'cek_saldo_user' }],
    [{ text: '➕ Tambah Saldo VPN', callback_data: 'tambah_saldo' },
     { text: '➖ Hapus Saldo VPN', callback_data: 'hapus_saldo' }],
    [{ text: '➕ Tambah Saldo Akrab', callback_data: 'tambah_saldo_akrab' },
     { text: '➖ Kurang Saldo Akrab', callback_data: 'kurang_saldo_akrab' }],
    [{ text: '➕ Tambah Saldo PPOB', callback_data: 'tambah_saldo_ppob' },
     { text: '➖ Kurang Saldo PPOB', callback_data: 'kurang_saldo_ppob' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu' }],
  ]}});
});

bot.action('admin_menu_server', async (ctx) => {
  await ctx.answerCbQuery();
  await sendAdminServerMenu(ctx);
});

async function sendAdminManageServerMenu(ctx) {
  const keyboard = [
    [{ text: ' Edit Total + Batas', callback_data: 'manage_edit_total_batas' }],
    [{ text: ' Set Limit Bandwidth', callback_data: 'manage_set_bw_limit' }],
    [{ text: ' Migrasi User Server', callback_data: 'admin_migrate_users_menu' }],
    [{ text: ' Hapus Semua SSH/ZIVPN', callback_data: 'admin_delete_all_accounts_manual' }],
    [{ text: ' Aktif/Nonaktifkan dari List', callback_data: 'manage_server_visibility' }],
    [{ text: ' Aktif/Nonaktifkan Protocol', callback_data: 'manage_server_protocols' }],
    [{ text: ' Jadikan Server Penuh', callback_data: 'manage_server_full' }],
    [{ text: ' Jadikan Server Tersedia', callback_data: 'manage_server_activate' }],
    [{ text: ' Kembali', callback_data: 'admin_menu_server' }]
  ];

  await ctx.editMessageText('⚙️ *KELOLA SERVER*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

bot.action('admin_manage_server', async (ctx) => {
  await ctx.answerCbQuery();
  await sendAdminManageServerMenu(ctx);
});

bot.action('admin_migrate_users_menu', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const requesterId = Number(ctx.from?.id || 0);
  if (!adminIds.includes(requesterId)) {
    return ctx.reply('Anda tidak memiliki izin untuk membuka menu ini.');
  }

  const keyboard = [
    [
      { text: 'SSH', callback_data: 'migr_user_type_ssh' },
      { text: 'VMESS', callback_data: 'migr_user_type_vmess' }
    ],
    [
      { text: 'VLESS', callback_data: 'migr_user_type_vless' },
      { text: 'TROJAN', callback_data: 'migr_user_type_trojan' }
    ],
    [{ text: 'UDP ZIVPN', callback_data: 'migr_user_type_zivpn' }],
    [{ text: 'Kembali', callback_data: 'admin_manage_server' }]
  ];

  await ctx.reply('Pilih jenis akun yang ingin dimigrasi:', {
    reply_markup: { inline_keyboard: keyboard }
  });
});

bot.action('admin_delete_all_accounts_manual', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const requesterId = Number(ctx.from?.id || 0);
  if (!adminIds.includes(requesterId)) {
    return ctx.reply('Anda tidak memiliki izin untuk membuka menu ini.');
  }

  userState[ctx.chat.id] = { step: 'delete_all_input_host' };
  return ctx.reply(
    'Hapus semua akun SSH/ZIVPN (DANGEROUS)\n\n' +
    'Masukkan host server target (contoh: id1.prem-1forcr.shop).\n' +
    'Ketik "batal" untuk membatalkan.'
  );
});

bot.action(/migr_user_type_(ssh|vmess|vless|trojan|zivpn)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const requesterId = Number(ctx.from?.id || 0);
  if (!adminIds.includes(requesterId)) {
    return ctx.reply('Anda tidak memiliki izin untuk membuka menu ini.');
  }

  const type = normalizeMigrationType(ctx.match[1]);
  if (!isSupportedMigrationType(type)) {
    return ctx.reply(
      `Migrasi ${String(type || '').toUpperCase()} belum didukung saat ini.\n` +
      'Saat ini migrasi yang tersedia: SSH dan UDP ZIVPN.'
    );
  }
  userState[ctx.chat.id] = {
    step: 'migrate_input_source_host',
    migrationType: type
  };

  await ctx.reply(
    `Migrasi ${type.toUpperCase()}\n` +
    'Masukkan host server sumber (contoh: id1.prem-1forcr.shop).\n' +
    'Ketik "batal" untuk membatalkan.'
  );
});

bot.action(/migr_src_(ssh|vmess|vless|trojan|zivpn)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  return ctx.reply(
    'Alur migrasi terbaru menggunakan input manual host + key.\n' +
    'Silakan buka lagi menu Migrasi User Server.'
  );
});

bot.action('admin_check_bandwidth_servers', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const requesterId = Number(ctx.from?.id || 0);
  if (!adminIds.includes(requesterId)) {
    return ctx.reply('Anda tidak memiliki izin untuk membuka menu ini.');
  }

  try {
    await ctx.reply('Mengambil data bandwidth terbaru dari server tunnel...');
    await syncServerUsageFromTunnel('admin_check_bandwidth', { force: true });
  } catch (syncErr) {
    logger.warn(`Sync saat cek bandwidth gagal: ${syncErr.message}`);
  }

  db.all(
    'SELECT id, nama_server, domain, sync_host, total_create_akun, batas_create_akun, bandwidth_limit_tb, bandwidth_daily_gb, bandwidth_monthly_used_tb, bandwidth_user_daily_gb FROM Server ORDER BY nama_server COLLATE NOCASE ASC',
    [],
    async (err, rows) => {
      if (err) {
        logger.error(' Gagal mengambil data bandwidth server:', err.message);
        return ctx.reply(' Gagal mengambil data bandwidth server.');
      }
      if (!rows || rows.length === 0) {
        return ctx.reply('Belum ada server yang ditambahkan.');
      }

      const lines = ['*CEK BANDWIDTH SERVER*', ''];
      const groupedServers = [];
      const groups = new Map();
      for (const srv of rows) {
        const key = normalizeSyncHost(srv.sync_host || srv.domain) || (`id-${srv.id}`);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(srv);
      }

      for (const hostKey of groups.keys()) {
        const group = groups.get(hostKey) || [];
        if (group.length === 0) continue;
        const primary = group[0];
        groupedServers.push({
          nama_server: primary.nama_server,
          host: normalizeSyncHost(primary.sync_host || primary.domain) || '-',
          total_create_akun: group
            .map((s) => Number(s.total_create_akun || 0))
            .reduce((max, cur) => Math.max(max, cur), 0),
          batas_create_akun: group
            .map((s) => Number(s.batas_create_akun || 0))
            .filter((v) => Number.isFinite(v) && v > 0)
            .reduce((max, cur) => Math.max(max, cur), 0),
          bandwidth_limit_tb: group
            .map((s) => Number(s.bandwidth_limit_tb || 0))
            .filter((v) => Number.isFinite(v) && v > 0)
            .reduce((max, cur) => Math.max(max, cur), 0),
          bandwidth_daily_gb: group
            .map((s) => Number(s.bandwidth_daily_gb || 0))
            .reduce((max, cur) => Math.max(max, cur), 0),
          bandwidth_monthly_used_tb: group
            .map((s) => Number(s.bandwidth_monthly_used_tb || 0))
            .reduce((max, cur) => Math.max(max, cur), 0),
          bandwidth_user_daily_gb: group
            .map((s) => Number(s.bandwidth_user_daily_gb || 0))
            .filter((v) => Number.isFinite(v) && v > 0)
            .reduce((max, cur) => Math.max(max, cur), 0)
        });
      }

      let idx = 1;
      for (const srv of groupedServers) {
        const capacity = calculateServerEffectiveCapacity({
          usedAccounts: srv.total_create_akun,
          manualLimit: srv.batas_create_akun,
          bandwidthLimitTb: srv.bandwidth_limit_tb,
          dailyBandwidthGb: srv.bandwidth_daily_gb,
          fallbackPerUserDailyGb: srv.bandwidth_user_daily_gb,
          monthUsedTb: srv.bandwidth_monthly_used_tb
        });
        const manualLimit = Number(srv.batas_create_akun || 0);
        const manualLimitText = manualLimit > 0 ? String(manualLimit) : 'Unlimited';
        const host = srv.host || '-';
        const bwLimitTb = Number(srv.bandwidth_limit_tb || 0);
        const bwMonthTb = Number(srv.bandwidth_monthly_used_tb || 0);
        const riskOver = capacity.hasBandwidthLimit && capacity.projectedMonthlyTbFromToday > bwLimitTb ? 'YA' : 'TIDAK';

        lines.push(`${idx}. ${srv.nama_server || '-'}`);
        lines.push(`- Host: ${host}`);
        lines.push(`- Akun Terpakai (manual): ${Number(srv.total_create_akun || 0)}/${manualLimitText}`);
        lines.push(`- Bandwidth Hari Ini (vnstat): ${Number(srv.bandwidth_daily_gb || 0).toFixed(2)} GB`);
        lines.push(`- Bandwidth Hari Ini (estimasi): ${Number(capacity.effectiveDailyBandwidthGb || 0).toFixed(2)} GB`);
        lines.push(`- Bandwidth Bulan Ini: ${bwMonthTb.toFixed(2)}/${bwLimitTb > 0 ? bwLimitTb.toFixed(2) : '-'} TB`);
        lines.push(`- Estimasi BW 30 Hari: ${capacity.projectedMonthlyTbFromToday.toFixed(2)} TB`);
        lines.push(`- Batas Aman User (BW): ${capacity.hasBandwidthLimit ? capacity.estimatedCapacityByBandwidth : '-'}`);
        lines.push(`- Estimasi Pemakaian/User/Hari: ${capacity.hasBandwidthLimit ? capacity.estimatedPerUserDailyGb.toFixed(3) + ' GB' : '-'}`);
        lines.push(`- Risiko Over BW: ${riskOver}`);
        lines.push('');
        idx += 1;
      }

      const msg = lines.join('\n');
      if (msg.length <= 3900) {
        await ctx.reply(msg, { parse_mode: 'Markdown' });
      } else {
        // Bagi per potongan agar aman dari limit telegram
        let buffer = '';
        for (const line of lines) {
          const candidate = buffer ? `${buffer}\n${line}` : line;
          if (candidate.length > 3500) {
            await ctx.reply(buffer, { parse_mode: 'Markdown' });
            buffer = line;
          } else {
            buffer = candidate;
          }
        }
        if (buffer) await ctx.reply(buffer, { parse_mode: 'Markdown' });
      }
    }
  );
});

bot.action('manage_edit_total_batas', async (ctx) => {
  await ctx.answerCbQuery();
  db.all('SELECT id, nama_server FROM Server ORDER BY nama_server COLLATE NOCASE ASC', [], async (err, servers) => {
    if (err) {
      logger.error(' Kesalahan saat mengambil daftar server:', err.message);
      return ctx.reply(' Terjadi kesalahan saat mengambil daftar server.');
    }
    if (!servers || servers.length === 0) {
      return ctx.reply(' Tidak ada server yang tersedia.');
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `edit_total_batas_${server.id}`
    }));
    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }
    inlineKeyboard.push([{ text: ' Kembali', callback_data: 'admin_manage_server' }]);

    await ctx.reply(' Pilih server untuk edit total+batas:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  });
});

bot.action('manage_server_full', async (ctx) => {
  await ctx.answerCbQuery();
  db.all('SELECT id, nama_server FROM Server ORDER BY nama_server COLLATE NOCASE ASC', [], async (err, servers) => {
    if (err) {
      logger.error(' Kesalahan saat mengambil daftar server:', err.message);
      return ctx.reply(' Terjadi kesalahan saat mengambil daftar server.');
    }
    if (!servers || servers.length === 0) {
      return ctx.reply(' Tidak ada server yang tersedia.');
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `set_server_full_${server.id}`
    }));
    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }
    inlineKeyboard.push([{ text: ' Kembali', callback_data: 'admin_manage_server' }]);

    await ctx.reply(' Pilih server yang akan dijadikan penuh:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  });
});

bot.action('manage_server_activate', async (ctx) => {
  await ctx.answerCbQuery();
  db.all('SELECT id, nama_server FROM Server ORDER BY nama_server COLLATE NOCASE ASC', [], async (err, servers) => {
    if (err) {
      logger.error(' Kesalahan saat mengambil daftar server:', err.message);
      return ctx.reply(' Terjadi kesalahan saat mengambil daftar server.');
    }
    if (!servers || servers.length === 0) {
      return ctx.reply(' Tidak ada server yang tersedia.');
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `activate_server_${server.id}`
    }));
    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }
    inlineKeyboard.push([{ text: ' Kembali', callback_data: 'admin_manage_server' }]);

    await ctx.reply(' Pilih server yang akan diaktifkan (isi ulang total & batas):', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  });
});

bot.action('manage_server_visibility', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengubah status server.');
  }

  db.all(
    'SELECT id, nama_server, domain, is_active FROM Server ORDER BY nama_server COLLATE NOCASE ASC',
    [],
    async (err, servers) => {
      if (err) {
        logger.error(' Kesalahan saat mengambil daftar server:', err.message);
        return ctx.reply(' Terjadi kesalahan saat mengambil daftar server.');
      }
      if (!servers || servers.length === 0) {
        return ctx.reply(' Tidak ada server yang tersedia.');
      }

      const buttons = servers.map((server) => {
        const active = Number(server.is_active ?? 1) === 1;
        const label = `${active ? '[AKTIF]' : '[NONAKTIF]'} ${server.nama_server || server.domain || ('ID ' + server.id)}`;
        return {
          text: label,
          callback_data: `toggle_server_visibility_${server.id}`
        };
      });

      const inlineKeyboard = [];
      for (let i = 0; i < buttons.length; i += 1) {
        inlineKeyboard.push([buttons[i]]);
      }
      inlineKeyboard.push([{ text: ' Kembali', callback_data: 'admin_manage_server' }]);

      return ctx.reply(
        '*AKTIF/NONAKTIF SERVER DI LIST USER*\n\n' +
        'Server *NONAKTIF* tidak muncul di menu pilih server user. Klik server untuk toggle status.',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard }
        }
      );
    }
  );
});

bot.action(/toggle_server_visibility_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengubah status server.');
  }

  const serverId = Number(ctx.match[1]);
  if (!Number.isInteger(serverId) || serverId <= 0) {
    return ctx.reply('ID server tidak valid.');
  }

  try {
    const server = await dbGetAsync(
      'SELECT id, nama_server, domain, is_active FROM Server WHERE id = ?',
      [serverId]
    );
    if (!server) {
      return ctx.reply('Server tidak ditemukan.');
    }

    const nextValue = Number(server.is_active ?? 1) === 1 ? 0 : 1;
    await dbRunAsync('UPDATE Server SET is_active = ? WHERE id = ?', [nextValue, serverId]);

    await ctx.reply(
      `Server ${(server.nama_server || server.domain || ('ID ' + server.id))} sekarang ` +
      (nextValue === 1 ? 'AKTIF dan muncul di list user.' : 'NONAKTIF dan disembunyikan dari list user.')
    );
    return ctx.reply('Buka ulang menu toggle status server:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Aktif/Nonaktifkan Server', callback_data: 'manage_server_visibility' }]]
      }
    });
  } catch (err) {
    logger.error('Gagal toggle status aktif server:', err.message);
    return ctx.reply('Gagal mengubah status server.');
  }
});

bot.action('manage_server_protocols', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengubah support protocol server.');
  }

  const selectColumns = SERVER_PROTOCOL_KEYS
    .map((key) => SERVER_PROTOCOL_SUPPORT[key].column)
    .join(', ');

  db.all(
    `SELECT id, nama_server, domain, ${selectColumns}
     FROM Server
     ORDER BY nama_server COLLATE NOCASE ASC`,
    [],
    async (err, servers) => {
      if (err) {
        logger.error(' Kesalahan saat mengambil daftar server:', err.message);
        return ctx.reply(' Terjadi kesalahan saat mengambil daftar server.');
      }
      if (!servers || servers.length === 0) {
        return ctx.reply(' Tidak ada server yang tersedia.');
      }

      const keyboard = servers.map((server) => ([{
        text: server.nama_server || server.domain || ('ID ' + server.id),
        callback_data: `server_protocols_${server.id}`
      }]));
      keyboard.push([{ text: ' Kembali', callback_data: 'admin_manage_server' }]);

      return ctx.reply(
        '*SUPPORT PROTOCOL SERVER*\n\n' +
        'Pilih server untuk mengatur protocol yang muncul di list user.',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }
      );
    }
  );
});

async function sendServerProtocolToggleMenu(ctx, serverId) {
  const selectColumns = SERVER_PROTOCOL_KEYS
    .map((key) => SERVER_PROTOCOL_SUPPORT[key].column)
    .join(', ');
  const server = await dbGetAsync(
    `SELECT id, nama_server, domain, ${selectColumns}
     FROM Server
     WHERE id = ?`,
    [serverId]
  );

  if (!server) {
    return ctx.reply('Server tidak ditemukan.');
  }

  const keyboard = SERVER_PROTOCOL_KEYS.map((key) => {
    const protocol = SERVER_PROTOCOL_SUPPORT[key];
    const enabled = Number(server[protocol.column] ?? protocol.defaultEnabled) === 1;
    return [{
      text: `${enabled ? '[ON]' : '[OFF]'} ${protocol.label}`,
      callback_data: `toggle_server_protocol_${server.id}_${key}`
    }];
  });
  keyboard.push([{ text: ' Pilih Server Lain', callback_data: 'manage_server_protocols' }]);
  keyboard.push([{ text: ' Kembali', callback_data: 'admin_manage_server' }]);

  return ctx.reply(
    '*SUPPORT PROTOCOL*\n\n' +
    `Server: *${server.nama_server || server.domain || ('ID ' + server.id)}*\n` +
    `Status: \`${formatServerProtocolStatusLine(server)}\`\n\n` +
    'Klik protocol untuk ON/OFF. Protocol OFF tidak muncul di list server user untuk menu protocol tersebut.',
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }
  );
}

bot.action(/server_protocols_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengubah support protocol server.');
  }

  const serverId = Number(ctx.match[1]);
  if (!Number.isInteger(serverId) || serverId <= 0) {
    return ctx.reply('ID server tidak valid.');
  }

  return sendServerProtocolToggleMenu(ctx, serverId);
});

bot.action(/toggle_server_protocol_(\d+)_(ssh|vmess|vless|trojan|shadowsocks|zivpn|udp_http)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengubah support protocol server.');
  }

  const serverId = Number(ctx.match[1]);
  const protocolKey = String(ctx.match[2] || '').toLowerCase();
  const protocol = getServerProtocolSupport(protocolKey);
  if (!Number.isInteger(serverId) || serverId <= 0 || !protocol) {
    return ctx.reply('Data protocol tidak valid.');
  }

  try {
    const server = await dbGetAsync(
      `SELECT id, nama_server, domain, ${protocol.column}
       FROM Server
       WHERE id = ?`,
      [serverId]
    );
    if (!server) {
      return ctx.reply('Server tidak ditemukan.');
    }

    const current = Number(server[protocol.column] ?? protocol.defaultEnabled) === 1 ? 1 : 0;
    const nextValue = current === 1 ? 0 : 1;
    await dbRunAsync(`UPDATE Server SET ${protocol.column} = ? WHERE id = ?`, [nextValue, serverId]);

    await ctx.reply(
      `${protocol.label} untuk server ${server.nama_server || server.domain || ('ID ' + server.id)} sekarang ` +
      (nextValue === 1 ? 'ON.' : 'OFF dan tidak muncul di list protocol itu.')
    );
    return sendServerProtocolToggleMenu(ctx, serverId);
  } catch (err) {
    logger.error('Gagal toggle support protocol server:', err.message);
    return ctx.reply('Gagal mengubah support protocol server.');
  }
});

bot.action('manage_set_bw_limit', async (ctx) => {
  await ctx.answerCbQuery();
  db.all(
    'SELECT id, nama_server, bandwidth_limit_tb, bandwidth_user_daily_gb FROM Server ORDER BY nama_server COLLATE NOCASE ASC',
    [],
    async (err, servers) => {
      if (err) {
        logger.error(' Kesalahan saat mengambil daftar server:', err.message);
        return ctx.reply(' Terjadi kesalahan saat mengambil daftar server.');
      }
      if (!servers || servers.length === 0) {
        return ctx.reply(' Tidak ada server yang tersedia.');
      }

      const buttons = servers.map((server) => ({
        text: `${server.nama_server} (${Number(server.bandwidth_limit_tb || 0).toFixed(1)}TB)`,
        callback_data: `set_server_bw_limit_${server.id}`
      }));
      const inlineKeyboard = [];
      for (let i = 0; i < buttons.length; i += 2) {
        inlineKeyboard.push(buttons.slice(i, i + 2));
      }
      inlineKeyboard.push([{ text: ' Kembali', callback_data: 'admin_manage_server' }]);

      await ctx.reply(' Pilih server untuk set limit bandwidth:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }
  );
});

bot.action(/set_server_bw_limit_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const serverId = Number(ctx.match[1]);
  if (!Number.isFinite(serverId) || serverId <= 0) {
    return ctx.reply('ID server tidak valid.');
  }

  db.get(
    'SELECT id, nama_server, bandwidth_limit_tb, bandwidth_user_daily_gb FROM Server WHERE id = ?',
    [serverId],
    (err, row) => {
      if (err || !row) {
        return ctx.reply('Server tidak ditemukan.');
      }

      userState[ctx.chat.id] = { step: 'edit_bw_limit_input', serverId };
      return ctx.reply(
        `Server: ${row.nama_server}\n` +
        `Setting saat ini:\n` +
        `- Limit bulanan: ${Number(row.bandwidth_limit_tb || 0).toFixed(2)} TB\n` +
        `- Estimasi/user/hari: ${Number(row.bandwidth_user_daily_gb || 8).toFixed(2)} GB\n\n` +
        'Kirim format: <limit_tb> <avg_gb_per_user_per_hari>\n' +
        'Contoh: 25 8\n' +
        'Ketik batal untuk membatalkan.'
      );
    }
  );
});


bot.action('hidepulsa_settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  await sendHidepulsaSettingsMenu(ctx);
});

bot.action('hidepulsa_set_tgid', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  userState[ctx.from.id] = { step: 'hidepulsa_set_tgid' };
  await ctx.reply('🆔 Kirim Telegram User ID untuk HidePulsa (angka):');
});

bot.action('hidepulsa_req_otp', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  const vars = JSON.parse(require('fs').readFileSync('./.vars.json', 'utf-8'));
  const tgId = Number(vars.HIDEPULSA_TELEGRAM_USER_ID || 0);
  if (!tgId) return ctx.reply('❌ Set Telegram User ID dulu.');
  try {
    await ctx.reply('⏳ Mengirim OTP...');
    const challengeToken = await ppob.registerAndRequestOtp(tgId);
    const nextVars = JSON.parse(require('fs').readFileSync('./.vars.json', 'utf-8'));
    nextVars.HIDEPULSA_CHALLENGE_TOKEN = challengeToken;
    require('fs').writeFileSync('./.vars.json', JSON.stringify(nextVars, null, 2));
    await ctx.reply('✅ OTP dikirim ke @apphidepulsa_bot\n\nKlik Verifikasi OTP lalu kirim kode 6 digit.', {
      reply_markup: { inline_keyboard: [[{ text: '✅ Verifikasi OTP', callback_data: 'hidepulsa_verify_otp' }]] }
    });
  } catch (err) {
    await ctx.reply('❌ Gagal kirim OTP: ' + err.message);
  }
});

bot.action('hidepulsa_verify_otp', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  const vars = JSON.parse(require('fs').readFileSync('./.vars.json', 'utf-8'));
  if (!vars.HIDEPULSA_CHALLENGE_TOKEN) return ctx.reply('❌ Request OTP dulu sebelum verifikasi.');
  userState[ctx.from.id] = { step: 'hidepulsa_verify_otp', challengeToken: vars.HIDEPULSA_CHALLENGE_TOKEN };
  await ctx.reply('📲 Kirim kode OTP 6 digit dari @apphidepulsa_bot:');
});

bot.action('hidepulsa_refresh_token', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  try {
    await ppob.ensureToken();
    await ctx.reply('✅ Token berhasil di-refresh!');
    await sendHidepulsaSettingsMenu(ctx);
  } catch (err) {
    await ctx.reply('❌ Gagal refresh: ' + err.message);
  }
});

bot.action('hidepulsa_logout', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  ppob.clearTokens();
  const nextVars = JSON.parse(require('fs').readFileSync('./.vars.json', 'utf-8'));
  delete nextVars.HIDEPULSA_ACCESS_TOKEN;
  delete nextVars.HIDEPULSA_REFRESH_TOKEN;
  delete nextVars.HIDEPULSA_CHALLENGE_TOKEN;
  require('fs').writeFileSync('./.vars.json', JSON.stringify(nextVars, null, 2));
  await ctx.reply('🔴 Token dihapus. Silakan login OTP ulang.');
  await sendHidepulsaSettingsMenu(ctx);
});

bot.action('hidepulsa_cek_saldo', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  try {
    const token = await ppob.ensureToken();
    const res = await axios.get('https://app.hidepulsa.com/profile', {
      headers: { Authorization: 'Bearer ' + token },
      timeout: 10000
    });
    const balance = (res.data && (res.data.data || res.data.user || {})).balance || 0;
    await ctx.reply('💰 *Saldo HidePulsa*\n\nRp ' + Number(balance).toLocaleString('id-ID'), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'hidepulsa_settings_menu' }]] }
    });
  } catch (err) {
    await ctx.reply('❌ Gagal cek saldo: ' + err.message);
  }
});

bot.action('admin_menu_saldo', async (ctx) => {
  await ctx.answerCbQuery();
  await sendAdminSaldoMenu(ctx);
});

bot.action('admin_income_summary', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengakses menu ini.');
  }

  try {
    const todayRange = getDayRange(0);
    const yesterdayRange = getDayRange(-1);
    const [todayStats, yesterdayStats] = await Promise.all([
      getIncomeStatsByRange(todayRange.start, todayRange.end),
      getIncomeStatsByRange(yesterdayRange.start, yesterdayRange.end)
    ]);

    const message =
      '*INFORMASI PENDAPATAN*\n\n' +
      '*Hari Ini*\n' +
      '- Pendapatan akun: ' + formatRupiah(todayStats.accountIncome) + '\n' +
      '- Jumlah akun terjual: ' + todayStats.accountCount + '\n' +
      '- Topup masuk: ' + formatRupiah(todayStats.topupIncome) + '\n\n' +
      '*Kemarin*\n' +
      '- Pendapatan akun: ' + formatRupiah(yesterdayStats.accountIncome) + '\n' +
      '- Jumlah akun terjual: ' + yesterdayStats.accountCount + '\n' +
      '- Topup masuk: ' + formatRupiah(yesterdayStats.topupIncome);

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Gagal mengambil informasi pendapatan admin:', error.message);
    await ctx.reply('Gagal mengambil informasi pendapatan. Coba lagi.');
  }
});

bot.action('admin_income_monthly_non_reseller', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengakses menu ini.');
  }

  try {
    const thisMonth = getMonthRange(0);
    const prevMonth = getMonthRange(-1);
    const [thisMonthTopupNonReseller, prevMonthTopupNonReseller, thisMonthTopupReseller, prevMonthTopupReseller, roleCounts] = await Promise.all([
      getTopupIncomeNonResellerByRange(thisMonth.start, thisMonth.end),
      getTopupIncomeNonResellerByRange(prevMonth.start, prevMonth.end),
      getTopupIncomeResellerByRange(thisMonth.start, thisMonth.end),
      getTopupIncomeResellerByRange(prevMonth.start, prevMonth.end),
      getUserRoleCounts()
    ]);

    const thisMonthTopupTotal = thisMonthTopupNonReseller + thisMonthTopupReseller;
    const prevMonthTopupTotal = prevMonthTopupNonReseller + prevMonthTopupReseller;

    const message =
      '*TOPUP BULANAN*\n\n' +
      `*${formatMonthLabel(thisMonth.labelDate)}*\n` +
      '- Total topup (gabungan): ' + formatRupiah(thisMonthTopupTotal) + '\n' +
      '- Topup non-reseller: ' + formatRupiah(thisMonthTopupNonReseller) + '\n' +
      '- Topup reseller: ' + formatRupiah(thisMonthTopupReseller) + '\n\n' +
      `*${formatMonthLabel(prevMonth.labelDate)}*\n` +
      '- Total topup (gabungan): ' + formatRupiah(prevMonthTopupTotal) + '\n' +
      '- Topup non-reseller: ' + formatRupiah(prevMonthTopupNonReseller) + '\n' +
      '- Topup reseller: ' + formatRupiah(prevMonthTopupReseller) + '\n\n' +
      '*JUMLAH USER*\n' +
      `- Reseller: ${roleCounts.resellerUsers}\n` +
      `- Non-reseller: ${roleCounts.nonResellerUsers}\n` +
      `- Total user: ${roleCounts.totalUsers}\n` +
      `- Total ID reseller terdaftar: ${roleCounts.resellerListCount}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Gagal mengambil pendapatan topup bulanan non-reseller:', error.message);
    await ctx.reply('Gagal mengambil data pendapatan topup bulanan. Coba lagi.');
  }
});

bot.action('bonus_topup_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  const bonus = loadTopupBonusSetting();
  const statusLabel = bonus.enabled ? ' Aktif' : ' Nonaktif';
  const message =
    '* BONUS TOPUP OTOMATIS*\n\n' +
    `Status: ${statusLabel}\n` +
    `• 10-40rb  : ${bonus.range_10_40}%\n` +
    `• 50-70rb  : ${bonus.range_50_70}%\n` +
    `• 70-100rb+: ${bonus.range_70_100}%\n\n` +
    'Pilih range untuk ubah persen bonus:';
  const keyboard = [
    [{ text: bonus.enabled ? ' Nonaktifkan Bonus' : ' Aktifkan Bonus', callback_data: 'bonus_toggle' }],
    [{ text: 'Set 10-40rb', callback_data: 'bonus_set_10_40' }],
    [{ text: 'Set 50-70rb', callback_data: 'bonus_set_50_70' }],
    [{ text: 'Set 70-100rb+', callback_data: 'bonus_set_70_100' }],
    [{ text: ' Kembali', callback_data: 'admin_menu_saldo' }]
  ];
  await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
});

bot.action('bonus_toggle', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  const current = loadTopupBonusSetting();
  current.enabled = !current.enabled;
  saveTopupBonusSetting(current);
  await ctx.reply(current.enabled ? ' Bonus topup diaktifkan.' : ' Bonus topup dinonaktifkan.');
  return sendAdminSaldoMenu(ctx);
});

bot.action('bonus_set_10_40', async (ctx) => {
  await ctx.answerCbQuery();
  userState[ctx.chat.id] = { step: 'bonus_set_10_40' };
  await ctx.reply('Masukkan persen bonus untuk topup 10-40rb (contoh: 5):');
});

bot.action('bonus_set_50_70', async (ctx) => {
  await ctx.answerCbQuery();
  userState[ctx.chat.id] = { step: 'bonus_set_50_70' };
  await ctx.reply('Masukkan persen bonus untuk topup 50-70rb (contoh: 7):');
});

bot.action('bonus_set_70_100', async (ctx) => {
  await ctx.answerCbQuery();
  userState[ctx.chat.id] = { step: 'bonus_set_70_100' };
  await ctx.reply('Masukkan persen bonus untuk topup 70-100rb+ (contoh: 10):');
});

bot.action('notif_settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengakses menu ini.');
  }

  const tokenStatus = NOTIF_BOT_TOKEN ? ' Tersimpan' : ' Belum diisi';
  const chatStatus = NOTIF_CHAT_ID ? ' Tersimpan' : ' Belum diisi';
  const globalGroupStatus = GLOBAL_CREATE_NOTIF_GROUP_ID ? ` ${GLOBAL_CREATE_NOTIF_GROUP_ID}` : ' Belum diisi';
  const message =
    '* PENGATURAN NOTIF CREATE (BOT)*\n\n' +
    `Token Bot: ${tokenStatus}\n` +
    `Chat ID: ${chatStatus}\n` +
    `Group Global Create: ${globalGroupStatus}\n\n` +
    'Gunakan tombol di bawah untuk mengatur Token, Chat ID, dan Group Global.';

  const keyboard = [
    [{ text: 'Set Token Bot', callback_data: 'notif_set_token' }],
    [{ text: 'Set Chat ID', callback_data: 'notif_set_chat' }],
    [{ text: 'Set Group Global Create', callback_data: 'notif_set_global_group' }],
    [{ text: 'Kembali', callback_data: 'admin_menu' }]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
});


// ── Setting Notif Group VPN ──────────────────────────────────
bot.action('admin_notif_group_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  const currentId = vars.GROUP_ID || 'Belum diset';
  await ctx.editMessageText(
    '*⚙️ Setting Notif Group VPN*\n\n' +
    'Group ID saat ini: `' + currentId + '`\n\n' +
    'Kirim Group ID baru untuk notifikasi akun VPN.\nContoh: `-1001234567890`\nKetik *batal* untuk membatalkan.',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: '🔙 Kembali', callback_data: 'admin_menu' }]
    ]}}
  );
  userState[ctx.chat.id] = { step: 'admin_set_vpn_notif_group' };
});

// ── Setting Notif Group Akrab ─────────────────────────────────
bot.action('admin_akrab_notif_group_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('❌ Tidak ada izin.');
  const currentId = vars.AKRAB_NOTIF_GROUP_ID || 'Belum diset';
  await ctx.editMessageText(
    '*⚙️ Setting Notif Group Akrab*\n\n' +
    'Group ID saat ini: `' + currentId + '`\n\n' +
    'Kirim Group ID baru untuk notifikasi transaksi Akrab.\nContoh: `-1001234567890`\nKetik *batal* untuk membatalkan.',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: '🔙 Kembali', callback_data: 'admin_menu' }]
    ]}}
  );
  userState[ctx.chat.id] = { step: 'admin_input_akrab_notif_group' };
});

bot.action('notif_set_global_group', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'notif_global_create_group_id' };
  await ctx.reply('Kirim *GROUP ID GLOBAL* untuk notif create akun.\nContoh: `-1001234567890`\nKetik "batal" untuk membatalkan.', { parse_mode: 'Markdown' });
});

bot.action('notif_set_token', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'notif_bot_token' };
  await ctx.reply('Kirim *BOT TOKEN* untuk notifikasi create akun.\nKetik "batal" untuk membatalkan.', { parse_mode: 'Markdown' });
});

bot.action('notif_set_chat', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'notif_chat_id' };
  await ctx.reply('Kirim *CHAT ID* tujuan notifikasi.\nKetik "batal" untuk membatalkan.', { parse_mode: 'Markdown' });
});

bot.action('sc_webhook_settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengakses menu ini.');
  }
  return sendScWebhookSettingsMenu(ctx);
});

bot.action('nginx_webhook_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengakses menu ini.');
  }
  return sendNginxWebhookMenu(ctx);
});

bot.action('nginx_webhook_generate', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin.');
  }
  userState[ctx.chat.id] = { step: 'nginx_webhook_host_input_generate' };
  return ctx.reply(
    'Kirim domain/IP publik VPS bot untuk generate config Nginx.\n' +
    'Contoh: `47.236.58.59` atau `bot.domain.com`\n' +
    'Ketik "batal" untuk membatalkan.',
    { parse_mode: 'Markdown' }
  );
});

bot.action('nginx_webhook_auto_setup', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin.');
  }
  userState[ctx.chat.id] = { step: 'nginx_webhook_host_input_auto' };
  return ctx.reply(
    'Kirim domain/IP publik VPS bot untuk AUTO setup Nginx webhook.\n' +
    'Contoh: `bot.domain.com` atau `47.236.58.59`\n' +
    'Catatan: SSL otomatis hanya bisa untuk domain.\n' +
    'Ketik "batal" untuk membatalkan.',
    { parse_mode: 'Markdown' }
  );
});

bot.action('nginx_webhook_set_url_from_host', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin.');
  }
  userState[ctx.chat.id] = { step: 'nginx_webhook_host_input_seturl' };
  return ctx.reply(
    'Kirim domain/IP publik VPS bot untuk set URL webhook otomatis.\n' +
    'Format URL akan jadi: `http://DOMAIN_OR_IP/sc1forcr/events/multi-login`\n' +
    'Ketik "batal" untuk membatalkan.',
    { parse_mode: 'Markdown' }
  );
});

bot.action('sc_webhook_set_token', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply(' Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'sc_webhook_token' };
  return ctx.reply('Kirim token webhook SC.\nKetik "batal" untuk membatalkan.');
});

bot.action('sc_webhook_set_url', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply(' Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'sc_webhook_url' };
  return ctx.reply('Kirim URL webhook SC.\nContoh: https://domain-bot/sc1forcr/events/multi-login\nKetik "batal" untuk membatalkan.');
});

bot.action('sc_webhook_test', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply(' Anda tidak memiliki izin.');
  if (!SC_MULTI_LOGIN_WEBHOOK_URL || !BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN) {
    return ctx.reply('URL/token webhook belum diisi. Isi dulu di menu Webhook Multi-Login SC.');
  }
  try {
    await axios.post(
      SC_MULTI_LOGIN_WEBHOOK_URL,
      {
        event: 'MULTI_LOGIN',
        action: 'LOCK_TMP',
        service: 'VMESS',
        username: 'test-user',
        limitip: 1,
        detected: 3,
        ips: ['1.1.1.1', '2.2.2.2'],
        unlock_minutes: 15,
        owner_telegram_id: ctx.from.id,
        owner_telegram_chat_id: ctx.from.id
      },
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN}`,
          'x-sc-event-token': BOT_ACCOUNT_EVENT_WEBHOOK_TOKEN
        }
      }
    );
    return ctx.reply(' Test webhook terkirim. Cek apakah notif multi-login masuk ke akun Telegram kamu.');
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'unknown error';
    return ctx.reply(` Test webhook gagal: ${msg}`);
  }
});

bot.action('bw_notif_settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengakses menu ini.');
  }

  const status = BW_NOTIF_GROUP_ID_NUM ? ` ${BW_NOTIF_GROUP_ID_NUM}` : ' Belum diisi';
  const intervalText = formatBandwidthReportInterval(BW_REPORT_INTERVAL_MINUTES);
  const message =
    '* PENGATURAN NOTIF BANDWIDTH SERVER*\n\n' +
    `Group ID tujuan notif BW: ${status}\n` +
    `Interval laporan otomatis: ${intervalText}\n` +
    'Anda bisa ubah ke menit atau jam.';

  const keyboard = [
    [{ text: 'Set Group ID Notif BW', callback_data: 'bw_notif_set_group_id' }],
    [{ text: 'Set Interval Laporan BW', callback_data: 'bw_notif_set_interval' }],
    [{ text: 'Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
});

bot.action('bw_notif_set_group_id', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'bw_notif_group_id' };
  await ctx.reply('Kirim *GROUP ID* tujuan notifikasi bandwidth.\nContoh: `-1001234567890`\nKetik "batal" untuk membatalkan.', { parse_mode: 'Markdown' });
});

bot.action('bw_notif_set_interval', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'bw_notif_interval' };
  await ctx.reply(
    'Kirim interval laporan bandwidth.\n' +
    'Contoh: `180` (menit), `3 jam`, atau `30 menit`.\n' +
    'Rentang: 5 menit sampai 24 jam.\n' +
    'Ketik "batal" untuk membatalkan.',
    { parse_mode: 'Markdown' }
  );
});


async function sendHidepulsaSettingsMenu(ctx) {
  const vars = JSON.parse(require('fs').readFileSync('./.vars.json', 'utf-8'));
  const tgId = vars.HIDEPULSA_TELEGRAM_USER_ID || '-';
  const sessionStatus = ppob.isSessionActive() ? '🟢 Aktif' : '🔴 Tidak aktif';
  // Baca token dari DB (bukan dari vars)
  const tokenRow = await new Promise(res => db.get('SELECT access_token, refresh_token, access_expires_at, refresh_expires_at FROM ppob_tokens WHERE id = 1', [], (e, r) => res(r || null)));
  const hasToken = (tokenRow && tokenRow.access_token) ? '✅ Ada (exp: ' + new Date(tokenRow.access_expires_at).toLocaleString('id-ID', {timeZone:'Asia/Jakarta'}) + ')' : '❌ Belum';
  const hasRefresh = (tokenRow && tokenRow.refresh_token) ? '✅ Ada (exp: ' + new Date(tokenRow.refresh_expires_at).toLocaleString('id-ID', {timeZone:'Asia/Jakarta'}) + ')' : '❌ Belum';
  const message =
    '*⚙️ SETTING HIDEPULSA PPOB*\n\n' +
    'Telegram User ID : `' + tgId + '`\n' +
    'Access Token     : ' + hasToken + '\n' +
    'Refresh Token    : ' + hasRefresh + '\n' +
    'Status Sesi      : ' + sessionStatus + '\n\nPilih aksi:';
  const keyboard = [
    [{ text: '🆔 Set Telegram User ID', callback_data: 'hidepulsa_set_tgid' }],
    [{ text: '🔐 Login OTP (Minta Kode)', callback_data: 'hidepulsa_req_otp' }],
    [{ text: '✅ Verifikasi OTP', callback_data: 'hidepulsa_verify_otp' }],
    [{ text: '🔄 Refresh Token Manual', callback_data: 'hidepulsa_refresh_token' }],
    [{ text: '🗑️ Hapus Token / Logout', callback_data: 'hidepulsa_logout' }],
    [{ text: '💰 Cek Saldo HidePulsa', callback_data: 'hidepulsa_cek_saldo' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu_tools' }]
  ];
  try {
    await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
  } catch (_) {
    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
  }
}

async function sendPaymentGatewayMainMenu(ctx) {
  reloadRuntimePaymentConfig();
  const message =
    '*SETTING PAYMENT GATEWAY*\n\n' +
    `Mode Gateway Aktif: \`${formatGatewayModeLabel()}\`\n\n` +
    `Masa Aktif QRIS: \`OrderKuota ${ORDERKUOTA_QR_EXPIRE_MINUTES} menit | GoPay ${GOPAY_QR_EXPIRE_MINUTES} menit\`\n\n` +
    'Pilih mode gateway atau masuk ke submenu provider.';

  const keyboard = [
    [{ text: 'Mode: OrderKuota saja', callback_data: 'payment_gateway_mode_orderkuota' }],
    [{ text: 'Mode: GoPay saja', callback_data: 'payment_gateway_mode_gopay' }],
    [{ text: 'Mode: Keduanya (fallback)', callback_data: 'payment_gateway_mode_both' }],
    [{ text: ' Set Masa Aktif QRIS', callback_data: 'payment_gateway_set_all_qris_expire' }],
    [{ text: ' Setting OrderKuota', callback_data: 'payment_gateway_menu_orderkuota' }],
    [{ text: ' Setting GoPay', callback_data: 'payment_gateway_menu_gopay' }],
    [{ text: 'Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendPaymentGatewayOrderKuotaMenu(ctx) {
  reloadRuntimePaymentConfig();
  const currentVars = loadVars();
  const message =
    '*SETTING ORDERKUOTA*\n\n' +
    `Mode Create QR: \`${formatOrderKuotaCreateModeLabel()}\`\n` +
    `Endpoint Lokal: \`/orderkuota/createpayment\`\n` +
    `Gateway URL: \`${ORDERKUOTA_CREATE_MODE === 'gateway' ? (PAYMENT_GATEWAY_BASE_URL || '-') : 'Tidak dipakai'}\`\n` +
    `Gateway API Key: \`${ORDERKUOTA_CREATE_MODE === 'gateway' ? maskSecret(RAJASERVER_API_KEY) : 'Tidak wajib'}\`\n` +
    `Local Endpoint API Key: \`${maskSecret(getLocalPaymentApiKey())}\`\n` +
    `QRIS String: \`${DATA_QRIS ? 'Tersimpan' : 'Belum diisi'}\`\n` +
    `ORKUT Username: \`${currentVars.ORKUT_USERNAME || 'Belum diisi'}\`\n` +
    `ORKUT Token: \`${maskSecret(currentVars.ORKUT_TOKEN)}\`\n` +
    `Merchant ID: \`${MERCHANT_ID || '-'}\`\n` +
    `API Key (legacy): \`${maskSecret(API_KEY)}\`\n` +
    `Expired QRIS: \`${ORDERKUOTA_QR_EXPIRE_MINUTES} menit\`\n` +
    `Minimal TopUp: \`Rp ${Math.round(getMinTopupByProvider('orderkuota')).toLocaleString('id-ID')}\`\n` +
    `Interval polling cek: \`${ORDERKUOTA_TRIGGERED_POLL_INTERVAL_SECONDS} detik\`\n` +
    `Cooldown tombol cek: \`${ORDERKUOTA_CHECK_BUTTON_COOLDOWN_SECONDS} detik\`\n` +
    `Maksimal tekan tombol: \`${ORDERKUOTA_CHECK_MAX_TAPS}x per transaksi\`\n` +
    `Auto-stop polling: \`${ORDERKUOTA_TRIGGERED_POLL_WINDOW_MINUTES} menit\`\n\n` +
    'Pilih parameter OrderKuota yang ingin diubah.';

  const keyboard = [
    [{ text: ORDERKUOTA_CREATE_MODE === 'gateway' ? 'Mode Create: Gateway' : 'Mode Create: Lokal', callback_data: 'payment_gateway_toggle_orderkuota_create_mode' }],
    [{ text: 'Set Gateway URL/Domain', callback_data: 'payment_gateway_set_url' }],
    [{ text: 'Set Gateway/Local API Key', callback_data: 'payment_gateway_set_raja_api_key' }],
    [{ text: 'Set QRIS String', callback_data: 'payment_gateway_set_qris' }],
    [{ text: 'Set ORKUT Username', callback_data: 'payment_gateway_set_orkut_username' }],
    [{ text: 'Set ORKUT Token', callback_data: 'payment_gateway_set_orkut_token' }],
    [{ text: 'Set Merchant ID', callback_data: 'payment_gateway_set_merchant_id' }],
    [{ text: 'Set API Key (legacy)', callback_data: 'payment_gateway_set_api_key' }],
    [{ text: 'Set Expired QRIS (menit)', callback_data: 'payment_gateway_set_orderkuota_expire' }],
    [{ text: 'Set Minimal TopUp', callback_data: 'payment_gateway_set_orderkuota_min_topup' }],
    [{ text: 'Set Interval Polling (detik)', callback_data: 'payment_gateway_set_orderkuota_poll_interval' }],
    [{ text: 'Set Cooldown Tombol (detik)', callback_data: 'payment_gateway_set_orderkuota_check_cooldown' }],
    [{ text: 'Set Maksimal Tekan Tombol', callback_data: 'payment_gateway_set_orderkuota_check_max_taps' }],
    [{ text: 'Set Stop Polling (menit)', callback_data: 'payment_gateway_set_orderkuota_poll_window' }],
    [{ text: ' Kembali', callback_data: 'payment_gateway_settings_menu' }]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendPaymentGatewayGoPayMenu(ctx) {
  reloadRuntimePaymentConfig();
  const message =
    '*SETTING GOPAY*\n\n' +
    `GoPay API Base URL: \`${GOPAY_API_BASE_URL || '-'}\`\n` +
    `GoPay API Key: \`${maskSecret(GOPAY_API_KEY)}\`\n` +
    `Expired QRIS: \`${GOPAY_QR_EXPIRE_MINUTES} menit\`\n` +
    `Minimal TopUp: \`Rp ${Math.round(getMinTopupByProvider('gopay')).toLocaleString('id-ID')}\`\n\n` +
    'Pilih parameter GoPay yang ingin diubah.';

  const keyboard = [
    [{ text: 'Set GoPay API Base URL', callback_data: 'payment_gateway_set_gopay_base_url' }],
    [{ text: 'Set GoPay API Key', callback_data: 'payment_gateway_set_gopay_api_key' }],
    [{ text: 'Set Expired QRIS (menit)', callback_data: 'payment_gateway_set_gopay_expire' }],
    [{ text: 'Set Masa Aktif QRIS Semua Gateway', callback_data: 'payment_gateway_set_all_qris_expire' }],
    [{ text: 'Set Minimal TopUp', callback_data: 'payment_gateway_set_gopay_min_topup' }],
    [{ text: ' Kembali', callback_data: 'payment_gateway_settings_menu' }]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

bot.action('payment_gateway_settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengakses menu ini.');
  }
  return sendPaymentGatewayMainMenu(ctx);
});

async function setPaymentGatewayMode(ctx, mode) {
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  const allowed = ['orderkuota', 'gopay', 'both'];
  if (!allowed.includes(mode)) return ctx.reply('Mode gateway tidak valid.');
  const nextVars = loadVars();
  nextVars.PAYMENT_GATEWAY_MODE = mode;
  saveVars(nextVars);
  reloadRuntimePaymentConfig();
  await ctx.answerCbQuery('Mode gateway tersimpan.');
  try {
    return await sendPaymentGatewayMainMenu(ctx);
  } catch (_) {
    return ctx.reply(`Mode gateway aktif: ${formatGatewayModeLabel()}`);
  }
}

bot.action('payment_gateway_mode_orderkuota', async (ctx) => setPaymentGatewayMode(ctx, 'orderkuota'));
bot.action('payment_gateway_mode_gopay', async (ctx) => setPaymentGatewayMode(ctx, 'gopay'));
bot.action('payment_gateway_mode_both', async (ctx) => setPaymentGatewayMode(ctx, 'both'));


bot.action('payment_gateway_toggle_orderkuota_create_mode', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  const nextVars = loadVars();
  const currentMode = String(nextVars.ORDERKUOTA_CREATE_MODE || ORDERKUOTA_CREATE_MODE || 'local').toLowerCase();
  nextVars.ORDERKUOTA_CREATE_MODE = currentMode === 'gateway' ? 'local' : 'gateway';
  saveVars(nextVars);
  reloadRuntimePaymentConfig();
  try {
    return await sendPaymentGatewayOrderKuotaMenu(ctx);
  } catch (_) {
    return ctx.reply(`Mode create QR OrderKuota: ${formatOrderKuotaCreateModeLabel()}`);
  }
});

bot.action('payment_gateway_menu_orderkuota', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  return sendPaymentGatewayOrderKuotaMenu(ctx);
});

bot.action('payment_gateway_menu_gopay', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  return sendPaymentGatewayGoPayMenu(ctx);
});

bot.action('payment_gateway_set_url', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_url_input' };
  await ctx.reply('Kirim URL/domain payment gateway. Contoh: api.rajaserver.web.id/orderkuota/createpayment. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_raja_api_key', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_raja_api_key_input' };
  await ctx.reply('Kirim RajaServer API Key baru. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_qris', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_qris_input' };
  await ctx.reply('Kirim DATA_QRIS string baru. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_orkut_username', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orkut_username_input' };
  await ctx.reply('Kirim ORKUT username untuk cek mutasi OrderKuota. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_orkut_token', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orkut_token_input' };
  await ctx.reply('Kirim ORKUT token untuk cek mutasi OrderKuota. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_merchant_id', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_merchant_id_input' };
  await ctx.reply('Kirim Merchant ID baru. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_api_key', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_api_key_input' };
  await ctx.reply('Kirim API Key legacy baru. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_orderkuota_expire', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orderkuota_expire_input' };
  await ctx.reply('Kirim masa expired QRIS OrderKuota dalam menit. Contoh: 10. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_orderkuota_min_topup', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orderkuota_min_topup_input' };
  await ctx.reply('Kirim minimal topup OrderKuota (angka rupiah). Contoh: 2000. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_orderkuota_poll_interval', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orderkuota_poll_interval_input' };
  await ctx.reply('Kirim interval polling cek pembayaran OrderKuota (detik). Contoh: 10. Rentang 5-120 detik.');
});

bot.action('payment_gateway_set_orderkuota_check_cooldown', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orderkuota_check_cooldown_input' };
  await ctx.reply('Kirim cooldown tombol cek pembayaran (detik). Contoh: 60. Rentang 10-600 detik.');
});

bot.action('payment_gateway_set_orderkuota_check_max_taps', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orderkuota_check_max_taps_input' };
  await ctx.reply('Kirim maksimal jumlah tekan tombol cek per transaksi. Contoh: 5. Rentang 1-20 kali.');
});

bot.action('payment_gateway_set_orderkuota_poll_window', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_orderkuota_poll_window_input' };
  await ctx.reply('Kirim durasi auto-stop polling setelah tombol cek ditekan (menit). Contoh: 3. Rentang 1-30 menit.');
});

bot.action('payment_gateway_set_gopay_base_url', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_gopay_base_url_input' };
  await ctx.reply('Kirim GoPay API base URL. Contoh: https://api-gopay.sawargipay.cloud. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_gopay_api_key', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_gopay_api_key_input' };
  await ctx.reply('Kirim GoPay API Key baru. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_gopay_expire', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_gopay_expire_input' };
  await ctx.reply('Kirim masa expired QRIS GoPay dalam menit. Contoh: 15. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_all_qris_expire', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_all_qris_expire_input' };
  await ctx.reply('Kirim masa aktif QRIS untuk semua gateway (OrderKuota + GoPay) dalam menit. Contoh: 15. Ketik "batal" untuk membatalkan.');
});

bot.action('payment_gateway_set_gopay_min_topup', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.reply('Anda tidak memiliki izin.');
  userState[ctx.chat.id] = { step: 'payment_gateway_gopay_min_topup_input' };
  await ctx.reply('Kirim minimal topup GoPay (angka rupiah). Contoh: 2000. Ketik "batal" untuk membatalkan.');
});
bot.action('restore_db_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengakses menu ini.');
  }

  const keyboard = [
    [{ text: 'Restore sellvpn.db', callback_data: 'restore_db_target_sellvpn' }],
    [{ text: 'Restore ressel.db', callback_data: 'restore_db_target_ressel' }],
    [{ text: 'Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.reply('Pilih database yang ingin di-restore:', {
    reply_markup: { inline_keyboard: keyboard }
  });
});

bot.action(/restore_db_target_(sellvpn|ressel)/, async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk melakukan aksi ini.');
  }

  const target = ctx.match[1];
  userState[ctx.chat.id] = { step: 'restore_db_upload', target };

  await ctx.reply(
    'Upload file backup untuk ' + target + '.db dalam format document.\n' +
    'Ketik "batal" untuk membatalkan.'
  );
});


bot.action('admin_contact_settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengakses menu ini.');
  }

  const wa = getAdminWhatsappNumber();
  const tg = getAdminTelegramUsername();
  const keyboard = [
    [{ text: 'Set Nomor WhatsApp', callback_data: 'admin_set_whatsapp' }],
    [{ text: 'Set Username Telegram', callback_data: 'admin_set_telegram' }],
    [{ text: ' Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.editMessageText(
    '* PENGATURAN KONTAK ADMIN*\n\n' +
    'WhatsApp: ' + (wa || '-') + '\n' +
    'Telegram: `' + tg + '`',
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }
  );
});

bot.action('admin_set_whatsapp', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'admin_contact_whatsapp' };
  await ctx.reply('Kirim nomor WhatsApp admin (format internasional, contoh: 6281234567890).\nKetik "batal" untuk membatalkan.');
});

bot.action('admin_set_telegram', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'admin_contact_telegram' };
  await ctx.reply('Kirim username Telegram admin (contoh: @myadmin atau myadmin).\nKetik "batal" untuk membatalkan.');
});
bot.action('toggle_topup_manual', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }

  const current = loadTopupManualSetting();
  const next = saveTopupManualSetting(!current);
  const statusText = next ? ' TopUp manual diaktifkan.' : ' TopUp manual dinonaktifkan.';
  await ctx.reply(statusText);
  return sendAdminSaldoMenu(ctx);
});

bot.action('toggle_topup_auto', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }

  const current = loadTopupAutoSetting();
  const next = saveTopupAutoSetting(!current);
  const statusText = next ? ' TopUp otomatis diaktifkan.' : ' TopUp otomatis dinonaktifkan.';
  await ctx.reply(statusText);
  return sendAdminSaldoMenu(ctx);
});

bot.action('toggle_sc_nexus_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }

  const current = loadScNexusMenuSetting();
  const next = saveScNexusMenuSetting(!current);
  const statusText = next
    ? ' Menu SC 1FORCR NEXUS diaktifkan.'
    : ' Menu SC 1FORCR NEXUS dinonaktifkan.';
  await ctx.reply(statusText);
  return sendAdminSaldoMenu(ctx);
});

bot.action('admin_menu_reseller', async (ctx) => {
  await ctx.answerCbQuery();
  await sendAdminResellerMenu(ctx);
});

bot.action('admin_menu_tools', async (ctx) => {
  await ctx.answerCbQuery();
  delete userState[ctx.chat.id];
  await sendAdminToolsMenu(ctx);
});

bot.action('toggle_test_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.answerCbQuery('Akses ditolak.', { show_alert: true });
  const current = loadTestMenuSetting();
  const next = saveTestMenuSetting(!current);
  await ctx.answerCbQuery(next ? '✅ Menu Test Transaksi diaktifkan' : '❌ Menu Test Transaksi dinonaktifkan', { show_alert: true });
  await sendAdminToolsMenu(ctx);
});

bot.action('admin_preorder_list', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.answerCbQuery('Akses ditolak.', { show_alert: true });

  const [ordersXla, ordersXda] = await Promise.all([
    dbGetAllPreorders('xla'),
    dbGetAllPreorders('xda'),
  ]);

  const formatList = (orders, label) => {
    if (!orders.length) return `<b>${label}</b>\n<i>Tidak ada antrian.</i>`;
    const lines = orders.map((o, i) =>
      `${i + 1}. <code>${o.user_id}</code> → <code>${o.produk_kode || '-'}</code> | ${o.tujuan || '-'} | Rp ${Number(o.harga || 0).toLocaleString('id-ID')}`
    ).join('\n');
    return `<b>${label}</b> (${orders.length} antrian)\n${lines}`;
  };

  const text =
    `📋 <b>Antrian Pre-Order Aktif</b>\n` +
    `<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n` +
    formatList(ordersXla, '🔵 XLA — Akrab V1') + '\n\n' +
    formatList(ordersXda, '🟢 XDA — Akrab V2');

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'admin_menu_tools' }]] },
  });
});

// ══════════════════════════════════════════
// MENU TEST TRANSAKSI (DRY RUN) — ADMIN ONLY
// ══════════════════════════════════════════
bot.action('admin_test_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;

  await ctx.editMessageText(
    `<code>🧪 TEST TRANSAKSI (DRY RUN)</code>\n` +
    `<code>──────────────────────</code>\n` +
    `<code>✦ Mode ini TIDAK memotong saldo</code>\n` +
    `<code>✦ TIDAK mengirim order ke provider</code>\n` +
    `<code>✦ Hanya cek alur kode berjalan</code>\n` +
    `<code>──────────────────────</code>\n` +
    `<code>Pilih layanan yang ingin ditest:</code>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💉 Test SMM (Suntik Followers)', callback_data: 'test_smm_start' }],
          [{ text: '🤝 Test Akrab V1/V2 (KHFY)', callback_data: 'test_akrab_start' }],
          [{ text: '📱 Test PPOB', callback_data: 'test_ppob_start' }],
          [{ text: '🔙 Kembali', callback_data: 'send_main_menu' }],
        ],
      },
    }
  );
});


bot.action('test_akrab_v3_start', async (ctx) => {
  await ctx.answerCbQuery('Memuat...');
  const userId = ctx.from.id;
  try {
    const produk = await ppob.getProdukList('Global');
    const aktif = produk.filter(p => (p.brand||'').toUpperCase().includes('AKRAB') && p.seller_product_status && p.buyer_product_status && (p.unlimited_stock||(p.stock||0)>0));
    if (!aktif.length) return ctx.editMessageText('<code>Tidak ada produk Akrab V3 tersedia.</code>', { parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙',callback_data:'admin_test_menu'}]]}});
    const s = aktif[0]; const harga = Number(s.price||0);
    userState[userId] = { step:'test_akrab_v3_input_nomor', testProduct:s, testFinalPrice:harga };
    await ctx.editMessageText('🧪 <b>TEST AKRAB V3 — DRY RUN</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n┃ 📱 Masukkan nomor HP test:',
      { parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙 Batal',callback_data:'admin_test_menu'}]]}});
  } catch(e) { await ctx.editMessageText('<code>'+e.message+'</code>', {parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙',callback_data:'admin_test_menu'}]]}}); }
});

bot.action('test_circle_start', async (ctx) => {
  await ctx.answerCbQuery('Memuat...');
  const userId = ctx.from.id;
  try {
    const produk = await ppob.getProdukList('Global');
    const aktif = produk.filter(p => (p.brand||'').toUpperCase().includes('CIRCLE') && p.seller_product_status && p.buyer_product_status && (p.unlimited_stock||(p.stock||0)>0));
    if (!aktif.length) return ctx.editMessageText('<code>Tidak ada produk Circle tersedia.</code>', { parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙',callback_data:'admin_test_menu'}]]}});
    const s = aktif[0]; const harga = Number(s.price||0);
    userState[userId] = { step:'test_circle_input_nomor', testProduct:s, testFinalPrice:harga };
    await ctx.editMessageText('🔴 <b>TEST CIRCLE — DRY RUN</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n┃ 📱 Masukkan nomor HP test:',
      { parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙 Batal',callback_data:'admin_test_menu'}]]}});
  } catch(e) { await ctx.editMessageText('<code>'+e.message+'</code>', {parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙',callback_data:'admin_test_menu'}]]}}); }
});

bot.action('test_ppob_start', async (ctx) => {
  await ctx.answerCbQuery('Memuat...');
  const userId = ctx.from.id;
  try {
    const produk = await ppob.getProdukList('data');
    const aktif = produk.filter(p => p.seller_product_status && p.buyer_product_status && (p.unlimited_stock||(p.stock||0)>0));
    if (!aktif.length) return ctx.editMessageText('<code>Tidak ada produk PPOB tersedia.</code>', { parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙',callback_data:'admin_test_menu'}]]}});
    const s = aktif[0]; const harga = Number(s.price||0);
    userState[userId] = { step:'test_ppob_input_nomor', testProduct:s, testFinalPrice:harga };
    await ctx.editMessageText('📱 <b>TEST PPOB — DRY RUN</b>\n<blockquote><code>┌────────────────────────┐</code>\n<code>│</code> 📦 <b>Produk</b>   : <code>'+s.product_name.slice(0,30)+'</code>\n<code>│</code> 🏷 <b>Kategori</b> : <code>'+s.category+'</code>\n<code>│</code> 📊 <b>Stok</b>     : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\n<code>│</code> 💰 <b>Harga</b>    : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\n<code>└────────────────────────┘</code></blockquote>\n📱 Masukkan nomor HP test:',
      { parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙 Batal',callback_data:'admin_test_menu'}]]}});
  } catch(e) { await ctx.editMessageText('<code>'+e.message+'</code>', {parse_mode:'HTML', reply_markup:{inline_keyboard:[[{text:'🔙',callback_data:'admin_test_menu'}]]}}); }
});

// ── Test SMM ─────────────────────────────────────────────────────────────────
bot.action('test_smm_start', async (ctx) => {
  await ctx.answerCbQuery('Memuat layanan SMM...');
  const userId = ctx.from.id;

  if (!FAYU_API_ID || !FAYU_API_KEY) {
    return ctx.editMessageText(
      `<code>❌ Credential FayuPedia belum diset.</code>\n<code>Isi via Admin → Setting API Keys.</code>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
    );
  }

  try {
    const services = await smmModule.getServices(FAYU_ENDPOINT, FAYU_API_ID, FAYU_API_KEY);
    if (!Array.isArray(services) || !services.length) {
      return ctx.editMessageText(
        `<code>❌ Tidak ada layanan dari API FayuPedia.</code>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
      );
    }

    // Ambil 1 layanan pertama sebagai sample
    const sample = services[0];
    const basePrice = parseFloat(sample.rate || sample.price || 0);
    const finalPrice = Math.ceil(basePrice * 1000);
    const min = parseInt(sample.min || 100);
    const bisaRefill = sample.refill === true || sample.refill === 'true' || sample.refill === 1;

    userState[userId] = { step: 'test_smm_input_target', testService: sample, testFinalPrice: finalPrice };

    await ctx.editMessageText(
      `<code>🧪 TEST SMM — DRY RUN</code>\n` +
      `<code>──────────────────────</code>\n` +
      `<code>✦ Layanan : ${String(sample.name || sample.service || '-').slice(0, 30)}</code>\n` +
      `<code>✦ Harga   : Rp ${finalPrice.toLocaleString('id-ID')} / 1000</code>\n` +
      `<code>✦ Min     : ${min.toLocaleString('id-ID')}</code>\n` +
      `<code>✦ Garansi : ${bisaRefill ? '🛡️ Ya' : '⚠️ Tidak'}</code>\n` +
      `<code>──────────────────────</code>\n` +
      `<code>✦ Masukkan target URL/username test:</code>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
    );
  } catch (err) {
    logger.error('test_smm_start: ' + (err && err.message ? err.message : err));
    await ctx.editMessageText(
      `<code>❌ Gagal koneksi ke FayuPedia: ${String(err && err.message || 'unknown').slice(0, 100)}</code>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
    );
  }
});

// ── Test Akrab ────────────────────────────────────────────────────────────────
bot.action('test_akrab_start', async (ctx) => {
  await ctx.answerCbQuery('Memuat produk Akrab...');
  const userId = ctx.from.id;

  if (!KHFY_API_KEY) {
    return ctx.editMessageText(
      `<code>❌ API Key Akrab belum diset.</code>\n<code>Isi via Admin → Setting API Keys.</code>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
    );
  }

  try {
    const products = await akrabModule.getProducts(KHFY_ENDPOINT, KHFY_API_KEY);
    if (!Array.isArray(products) || !products.length) {
      return ctx.editMessageText(
        `<code>❌ Tidak ada produk dari API Akrab.</code>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
      );
    }

    // Ambil 1 produk tersedia sebagai sample
    const sample = products.find(p => !(p.kosong == 1 || p.kosong === true)) || products[0];
    const kode = sample.kode_produk || sample.code || '-';
    const nama = sample.nama_produk || sample.name || kode;
    const harga = Number(sample.harga_final || sample.price || sample.harga || 0);

    userState[userId] = { step: 'test_akrab_input_nomor', testProduct: sample, testFinalPrice: harga };

    await ctx.editMessageText(
      `<code>🧪 TEST AKRAB — DRY RUN</code>\n` +
      `<code>──────────────────────</code>\n` +
      `<code>✦ Produk : ${nama.slice(0, 30)}</code>\n` +
      `<code>✦ Kode   : ${kode}</code>\n` +
      `<code>✦ Harga  : Rp ${harga.toLocaleString('id-ID')}</code>\n` +
      `<code>──────────────────────</code>\n` +
      `<code>✦ Masukkan nomor tujuan test:</code>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
    );
  } catch (err) {
    logger.error('test_akrab_start: ' + (err && err.message ? err.message : err));
    await ctx.editMessageText(
      `<code>❌ Gagal koneksi ke Akrab: ${String(err && err.message || 'unknown').slice(0, 100)}</code>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Menu Utama', callback_data: 'send_main_menu' }]] } }
    );
  }
});

bot.action('admin_download_config_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengakses menu ini.');
  }
  delete userState[ctx.chat.id];
  return sendAdminDownloadConfigMenu(ctx);
});

bot.action('admin_config_upload', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin untuk upload config.');
  }

  userState[ctx.chat.id] = { step: 'admin_config_upload_document' };
  return ctx.reply(
    'Kirim file config sebagai document.\n' +
    'Setelah file diterima, bot akan meminta nama config.\n\n' +
    'Ketik "batal" untuk membatalkan.'
  );
});

bot.action(/admin_config_delete_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin untuk menghapus config.');
  }

  const configId = Number(ctx.match[1]);
  if (!Number.isInteger(configId) || configId <= 0) {
    return ctx.reply('ID config tidak valid.');
  }

  const result = await dbRunAsync('DELETE FROM download_configs WHERE id = ?', [configId]).catch((err) => {
    logger.error('Gagal menghapus download config:', err.message);
    return null;
  });

  if (!result) {
    return ctx.reply('Gagal menghapus config.');
  }

  await ctx.reply(result.changes > 0 ? 'Config berhasil dihapus.' : 'Config tidak ditemukan.');
  return sendAdminDownloadConfigMenu(ctx);
});

bot.action('maintenance_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  return sendMaintenanceMenu(ctx);
});

bot.action('maintenance_toggle', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  const current = loadMaintenanceSetting();
  const next = saveMaintenanceSetting({
    enabled: !current.enabled,
    estimate: current.estimate || ''
  });
  await ctx.reply(next.enabled ? ' Mode maintenance diaktifkan.' : ' Mode maintenance dinonaktifkan.');
  return sendMaintenanceMenu(ctx);
});

bot.action('maintenance_set_estimate', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah pengaturan ini.');
  }
  userState[ctx.chat.id] = { step: 'maintenance_estimate_input' };
  return ctx.reply('Masukkan estimasi maintenance. Contoh: 30 menit atau 2 jam.\nKetik "batal" untuk membatalkan.');
});

bot.action('helpadmin_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await sendHelpAdmin(ctx);
});

// ── Join Channel Menu (Admin) ───────────────────────────────────────────────
async function sendJoinChannelMenu(ctx) {
  const setting = loadJoinChannelSetting();
  const statusLabel = setting.enabled ? '✅ ON' : '❌ OFF';
  const channelDisplay = setting.channel_url || '(belum diset)';
  const channelIdDisplay = setting.channel_id || '(belum diset)';

  const text =
    '*📢 SETTING WAJIB JOIN CHANNEL*\n\n' +
    `Status     : *${statusLabel}*\n` +
    `Channel URL: \`${channelDisplay}\`\n` +
    `Channel ID : \`${channelIdDisplay}\`\n\n` +
    '_Channel ID bisa berupa @username atau ID numerik (misal: -1001234567890)._\n' +
    '_Bot harus menjadi admin channel agar bisa cek status member._';

  const keyboard = [
    [{ text: setting.enabled ? 'Nonaktifkan' : '✅ Aktifkan', callback_data: 'join_channel_toggle' }],
    [{ text: '🔗 Set URL Channel', callback_data: 'join_channel_set_url' }],
    [{ text: '🆔 Set Channel ID', callback_data: 'join_channel_set_id' }],
    [{ text: '🔙 Kembali', callback_data: 'admin_menu_tools' }]
  ];

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  }).catch(async () => {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
  });
}

bot.action('join_channel_menu', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.answerCbQuery('Tidak ada izin!', { show_alert: true });
  await sendJoinChannelMenu(ctx);
});

bot.action('join_channel_toggle', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.answerCbQuery('Tidak ada izin!', { show_alert: true });
  const current = loadJoinChannelSetting();
  const next = saveJoinChannelSetting({ ...current, enabled: !current.enabled });
  await ctx.answerCbQuery(
    next.enabled ? '✅ Wajib join channel diaktifkan' : '❌ Wajib join channel dinonaktifkan',
    { show_alert: true }
  ).catch(() => {});
  await sendJoinChannelMenu(ctx);
});

bot.action('join_channel_set_url', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.answerCbQuery('Tidak ada izin!', { show_alert: true });
  userState[ctx.chat.id] = { step: 'join_channel_input_url' };
  await ctx.editMessageText(
    '🔗 *Set URL Channel*\n\nMasukkan URL channel Telegram.\nContoh: `https://t.me/namachannel`\n\nKetik *batal* untuk membatalkan.',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Batal', callback_data: 'join_channel_menu' }]] } }
  ).catch(async () => {
    await ctx.reply('Masukkan URL channel (contoh: https://t.me/namachannel):\nKetik batal untuk membatalkan.');
  });
});

bot.action('join_channel_set_id', async (ctx) => {
  await ctx.answerCbQuery();
  if (!adminIds.includes(ctx.from.id)) return ctx.answerCbQuery('Tidak ada izin!', { show_alert: true });
  userState[ctx.chat.id] = { step: 'join_channel_input_id' };
  await ctx.editMessageText(
    '🆔 *Set Channel ID*\n\nMasukkan username atau ID channel.\nContoh: `@namachannel` atau `-1001234567890`\n\n_Bot harus sudah menjadi admin di channel tersebut._\n\nKetik *batal* untuk membatalkan.',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Batal', callback_data: 'join_channel_menu' }]] } }
  ).catch(async () => {
    await ctx.reply('Masukkan Channel ID (contoh: @namachannel):\nKetik batal untuk membatalkan.');
  });
});


bot.action('admin_broadcast_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan fitur ini.');
  }

  userState[ctx.chat.id] = { step: 'admin_broadcast_message' };
  return ctx.reply('Masukkan pesan yang ingin disiarkan.\n\nKetik "batal" untuk membatalkan.');
});

bot.action('admin_broadcast_poll_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan fitur ini.');
  }

  userState[ctx.chat.id] = { step: 'admin_broadcast_poll_only_input' };
  return ctx.reply(
    'Masukkan polling dengan format:\n' +
    'Pertanyaan | Opsi A | Opsi B [| Opsi C ...]\n\n' +
    'Contoh:\n' +
    'Server favorit minggu ini? | SG1 | SG2 | ID1\n\n' +
    'Ketik "batal" untuk membatalkan.'
  );
});

bot.action('admin_broadcast_add_poll_yes', async (ctx) => {
  await ctx.answerCbQuery();
  const state = userState[ctx.chat.id];
  if (!state || state.step !== 'admin_broadcast_choose_poll') {
    return ctx.reply('Sesi broadcast tidak ditemukan. Ulangi dari menu tools.');
  }

  state.step = 'admin_broadcast_poll_input';
  return ctx.reply(
    'Masukkan polling dengan format:\n' +
    'Pertanyaan | Opsi A | Opsi B [| Opsi C ...]\n\n' +
    'Contoh:\n' +
    'Server favorit minggu ini? | SG1 | SG2 | ID1\n\n' +
    'Ketik "batal" untuk membatalkan.'
  );
});

bot.action('admin_broadcast_add_poll_no', async (ctx) => {
  await ctx.answerCbQuery();
  const state = userState[ctx.chat.id];
  if (!state || state.step !== 'admin_broadcast_choose_poll') {
    return ctx.reply('Sesi broadcast tidak ditemukan. Ulangi dari menu tools.');
  }

  const msg = String(state.message || '').trim();
  if (!msg) {
    delete userState[ctx.chat.id];
    return ctx.reply('Pesan broadcast kosong. Ulangi dari menu tools.');
  }

  const result = await broadcastMessageToAllUsers(msg);
  delete userState[ctx.chat.id];

  await ctx.reply(
    'Broadcast selesai.\n' +
    '- Berhasil: ' + result.ok + '\n' +
    '- Gagal: ' + result.fail
  );

  return sendAdminToolsMenu(ctx);
});
bot.action('reseller_terms_trigger', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk menjalankan cek ini.');
  }

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const periodLabel = start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    await evaluateResellerTermsForPeriod(start.getTime(), end.getTime(), periodLabel);
    await ctx.reply(` Cek syarat reseller untuk periode ${periodLabel} selesai.`);
  } catch (err) {
    logger.error('Error trigger cek syarat reseller:', err.message);
    await ctx.reply(' Gagal menjalankan cek syarat reseller.');
  }
});

bot.action('reseller_restore', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk mengubah reseller.');
  }

  userState[ctx.chat.id] = { step: 'reseller_restore_input' };
  await ctx.reply('Kirim ID Telegram reseller yang ingin diaktifkan kembali:');
});

bot.action('auto_backup_now', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply(' Anda tidak memiliki izin untuk menjalankan backup.');
  }

  // 1. Backup database files (sellvpn.db + ressel.db)
  const files = [
    path.join(__dirname, 'sellvpn.db'),
    path.join(__dirname, 'ressel.db')
  ];

  for (const filePath of files) {
    if (fs.existsSync(filePath)) {
      await sendAutoBackup(filePath, adminId);
    } else {
      logger.warn(`Backup manual dilewati, file tidak ditemukan: ${filePath}`);
    }
  }

  // 2. Backup saldo JSON (terpisah dari DB)
  await runAutoBackupGlobal();

  await ctx.reply('✅ Backup database dan backup saldo telah dikirim.');
});
bot.action('admin_sync_server_now', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk menjalankan sinkronisasi server.');
  }

  try {
    await ctx.reply('Menjalankan sinkronisasi server...');
    const result = await syncServerUsageFromTunnel('manual_button', { force: true });

    const lines = [
      'Sync server selesai.',
      `Dicek: ${result.checked}`,
      `Berhasil: ${result.updated}`,
      `Gagal: ${result.failed}`,
      `Dilewati: ${result.skipped}`,
      '',
      `Total akun aktif: ${result.totals.used}`,
      `Total akun tersisa: ${result.totals.remaining}`,
      `Total kapasitas: ${result.totals.capacity}`
    ];

    if (result.errors.length > 0) {
      const preview = result.errors.slice(0, 5)
        .map((e) => `- ${e.serverName || e.serverId}: ${e.message}`)
        .join('\n');
      lines.push('', 'Detail gagal (maks 5):', preview);
    }

    await ctx.reply(lines.join('\n'));
  } catch (err) {
    logger.error('Gagal sync server dari tombol admin:', err.message);
    await ctx.reply('Gagal menjalankan sinkronisasi server.');
  }
});
bot.action('admin_sync_server_toggle_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengatur autosync server.');
  }
  await sendAdminSyncToggleMenu(ctx);
});

bot.action(/admin_sync_server_toggle_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengatur autosync server.');
  }

  const serverId = Number(ctx.match[1]);
  if (!Number.isFinite(serverId)) {
    return ctx.reply('ID server tidak valid.');
  }

  db.get('SELECT id, sync_enabled FROM Server WHERE id = ?', [serverId], (err, row) => {
    if (err) {
      logger.error('Gagal membaca status sync server:', err.message);
      return ctx.reply('Gagal membaca status autosync server.');
    }

    if (!row) {
      return ctx.reply('Server tidak ditemukan.');
    }

    const nextValue = Number(row.sync_enabled) === 1 ? 0 : 1;
    db.run('UPDATE Server SET sync_enabled = ? WHERE id = ?', [nextValue, serverId], async (updateErr) => {
      if (updateErr) {
        logger.error('Gagal mengubah status autosync server:', updateErr.message);
        return ctx.reply('Gagal mengubah status autosync server.');
      }

      await sendAdminSyncToggleMenu(ctx);
    });
  });
});


bot.action('reseller_terms_menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (!adminIds.includes(adminId)) {
      return ctx.reply('Anda tidak memiliki izin untuk mengakses menu ini.');
    }

    const terms = loadResellerTerms();
    const message =
      '📋 <b>SYARAT RESELLER</b>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\n┃ 💰 <b>Top Up Awal</b>   : <code>'+formatRupiah(terms.join_topup_min)+'</code>\n┃ 📅 <b>Top Up Bulanan</b> : <code>'+formatRupiah(terms.min_topup)+'</code>\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\nGunakan tombol di bawah untuk mengubah syarat.';


    const keyboard = [
      [{ text: 'Set Minimal TopUp Jadi Reseller', callback_data: 'reseller_terms_set_join' }],
      [{ text: 'Set Minimal TopUp Bulanan', callback_data: 'reseller_terms_set' }],
      [{ text: 'Kembali', callback_data: 'admin_menu' }]
    ];

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (error) {
    if (error.response && error.response.error_code === 400) {
      await ctx.reply('Gagal membuka menu. Silakan coba lagi.');
    } else {
      logger.error('Error membuka menu syarat reseller:', error.message);
    }
  }
});

bot.action('reseller_terms_set', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengubah syarat.');
  }

  userState[ctx.chat.id] = { step: 'reseller_terms_input' };
  await ctx.reply(
    'Kirim format: <min_topup>\n' +
    'Contoh: 30000\n' +
    'Ketik \"batal\" untuk membatalkan.'
  );
});

bot.action('reseller_terms_set_join', async (ctx) => {
  await ctx.answerCbQuery();
  const adminId = ctx.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk mengubah syarat.');
  }

  userState[ctx.chat.id] = { step: 'reseller_join_topup_input' };
  await ctx.reply(
    'Kirim format: <minimal_topup_jadi_reseller>\n' +
    'Contoh: 18000\n' +
    'Ketik \"batal\" untuk membatalkan.'
  );
});

bot.command('addressel', async (ctx) => {
  try {
    const requesterId = ctx.from.id;

    // Hanya admin yang bisa menjalankan perintah ini
    if (!adminIds.includes(requesterId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk melakukan tindakan ini.');
    }

    // Ambil ID Telegram dari argumen
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply(' Format salah. Gunakan perintah:\n/addressel <id_telegram_user>');
    }

    const targetId = args[1];

    // Baca file ressel.db jika ada, kalau tidak, buat file baru
    let resellerList = [];
    if (fs.existsSync(resselFilePath)) {
      const fileContent = fs.readFileSync(resselFilePath, 'utf8');
      resellerList = fileContent.split('\n').filter(line => line.trim() !== '');
    }

    // Cek apakah ID sudah ada
    if (resellerList.includes(targetId)) {
      return ctx.reply(` User dengan ID ${targetId} sudah menjadi reseller.`);
    }

    // Tambahkan ID ke file
    fs.appendFileSync(resselFilePath, `${targetId}\n`);
    ctx.reply(` User dengan ID ${targetId} berhasil dijadikan reseller.`);

  } catch (e) {
    logger.error(' Error di command /addressel:', e.message);
    ctx.reply(' Terjadi kesalahan saat menjalankan perintah.');
  }
});

bot.command('delressel', async (ctx) => {
  try {
    const requesterId = ctx.from.id;

    // Hanya admin yang bisa menjalankan perintah ini
    if (!adminIds.includes(requesterId)) {
      return ctx.reply(' Anda tidak memiliki izin untuk melakukan tindakan ini.');
    }

    // Ambil ID Telegram dari argumen
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply(' Format salah. Gunakan perintah:\n/delressel <id_telegram_user>');
    }

    const targetId = args[1];

    // Cek apakah file ressel.db ada
    if (!fs.existsSync(resselFilePath)) {
      return ctx.reply(' File reseller belum dibuat.');
    }

    // Baca file dan filter ulang tanpa targetId
    const fileContent = fs.readFileSync(resselFilePath, 'utf8');
    const resellerList = fileContent.split('\n').filter(line => line.trim() !== '' && line.trim() !== targetId);

    // Tulis ulang file dengan data yang sudah difilter
    fs.writeFileSync(resselFilePath, resellerList.join('\n') + (resellerList.length ? '\n' : ''));

    ctx.reply(` User dengan ID ${targetId} berhasil dihapus dari daftar reseller.`);

  } catch (e) {
    logger.error(' Error di command /delressel:', e.message);
    ctx.reply(' Terjadi kesalahan saat menjalankan perintah.');
  }
});

///////
// Saat admin mengirim foto QRIS
bot.on('photo', async (ctx) => {
  const adminId = ctx.from.id;
  const state = userState[adminId];
  if (!state || state.step !== 'upload_qris') return;

  const fileId = ctx.message.photo.pop().file_id;
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const filePath = path.join(__dirname, 'qris.jpg');

  const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
  fs.writeFileSync(filePath, Buffer.from(response.data));

  await ctx.reply(' Gambar QRIS berhasil diunggah!');
  logger.info(' QRIS image uploaded by admin');
  delete userState[adminId];
});

bot.on('document', async (ctx, next) => {
  const adminId = ctx.from.id;
  const state = userState[adminId];
  if (!state) return next();

  if (state.step === 'admin_config_upload_document') {
    if (!adminIds.includes(adminId)) {
      return ctx.reply('Anda tidak memiliki izin untuk upload config.');
    }

    const doc = ctx.message.document;
    userState[adminId] = {
      step: 'admin_config_name_input',
      doc: {
        file_id: doc.file_id,
        file_unique_id: doc.file_unique_id || '',
        file_name: String(doc.file_name || 'config'),
        mime_type: String(doc.mime_type || ''),
        file_size: Number(doc.file_size || 0)
      }
    };

    return ctx.reply(
      'File config diterima.\n' +
      'Sekarang kirim nama config yang akan tampil di menu user.\n\n' +
      'Contoh: Config ZIVPN SG 1\n' +
      'Ketik "batal" untuk membatalkan.'
    );
  }

  // ── Restore Saldo dari file JSON ──────────────────────────────────────────
  if (state.step === 'restore_saldo_upload') {
    if (!adminIds.includes(adminId)) return ctx.reply('Akses ditolak.');

    const doc = ctx.message.document;
    const fileName = String(doc.file_name || '');
    if (!fileName.endsWith('.json')) {
      return ctx.reply('❌ File harus berformat <b>.json</b>. Kirim ulang file yang benar.', { parse_mode: 'HTML' });
    }

    try {
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);
      const axios = require('axios');
const QRCode = require('qrcode');
      const resp = await axios.get(fileLink.href, { responseType: 'text', timeout: 15000 });
      const backupData = JSON.parse(resp.data);

      if (!backupData.users || !Array.isArray(backupData.users)) {
        return ctx.reply('❌ Format file tidak valid. Pastikan file adalah hasil backup saldo bot ini.');
      }

      let updatedUsers = 0;
      let restoredResellers = 0;

      // Restore saldo per user
      for (const u of backupData.users) {
        if (!u.user_id) continue;
        await new Promise((resolve) =>
          db.run(
            'UPDATE users SET saldo = ?, saldo_akrab = ? WHERE user_id = ?',
            [Number(u.saldo_vpn || 0), Number(u.saldo_akrab || 0), u.user_id],
            () => resolve()
          )
        );
        updatedUsers++;
      }

      // Restore daftar reseller
      if (Array.isArray(backupData.resellers) && backupData.resellers.length > 0) {
        const lines = backupData.resellers.map(id => String(id).trim()).filter(Boolean);
        fs.writeFileSync(resselFilePath, lines.join('\n') + '\n', 'utf8');
        restoredResellers = lines.length;
      }

      delete userState[adminId];

      await ctx.reply(
        '✅ <b>Restore Saldo Berhasil!</b>\n' +
        '<code>──────────────────────</code>\n' +
        `✦ User diperbarui  : <b>${updatedUsers}</b>\n` +
        `✦ Reseller dipulihkan : <b>${restoredResellers}</b>\n` +
        `✦ Sumber backup    : <code>${backupData.timestamp || '-'}</code>\n` +
        '<code>──────────────────────</code>',
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_backup_saldo' }]] },
        }
      );
    } catch (err) {
      logger.error('restore_saldo_upload: ' + (err && err.message ? err.message : err));
      await ctx.reply(
        '❌ Restore gagal: ' + (err && err.message ? err.message : 'unknown'),
        { reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_backup_saldo' }]] } }
      );
    }
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (state.step !== 'restore_db_upload') return next();

  if (!adminIds.includes(adminId)) {
    return ctx.reply('Anda tidak memiliki izin untuk restore database.');
  }

  const target = state.target === 'sellvpn' ? 'sellvpn' : 'ressel';
  const doc = ctx.message.document;
  const originalName = String(doc.file_name || (target + '.db'));

  try {
    const uploadDir = path.join(__dirname, 'backup', 'restore_uploads');
    fs.mkdirSync(uploadDir, { recursive: true });

    const tempName = Date.now() + '_' + originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = path.join(uploadDir, tempName);
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    fs.writeFileSync(tempPath, Buffer.from(response.data));

    const livePath = target === 'sellvpn'
      ? path.join(__dirname, 'sellvpn.db')
      : path.join(__dirname, 'ressel.db');

    const backupDir = path.join(__dirname, 'backup');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, target + '.before_restore.' + Date.now() + '.db');

    if (fs.existsSync(livePath)) {
      fs.copyFileSync(livePath, backupPath);
    }

    if (target === 'sellvpn') {
      await new Promise((resolve) => {
        db.close(() => resolve());
      });
    }

    fs.copyFileSync(tempPath, livePath);
    fs.unlinkSync(tempPath);

    delete userState[adminId];

    if (target === 'sellvpn') {
      await ctx.reply('Restore sellvpn.db berhasil. Bot akan restart otomatis untuk memuat database baru.');
      setTimeout(() => process.exit(0), 1200);
      return;
    }

    return ctx.reply('Restore ressel.db berhasil.');
  } catch (err) {
    logger.error('Gagal restore database:', err.message);
    return ctx.reply('Gagal restore database. Pastikan file backup valid.');
  }
});

// ══════════════════════════════════════════
// MENU BACKUP & RESTORE SALDO
// ══════════════════════════════════════════
bot.action('menu_backup_saldo', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const isAdminUser = Array.isArray(adminIds) ? adminIds.includes(userId) : Number(adminIds) === userId;
  if (!isAdminUser) return ctx.answerCbQuery('Akses ditolak.', { show_alert: true });

  await ctx.editMessageText(
    '💾 <b>BACKUP &amp; RESTORE SALDO</b>\n' +
    '<code>──────────────────────</code>\n' +
    '✦ Backup : ekspor semua saldo member &amp; reseller ke file JSON\n' +
    '✦ Restore : impor saldo dari file backup\n' +
    '<code>──────────────────────</code>\n' +
    '<i>Backup mencakup: saldo VPN, saldo tembak kuota, dan daftar reseller.</i>',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📤 Backup Saldo Sekarang', callback_data: 'backup_saldo_now' }],
          [{ text: '📥 Restore Saldo dari File', callback_data: 'restore_saldo_prompt' }],
          [{ text: '🔙 Kembali', callback_data: 'admin_menu' }],
        ],
      },
    }
  );
});

bot.action('backup_saldo_now', async (ctx) => {
  await ctx.answerCbQuery('Memproses backup...');
  const userId = ctx.from.id;
  const isAdminUser = Array.isArray(adminIds) ? adminIds.includes(userId) : Number(adminIds) === userId;
  if (!isAdminUser) return;

  try {
    // Ambil semua data saldo user dari DB
    const users = await new Promise((resolve, reject) =>
      db.all('SELECT user_id, saldo, saldo_akrab FROM users', [], (err, rows) => err ? reject(err) : resolve(rows || []))
    );

    // Ambil daftar reseller
    let resellerList = [];
    try {
      resellerList = listResellersSync();
    } catch (_) {}

    const backupData = {
      timestamp: new Date().toISOString(),
      generated_by: userId,
      total_users: users.length,
      total_resellers: resellerList.length,
      users: users.map(u => ({
        user_id: u.user_id,
        saldo_vpn: u.saldo || 0,
        saldo_akrab: u.saldo_akrab || 0,
      })),
      resellers: resellerList,
    };

    const json = JSON.stringify(backupData, null, 2);
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const fileName = `backup_saldo_${ts}.json`;
    const filePath = path.join(__dirname, fileName);

    fs.writeFileSync(filePath, json, 'utf8');

    await ctx.telegram.sendDocument(
      userId,
      { source: filePath, filename: fileName },
      {
        caption:
          `💾 <b>Backup Saldo Berhasil</b>\n` +
          `<code>──────────────────────</code>\n` +
          `✦ Tanggal  : ${now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
          `✦ Jam      : ${now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
          `✦ Total User     : ${users.length}\n` +
          `✦ Total Reseller : ${resellerList.length}\n` +
          `<code>──────────────────────</code>\n` +
          `<i>Simpan file ini untuk restore saldo.</i>`,
        parse_mode: 'HTML',
      }
    );

    // Hapus file temp
    try { fs.unlinkSync(filePath); } catch (_) {}

    await ctx.editMessageText(
      '✅ <b>Backup selesai!</b>\n\nFile dikirim ke chat Anda.',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_backup_saldo' }]] },
      }
    );
  } catch (err) {
    logger.error('backup_saldo_now: ' + (err && err.message ? err.message : err));
    await ctx.editMessageText(
      '❌ Backup gagal: ' + (err && err.message ? err.message : 'unknown'),
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_backup_saldo' }]] },
      }
    );
  }
});

bot.action('restore_saldo_prompt', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const isAdminUser = Array.isArray(adminIds) ? adminIds.includes(userId) : Number(adminIds) === userId;
  if (!isAdminUser) return;

  userState[userId] = { step: 'restore_saldo_upload' };

  await ctx.editMessageText(
    '📥 <b>Restore Saldo</b>\n' +
    '<code>──────────────────────</code>\n' +
    '✦ Kirim file <b>.json</b> hasil backup ke chat ini.\n' +
    '✦ Saldo VPN dan tembak kuota semua member akan diperbarui.\n' +
    '✦ Daftar reseller juga akan dipulihkan.\n' +
    '<code>──────────────────────</code>\n' +
    '<i>⚠️ Proses ini akan menimpa saldo yang ada sekarang.</i>',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Batal', callback_data: 'menu_backup_saldo' }]] },
    }
  );
});

// ── Submenu Top Up (gabungan: VPN + Tembak Kuota) ──────────────────────────
bot.action('menu_topup', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const saldoVpn = await dbH.getSaldo(db, userId).catch(() => 0);
  const saldoAkrab = await dbH.getSaldoAkrab(db, userId).catch(() => 0);

  const keyboard = [];

  // Top Up VPN (otomatis / manual sesuai setting)
  if (loadTopupAutoSetting()) {
    keyboard.push([{ text: 'Top Up Saldo VPN (Otomatis)', callback_data: 'topup_saldo', style: 'success' }]);
  }
  if (loadTopupManualSetting()) {
    keyboard.push([{ text: 'Top Up Saldo VPN (Manual QRIS)', callback_data: 'topup_manual', style: 'primary' }]);
  }
  // Top Up Tembak Kuota (wallet Akrab)
  keyboard.push([{ text: 'Top Up Saldo Tembak Otomatis', callback_data: 'topup_akrab', style: 'success' }]);
  keyboard.push([{ text: 'Menu Utama', callback_data: 'send_main_menu' }]);

  const msgText =
    '💳 <b>TOP UP SALDO</b>\n' +
    '<code>──────────────────────</code>\n' +
    '<i>💡 Saldo VPN → Akun VPN & Suntik Followers</i>\n' +
    '<i>💡 Saldo Tembak Kuota → Akrab & PPOB</i>\n\n' +
    '✦ Pilih jenis saldo yang ingin di-top up:';
    '<code>──────────────────────</code>\n' +
    '<i>VPN: Akun VPN + Suntik Followers</i>\n' +
    '<i>Tembak Kuota: Akrab & PPOB</i>\n\n' +
    '✦ Pilih jenis saldo yang ingin di-top up:';

  await ctx.editMessageText(msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } })
    .catch(async () => { await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }); });
});

//  BUAT INI SATU SAJA (tempat yang sama dengan action lainnya)
bot.action('topup_saldo', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!loadTopupAutoSetting()) {
      await ctx.reply(
        ' *TOP-UP OTOMATIS SEDANG NONAKTIF*\n\n' +
        'Silakan gunakan menu *TopUp Manual* untuk sementara.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    reloadRuntimePaymentConfig();
    const readiness = getPaymentGatewayReadiness();
    if (!hasReadyEnabledPaymentGateway(readiness)) {
      await ctx.reply(
        ' *TOP-UP OTOMATIS SEMENTARA TIDAK TERSEDIA*\n\n' +
        'Admin belum mengkonfigurasi sistem pembayaran.\n' +
        'Sistem tidak dapat memverifikasi pembayaran Anda.\n\n' +
        ` Hubungi admin: ${ADMIN_USERNAME}\n\n` +
        ' *Admin bisa cek konfigurasi dengan:*\n' +
        '`/checkpaymentconfig`\n\n' +
        '_Admin sudah mendapatkan notifikasi untuk segera memperbaiki sistem._',
        { parse_mode: 'Markdown' }
      );
      logger.warn(`User ${ctx.from.id} mencoba topup tapi tidak ada payment gateway aktif yang siap: ${formatMissingGatewayConfig(readiness)}`);
      return;
    }
    
    //  MODE ENABLED - Credential sudah benar
    const userId = ctx.from.id;
    
    if (!global.depositState) {
      global.depositState = {};
    }
    const minTopupForMode = getMinTopupByGatewayMode(PAYMENT_GATEWAY_MODE);
    global.depositState[userId] = {
      action: 'request_amount',
      amount: '',
      topupPurpose: 'regular',
      minAmount: minTopupForMode
    };
    
    const keyboard = keyboard_nomor();
    
    const bonusCfg = loadTopupBonusSetting();
    const bonusInfo = bonusCfg.enabled
      ? (
        ` *BONUS TOPUP OTOMATIS:*\n` +
        `• 10-49rb: ${bonusCfg.range_10_40}%\n` +
        `• 50-79rb: ${bonusCfg.range_50_70}%\n` +
        `• 80rb+: ${bonusCfg.range_70_100}%\n\n`
      )
      : '';
    const feeDisplay = getTopupFeeDisplay(PAYMENT_GATEWAY_MODE);

    await ctx.editMessageText(
      ' *TOP UP SALDO OTOMATIS*\n\n' +
      ` *Minimal:* Rp ${minTopupForMode.toLocaleString('id-ID')}\n\n` +
      bonusInfo +
      feeDisplay.menuNotice +
      ' *PERHATIAN:*\n' +
      feeDisplay.transferNotice +
      'Silakan masukkan jumlah top-up:',
      {
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'Markdown'
      }
    );
    
    logger.info(`User ${userId} memulai topup (credential valid)`);
    
  } catch (error) {
    logger.error(' Error in topup_saldo handler:', error);
    await ctx.reply(
      ' Terjadi kesalahan sistem.\nSilakan coba lagi atau hubungi admin.',
      { parse_mode: 'Markdown' }
    );
  }
});

bot.action('download_config_menu', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  try {
    return await sendDownloadConfigMenu(ctx);
  } catch (err) {
    logger.error('Gagal membuka menu download config:', err.message);
    return ctx.reply('Terjadi kesalahan saat membuka menu download config.');
  }
});

bot.action(/download_config_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const configId = Number(ctx.match[1]);
  if (!Number.isInteger(configId) || configId <= 0) {
    return ctx.reply('Config tidak valid.');
  }

  try {
    const row = await dbGetAsync(
      `SELECT id, name, file_id, file_name, file_size
       FROM download_configs
       WHERE id = ?`,
      [configId]
    );

    if (!row) {
      return ctx.reply('Config tidak ditemukan atau sudah dihapus.', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Kembali', callback_data: 'download_config_menu' }]]
        }
      });
    }

    const caption =
      `<b>${escapeHtml(row.name || row.file_name || 'Config')}</b>\n` +
      `File: <code>${escapeHtml(row.file_name || '-')}</code>`;

    return await ctx.telegram.sendDocument(ctx.chat.id, row.file_id, {
      caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Kembali ke List Config', callback_data: 'download_config_menu' }]]
      }
    });
  } catch (err) {
    logger.error('Gagal mengirim download config:', err.message);
    return ctx.reply('Gagal mengirim config. Silakan coba lagi nanti.');
  }
});

// ===  HUBUNGI ADMIN (WHATSAPP) ===
bot.action('hubungi_admin', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;
    const userName = ctx.from.first_name || ctx.from.username || `User ${userId}`;

    const adminWhatsApp = getAdminWhatsappNumber();
    const adminWhatsappUrl = getAdminWhatsappUrl();
    if (!adminWhatsApp || !adminWhatsappUrl) {
      return ctx.reply(` Kontak WhatsApp admin belum diset. Silakan hubungi ${getAdminTelegramUsername()} terlebih dahulu.`);
    }

    const autoMessage = encodeURIComponent(
      `Hallo min aku dari bot mau menyampaikan sesuatu\n\n` +
      `ID Telegram: ${userId}\n` +
      `Nama: ${userName}`
    );

    const whatsappUrl = `${adminWhatsappUrl}?text=${autoMessage}`;

    await ctx.reply(
      ` *HUBUNGI ADMIN*\n\n` +
      `Klik tombol di bawah untuk menghubungi admin via WhatsApp:\n\n` +
      ` Nama Anda: *${userName}*\n` +
      `🆔 ID Telegram: *${userId}*\n\n` +
      `ℹ *ID Telegram Anda sudah disertakan dalam pesan otomatis*\n\n` +
      `Pesan otomatis sudah disiapkan. Anda bisa mengeditnya sebelum mengirim.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: ' Buka WhatsApp (Pesan Otomatis)', url: whatsappUrl }],
            [{ text: ' Kirim Pesan Manual', url: adminWhatsappUrl }],
            [{ text: ' Kembali', callback_data: 'send_main_menu' }]
          ]
        }
      }
    );

    logger.info(`User ${userId} membuka menu hubungi admin`);
  } catch (error) {
    logger.error(' Error di tombol hubungi_admin:', error.message);
    await ctx.reply(' Terjadi kesalahan saat membuka WhatsApp. Silakan coba lagi.');
  }
});


bot.action('check_expiry_account', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;

  let isReseller = false;
  try {
    isReseller = await isUserReseller(userId);
  } catch (e) {
    logger.error('Error cek role reseller untuk cek masa aktif:', e.message);
  }

  db.all(
    `SELECT MIN(id) AS id,
            host AS server_name
     FROM (
       SELECT id,
              LOWER(TRIM(COALESCE(NULLIF(sync_host, ''), NULLIF(domain, ''), ''))) AS host
       FROM Server
       WHERE COALESCE(is_active, 1) = 1
         AND (COALESCE(is_reseller_only, 0) = 0 OR ? = 1)
     ) grouped
     WHERE host <> ''
     GROUP BY host
     ORDER BY host COLLATE NOCASE ASC`,
    [isReseller ? 1 : 0],
    async (err, rows) => {
      if (err) {
        logger.error('Error ambil daftar server cek masa aktif:', err.message);
        return ctx.reply('Terjadi kesalahan saat memuat daftar server.');
      }

      if (!rows || rows.length === 0) {
        return ctx.reply('Belum ada server tersedia untuk role akun kamu.');
      }

      const keyboard = rows.map((row) => ([{
        text: row.server_name,
        callback_data: `check_expiry_server_${row.id}`
      }]));

      keyboard.push([{ text: 'Kembali', callback_data: 'send_main_menu' }]);

      await ctx.reply(
        'Akun kamu ada di server mana? untuk melihatnya kamu bisa cek di informasi akun kamu\n\n'+
        'Pilih server untuk cek masa aktif akun:',
         {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  );
});

bot.action(/check_expiry_server_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const serverId = Number(ctx.match[1]);

  db.get('SELECT id, nama_server, domain FROM Server WHERE id = ?', [serverId], async (err, row) => {
    if (err) {
      logger.error('Error ambil server cek masa aktif:', err.message);
      return ctx.reply('Terjadi kesalahan saat mengambil data server.');
    }

    if (!row) {
      return ctx.reply('Server tidak ditemukan.');
    }

    userState[ctx.chat.id] = {
      step: 'check_expiry_username',
      serverId,
      serverName: row.nama_server || row.domain || ('ID ' + serverId)
    };

    await ctx.reply(
      'Masukkan username akun yang ingin dicek masa aktifnya.\n' +
      'Ketik "batal" untuk membatalkan.'
    );
  });
});

db.run(`CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  type TEXT,
  username TEXT,
  password TEXT,
  server_id INTEGER,
  server_name TEXT,
  domain TEXT,
  link_tls TEXT,
  link_none TEXT,
  link_grpc TEXT,
  link_uptls TEXT,
  link_upntls TEXT,
  account_ip_package INTEGER DEFAULT 1,
  account_price_per_day INTEGER DEFAULT 0,
  created_at INTEGER,
  expires_at INTEGER
)`, (err) => {
  if (err) {
    logger.error('Kesalahan membuat tabel accounts:', err.message);
  } else {
    logger.info('Accounts table created or already exists');
    migrateAccountServerByDomain()
      .then((res) => {
        if (res && res.updated > 0) {
          logger.info('Migrasi accounts server_id selesai: ' + res.updated + '/' + res.total + ' data diperbarui');
        }
      })
      .catch((e) => logger.error('Error migrasi accounts server_id:', e.message));
  }
});

db.all("PRAGMA table_info(accounts)", (err, rows) => {
  if (err) {
    logger.error('Error checking accounts schema:', err.message);
    return;
  }
  const cols = rows.map(r => r.name);
  if (!cols.includes('link_tls')) db.run("ALTER TABLE accounts ADD COLUMN link_tls TEXT");
  if (!cols.includes('link_none')) db.run("ALTER TABLE accounts ADD COLUMN link_none TEXT");
  if (!cols.includes('link_grpc')) db.run("ALTER TABLE accounts ADD COLUMN link_grpc TEXT");
  if (!cols.includes('link_uptls')) db.run("ALTER TABLE accounts ADD COLUMN link_uptls TEXT");
  if (!cols.includes('link_upntls')) db.run("ALTER TABLE accounts ADD COLUMN link_upntls TEXT");
  if (!cols.includes('account_ip_package')) db.run("ALTER TABLE accounts ADD COLUMN account_ip_package INTEGER DEFAULT 1");
  if (!cols.includes('account_price_per_day')) db.run("ALTER TABLE accounts ADD COLUMN account_price_per_day INTEGER DEFAULT 0");
});

bot.action('view_accounts', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const now = Date.now();

  db.get(
    'SELECT COUNT(*) as count FROM accounts WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)',
    [userId, now],
    async (err, row) => {
      if (err) {
        logger.error(' Error hitung akun aktif:', err.message);
        return ctx.reply(' Terjadi kesalahan saat memuat akun.');
      }
      const total = row ? row.count : 0;
      const keyboard = [
        [{ text: ' Lihat Akun Aktif Saya', callback_data: 'view_accounts_active' }]
      ];
      if (total > 10) {
        keyboard.push([{ text: ' Lihat Semua Akun Saya', callback_data: 'view_accounts_active_all' }]);
      }
      keyboard.push([{ text: ' Lihat Akun Expired', callback_data: 'view_accounts_expired' }]);
      keyboard.push([{ text: ' Kembali', callback_data: 'send_main_menu' }]);

      await ctx.reply(' *Lihat Akun Saya*', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  );
});


const SELF_DELETE_TYPE_HANDLERS = {
  ssh: delssh,
  vmess: delvmess,
  vless: delvless,
  trojan: deltrojan,
  udp_http: deludphttp,
  zivpn: delzivpn
};

function calcRemainingDays(expiresAt) {
  if (!expiresAt) return 0;
  const diff = Number(expiresAt) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function getEffectiveServerPackagePrice(serverRow, isReseller, ipPackage) {
  const pkg = ipPackage === 2 ? '2ip' : '1ip';
  if (isReseller) {
    return pkg === '2ip'
      ? Number(serverRow?.harga_reseller_2ip || serverRow?.harga_reseller || 0)
      : Number(serverRow?.harga_reseller_1ip || serverRow?.harga_reseller || 0);
  }
  return pkg === '2ip'
    ? Number(serverRow?.harga_2ip || serverRow?.harga || 0)
    : Number(serverRow?.harga_1ip || serverRow?.harga || 0);
}

function isServerDailyPriceEnabled(serverRow) {
  return Number(serverRow?.harga_mode_harian_enabled ?? 1) !== 0;
}

function isServerMonthlyPriceEnabled(serverRow) {
  return Number(serverRow?.harga_mode_30hari_enabled ?? 0) === 1;
}

function getEffectiveServerMonthlyPackagePrice(serverRow, isReseller, ipPackage) {
  const pkg = ipPackage === 2 ? '2ip' : '1ip';
  const dailyFallback = getEffectiveServerPackagePrice(serverRow, isReseller, ipPackage) * 30;
  let rawPrice;

  if (isReseller) {
    rawPrice = pkg === '2ip'
      ? Number(serverRow?.harga_reseller_2ip_30hari || 0)
      : Number(serverRow?.harga_reseller_1ip_30hari || 0);
  } else {
    rawPrice = pkg === '2ip'
      ? Number(serverRow?.harga_2ip_30hari || 0)
      : Number(serverRow?.harga_1ip_30hari || 0);
  }

  return Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : dailyFallback;
}

function normalizeCreatePriceMode(rawMode) {
  return String(rawMode || '').toLowerCase() === '30hari' ? '30hari' : 'daily';
}

function formatCreatePriceMode(mode) {
  return normalizeCreatePriceMode(mode) === '30hari' ? '30 Hari' : 'Harian';
}

function getCreateBillingPrice(serverRow, isReseller, ipPackage, mode, expDays) {
  const normalizedMode = normalizeCreatePriceMode(mode);
  const days = Math.max(1, Number(expDays || 0));
  if (normalizedMode === '30hari') {
    return getEffectiveServerMonthlyPackagePrice(serverRow, isReseller, ipPackage);
  }
  return getEffectiveServerPackagePrice(serverRow, isReseller, ipPackage) * days;
}

function getStoredAccountPricePerDay(totalPrice, expDays, fallbackDailyPrice) {
  const total = Number(totalPrice || 0);
  const days = Number(expDays || 0);
  if (Number.isFinite(total) && total > 0 && Number.isFinite(days) && days > 0) {
    return Math.max(0, Math.floor(total / days));
  }
  return Math.max(0, Number(fallbackDailyPrice || 0));
}

function getEffectiveServerPrice(serverRow, isReseller) {
  return getEffectiveServerPackagePrice(serverRow, isReseller, 1);
}

const SERVER_IPLIMIT_PROTOCOLS = [
  { key: 'ssh', label: 'SSH / OVPN' },
  { key: 'zivpn', label: 'ZIVPN' },
  { key: 'vmess', label: 'VMESS' },
  { key: 'vless', label: 'VLESS' },
  { key: 'trojan', label: 'TROJAN' },
  { key: 'shadowsocks', label: 'SHADOWSOCKS' },
  { key: 'udp_http', label: 'UDP HTTP' }
];

function normalizeIpLimitProtocol(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'ssh';
  if (value === 'udp' || value === 'udp_http' || value === 'udp-http' || value === 'udphc' || value === 'udp_http_custom') {
    return 'udp_http';
  }
  if (value === 'ovpn' || value === 'openvpn') {
    return 'ssh';
  }
  if (SERVER_IPLIMIT_PROTOCOLS.some((item) => item.key === value)) {
    return value;
  }
  return value;
}

function getDefaultServerIpLimit(protocol, ipPackage) {
  const pkg = Number(ipPackage || 1) === 2 ? 2 : 1;
  return normalizeIpLimitProtocol(protocol) === 'udp_http'
    ? (pkg === 2 ? 4 : 3)
    : (pkg === 2 ? 3 : 2);
}

async function getServerIpLimitRuleMap(serverId, protocol) {
  const normalizedProtocol = normalizeIpLimitProtocol(protocol);
  const rows = await dbAllAsync(
    'SELECT ip_package, iplimit FROM server_iplimit_rules WHERE server_id = ? AND protocol = ?',
    [serverId, normalizedProtocol]
  ).catch(() => []);

  const result = { 1: getDefaultServerIpLimit(normalizedProtocol, 1), 2: getDefaultServerIpLimit(normalizedProtocol, 2) };
  rows.forEach((row) => {
    const pkg = Number(row?.ip_package || 0) === 2 ? 2 : 1;
    const limit = Number(row?.iplimit);
    if (Number.isFinite(limit) && limit >= 0) {
      result[pkg] = limit;
    }
  });
  return result;
}

async function getServerIpLimitRule(serverId, protocol, ipPackage) {
  const normalizedProtocol = normalizeIpLimitProtocol(protocol);
  const pkg = Number(ipPackage || 1) === 2 ? 2 : 1;
  const row = await dbGetAsync(
    'SELECT iplimit FROM server_iplimit_rules WHERE server_id = ? AND protocol = ? AND ip_package = ?',
    [serverId, normalizedProtocol, pkg]
  ).catch(() => null);

  if (row) {
    const limit = Number(row.iplimit);
    if (Number.isFinite(limit) && limit >= 0) {
      return limit;
    }
  }
  return getDefaultServerIpLimit(normalizedProtocol, pkg);
}

async function saveServerIpLimitRule(serverId, protocol, ipPackage, iplimit) {
  const normalizedProtocol = normalizeIpLimitProtocol(protocol);
  const pkg = Number(ipPackage || 1) === 2 ? 2 : 1;
  const limit = Number(iplimit);
  if (!Number.isFinite(limit) || limit < 0) {
    throw new Error('Limit IP harus angka 0 atau lebih.');
  }

  const now = Date.now();
  await dbRunAsync(
    `INSERT INTO server_iplimit_rules (server_id, protocol, ip_package, iplimit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(server_id, protocol, ip_package)
     DO UPDATE SET iplimit = excluded.iplimit, updated_at = excluded.updated_at`,
    [serverId, normalizedProtocol, pkg, limit, now, now]
  );
}

function normalizeCreateAccountMessageForDisplay(message, selectedPackage) {
  const pkg = Number(selectedPackage || 1) === 2 ? 2 : 1;
  const text = String(message || '');
  if (!text.trim()) return text;

  // Paksa info IP yang tampil ke user tetap 1IP/2IP (bukan limit internal server).
  // Line-based agar format markdown seperti "*IP Limit* : 3 device" tetap ter-handle.
  const lines = text.split('\n');
  const normalized = lines.map((line) => {
    if (!/ip\s*limit|limit\s*ip|max(?:imum)?\s*(?:login|ip)|login\s*maks/i.test(line)) {
      return line;
    }

    const replaced = line.replace(/([:=]\s*`?)(\d+)(\s*(?:`)?(?:\s*(?:ip|device|devices|pengguna))?)/i, `$1${pkg}$3`);
    if (replaced !== line) return replaced;

    return line.replace(/(\D)(\d+)(\D*)$/, `$1${pkg}$3`);
  });

  return normalized.join('\n');
}

function resolveAccountIpPackage(accountRow) {
  const storedPkg = Number(accountRow?.account_ip_package ?? accountRow?.accountIpPackage ?? 0);
  if (storedPkg === 2) return 2;
  if (storedPkg === 1) return 1;

  const type = accountRow?.type || accountRow?.service || '';
  const iplimitCandidate =
    accountRow?.accountIpLimit ??
    accountRow?.limitip ??
    accountRow?.iplimit ??
    accountRow?.server_iplimit ??
    0;
  return inferIpPackageByAccount(type, iplimitCandidate);
}

function resolveAccountPricePerDay(serverRow, isReseller, accountRow, preferStored = true) {
  const storedPrice = Number(accountRow?.account_price_per_day ?? accountRow?.accountPricePerDay ?? 0);
  if (preferStored && Number.isFinite(storedPrice) && storedPrice > 0) {
    return storedPrice;
  }
  const pkg = resolveAccountIpPackage(accountRow);
  return getEffectiveServerPackagePrice(serverRow, isReseller, pkg);
}

function isStrongCreateUsername(username) {
  const letterCount = (username.match(/[a-z]/g) || []).length;
  const digitCount = (username.match(/[0-9]/g) || []).length;
  return letterCount >= 4 && digitCount >= 4;
}

bot.action('delete_my_account_intro', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply(
    ' *Hapus Akun Saya*\n\n' +
    'Penghapusan hanya bisa jika sisa masa aktif minimal 2 hari.\n' +
    'Akun baru bisa dihapus setelah aktif minimal 24 jam.\n' +
    'Konversi saldo dihitung full sesuai sisa hari.\n\n' +
    'Lanjut pilih server akun yang ingin dihapus.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: ' Pilih Server', callback_data: 'delete_my_account_select_server' }],
          [{ text: ' Kembali', callback_data: 'send_main_menu' }]
        ]
      }
    }
  );
});

bot.action('delete_my_account_select_server', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const now = Date.now();

  let isReseller = false;
  try {
    isReseller = await isUserReseller(userId);
  } catch (e) {
    logger.error('Error cek role reseller:', e.message);
  }

  db.all(
    `SELECT s.id AS server_id,
            COALESCE(NULLIF(s.nama_server, ''), s.domain, 'Server') AS server_name,
            (
              SELECT COUNT(*)
              FROM accounts a
              WHERE a.user_id = ?
                AND (a.expires_at IS NULL OR a.expires_at > ?)
                AND (
                  a.server_id = s.id
                  OR (
                    TRIM(COALESCE(s.domain, '')) <> ''
                    AND LOWER(TRIM(COALESCE(a.domain, ''))) = LOWER(TRIM(COALESCE(s.domain, '')))
                    AND (
                      (UPPER(COALESCE(s.nama_server, '')) LIKE '%1IP%' AND UPPER(COALESCE(a.server_name, '')) LIKE '%1IP%')
                      OR (UPPER(COALESCE(s.nama_server, '')) LIKE '%2IP%' AND UPPER(COALESCE(a.server_name, '')) LIKE '%2IP%')
                      OR (
                        UPPER(COALESCE(s.nama_server, '')) NOT LIKE '%1IP%'
                        AND UPPER(COALESCE(s.nama_server, '')) NOT LIKE '%2IP%'
                        AND UPPER(COALESCE(a.server_name, '')) NOT LIKE '%1IP%'
                        AND UPPER(COALESCE(a.server_name, '')) NOT LIKE '%2IP%'
                      )
                    )
                  )
                )
            ) AS total_accounts
     FROM Server s
     WHERE COALESCE(s.is_active, 1) = 1
       AND (COALESCE(s.is_reseller_only, 0) = 0 OR ? = 1)
     ORDER BY server_name COLLATE NOCASE ASC`,
    [userId, now, isReseller ? 1 : 0],
    async (err, rows) => {
      if (err) {
        logger.error('Error ambil server akun user:', err.message);
        return ctx.reply('Terjadi kesalahan saat memuat daftar server akun.');
      }

      if (!rows || rows.length === 0) {
        return ctx.reply('Tidak ada akun aktif di server ini.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Pilih Server Lain', callback_data: 'delete_my_account_select_server' }],
              [{ text: 'Kembali', callback_data: 'send_main_menu' }]
            ]
          }
        });
      }

      const keyboard = rows.map((row) => ([{
        text: `${row.server_name} (${row.total_accounts} akun)`,
        callback_data: `delete_my_account_server_${row.server_id}`
      }]));
      keyboard.push([{ text: 'Kembali', callback_data: 'delete_my_account_intro' }]);

      await ctx.reply('Pilih server akun yang ingin dihapus:', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  );
});

async function renderRemoteDeleteAccountPage(ctx, page = 0) {
  const state = userState[ctx.chat.id]?.remote_delete_accounts;
  if (!state || !Array.isArray(state.rows) || state.rows.length === 0) {
    return ctx.reply('Tidak ada akun remote untuk ditampilkan.');
  }

  const pageSize = Number(state.pageSize || 10);
  const total = state.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  const start = safePage * pageSize;
  const end = Math.min(start + pageSize, total);
  const rows = state.rows.slice(start, end);

  const keyboard = rows.map((row, idx) => {
    const absIndex = start + idx;
    const remainingDays = row.expires_at ? calcRemainingDays(row.expires_at) : calcRemainingDaysFromDateExp(row.date_exp);
    return [{
      text: `${row.username} (${String(row.type || '-').toUpperCase()}, ${remainingDays} hari)`,
      callback_data: `delete_my_account_remote_pick_${absIndex}`
    }];
  });

  const nav = [];
  if (safePage > 0) nav.push({ text: 'Sebelumnya', callback_data: `delete_my_account_remote_page_${safePage - 1}` });
  if (safePage < totalPages - 1) nav.push({ text: 'Selanjutnya', callback_data: `delete_my_account_remote_page_${safePage + 1}` });
  if (nav.length) keyboard.push(nav);
  keyboard.push([{ text: 'Pilih Server', callback_data: 'delete_my_account_select_server' }]);

  return ctx.reply(
    `Pilih akun yang ingin dihapus (data server):\nServer: ${state.serverName}\nHalaman ${safePage + 1}/${totalPages}`,
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

bot.action(/delete_my_account_server_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const now = Date.now();
  const serverId = Number(ctx.match[1]);

  db.all(
    `SELECT a.id, a.type, a.username, a.server_name, a.domain, a.expires_at,
            COALESCE(s.harga, 0) AS harga
     FROM accounts a
     LEFT JOIN Server s ON s.id = a.server_id
     LEFT JOIN Server ss ON ss.id = ?
     WHERE a.user_id = ?
       AND (
         a.server_id = ?
         OR (
           TRIM(COALESCE(ss.domain, '')) <> ''
           AND LOWER(TRIM(COALESCE(a.domain, ''))) = LOWER(TRIM(COALESCE(ss.domain, '')))
           AND (
             (UPPER(COALESCE(ss.nama_server, '')) LIKE '%1IP%' AND UPPER(COALESCE(a.server_name, '')) LIKE '%1IP%')
             OR (UPPER(COALESCE(ss.nama_server, '')) LIKE '%2IP%' AND UPPER(COALESCE(a.server_name, '')) LIKE '%2IP%')
             OR (
               UPPER(COALESCE(ss.nama_server, '')) NOT LIKE '%1IP%'
               AND UPPER(COALESCE(ss.nama_server, '')) NOT LIKE '%2IP%'
               AND UPPER(COALESCE(a.server_name, '')) NOT LIKE '%1IP%'
               AND UPPER(COALESCE(a.server_name, '')) NOT LIKE '%2IP%'
             )
           )
         )
       )
       AND (a.expires_at IS NULL OR a.expires_at > ?)
     ORDER BY a.expires_at ASC, a.id ASC`,
    [serverId, userId, serverId, now],
    async (err, rows) => {
      if (err) {
        logger.error('Error ambil akun berdasarkan server:', err.message);
        return ctx.reply('Terjadi kesalahan saat memuat akun server.');
      }

      if (!rows || rows.length === 0) {
        const serverRow = await dbGetAsync('SELECT id, nama_server, domain, sync_host, auth FROM Server WHERE id = ?', [serverId]).catch(() => null);
        if (!serverRow) {
          return ctx.reply('Server tidak ditemukan.', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Pilih Server Lain', callback_data: 'delete_my_account_select_server' }],
                [{ text: 'Kembali', callback_data: 'send_main_menu' }]
              ]
            }
          });
        }

        const remoteRowsRaw = await fetchOwnedAccountsByTelegramFromServer(serverRow, userId);
        const remoteRows = remoteRowsRaw.filter((r) => !r.expires_at || r.expires_at > now);
        if (remoteRows.length === 0) {
          return ctx.reply('Tidak ada akun aktif yang terhubung ke server ini.', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Pilih Server Lain', callback_data: 'delete_my_account_select_server' }],
                [{ text: 'Kembali', callback_data: 'send_main_menu' }]
              ]
            }
          });
        }

        userState[ctx.chat.id] = userState[ctx.chat.id] || {};
        userState[ctx.chat.id].remote_delete_accounts = {
          serverId,
          serverName: serverRow.nama_server || serverRow.domain || ('ID ' + serverId),
          rows: remoteRows,
          pageSize: 10
        };
        return renderRemoteDeleteAccountPage(ctx, 0);
      }

      const keyboard = rows.map((row) => {
        const remainingDays = calcRemainingDays(row.expires_at);
        return [{
          text: `${row.username} (${String(row.type || '-').toUpperCase()}, ${remainingDays} hari)`,
          callback_data: `delete_my_account_pick_${row.id}`
        }];
      });
      keyboard.push([{ text: 'Pilih Server', callback_data: 'delete_my_account_select_server' }]);

      await ctx.reply('Pilih akun yang ingin dihapus:', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  );
});

bot.action(/delete_my_account_remote_page_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const page = Number(ctx.match[1] || 0);
  await renderRemoteDeleteAccountPage(ctx, Number.isFinite(page) ? page : 0);
});

bot.action(/delete_my_account_remote_pick_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const idx = Number(ctx.match[1] || -1);
  const state = userState[ctx.chat.id]?.remote_delete_accounts;
  if (!state || !Array.isArray(state.rows) || idx < 0 || idx >= state.rows.length) {
    return ctx.reply('Data akun tidak ditemukan, silakan pilih ulang.');
  }

  const row = state.rows[idx];
  const isReseller = await isUserReseller(ctx.from.id).catch(() => false);
  const remainingDays = row.expires_at ? calcRemainingDays(row.expires_at) : calcRemainingDaysFromDateExp(row.date_exp);
  const serverData = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [row.server_id]).catch(() => null);
  const accountPkg = resolveAccountIpPackage({
    type: row.type,
    account_ip_package: row.account_ip_package,
    limitip: row.limitip || row.iplimit
  });
  const pricePerDay = resolveAccountPricePerDay(serverData || {}, isReseller, {
    account_ip_package: accountPkg,
    account_price_per_day: row.account_price_per_day
  }, true);
  const refund = Math.max(0, remainingDays * pricePerDay);

  await ctx.reply(
    'Konfirmasi Hapus Akun\n\n' +
    `- <b>Username:</b> ${escapeHtml(row.username || '-')}\n` +
    `- <b>Layanan:</b> ${escapeHtml(String(row.type || '-').toUpperCase())}\n` +
    `- <b>Server:</b> ${escapeHtml(row.server_name || row.domain || '-')}\n` +
    `- <b>Sisa hari:</b> ${remainingDays} hari\n` +
    `- <b>Konversi saldo:</b> Rp ${Number(refund).toLocaleString('id-ID')}\n\n` +
    (remainingDays < 2 ? 'Akun ini belum bisa dihapus. Minimal sisa masa aktif 2 hari.' : 'Akun akan dihapus permanen dari server.'),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...((remainingDays >= 2) ? [[{ text: 'Ya, Hapus Akun Ini', callback_data: `delete_my_account_remote_confirm_${idx}` }]] : []),
          [{ text: 'Batal', callback_data: 'delete_my_account_select_server' }]
        ]
      }
    }
  );
});

bot.action(/delete_my_account_remote_confirm_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const idx = Number(ctx.match[1] || -1);
  const state = userState[ctx.chat.id]?.remote_delete_accounts;
  if (!state || !Array.isArray(state.rows) || idx < 0 || idx >= state.rows.length) {
    return ctx.reply('Data akun tidak ditemukan, silakan pilih ulang.');
  }

  const row = state.rows[idx];
  const isReseller = await isUserReseller(ctx.from.id).catch(() => false);
  const remainingDays = row.expires_at ? calcRemainingDays(row.expires_at) : calcRemainingDaysFromDateExp(row.date_exp);
  if (remainingDays < 2) {
    return ctx.reply('Akun belum bisa dihapus. Minimal sisa masa aktif 2 hari.');
  }

  const deleteFn = SELF_DELETE_TYPE_HANDLERS[row.type] || SELF_DELETE_TYPE_HANDLERS.ssh;
  const result = await deleteFn(row.username, 'none', 'none', 'none', row.server_id);
  const resultText = typeof result === 'string' ? result : JSON.stringify(result || {});
  if (/gagal|error|failed|tidak\s+ditemukan|not\s+found/i.test(resultText)) {
    return ctx.reply(`Gagal hapus akun dari server.\n\n${resultText}`);
  }

  const serverData = await dbGetAsync('SELECT * FROM Server WHERE id = ?', [row.server_id]).catch(() => null);
  const accountPkg = resolveAccountIpPackage({
    type: row.type,
    account_ip_package: row.account_ip_package,
    limitip: row.limitip || row.iplimit
  });
  const pricePerDay = resolveAccountPricePerDay(serverData || {}, isReseller, {
    account_ip_package: accountPkg,
    account_price_per_day: row.account_price_per_day
  }, true);
  const refund = Math.max(0, remainingDays * pricePerDay);
  if (refund > 0) {
    await dbRunAsync('INSERT OR IGNORE INTO users (user_id, saldo) VALUES (?, 0)', [ctx.from.id]).catch(() => {});
    await dbRunAsync('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [refund, ctx.from.id]).catch(() => {});
    await dbRunAsync(
      'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
      [ctx.from.id, refund, 'delete_refund', `delete_refund_remote_${Date.now()}`, Date.now()]
    ).catch(() => {});
  }

  state.rows.splice(idx, 1);
  await ctx.reply(
    `Akun berhasil dihapus.\n` +
    `- Username: ${row.username}\n` +
    `- Layanan: ${String(row.type || '-').toUpperCase()}\n` +
    `- Server: ${row.server_name || row.domain || '-'}\n` +
    `- Konversi ke saldo: Rp ${Number(refund).toLocaleString('id-ID')}`
  );
});

bot.action(/delete_my_account_pick_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const accountId = Number(ctx.match[1]);
  const isReseller = await isUserReseller(userId).catch(() => false);

  db.get(
    `SELECT a.*, COALESCE(s.harga, 0) AS harga, COALESCE(s.harga_reseller, 0) AS harga_reseller
     FROM accounts a
     LEFT JOIN Server s ON s.id = a.server_id
     WHERE a.id = ? AND a.user_id = ?`,
    [accountId, userId],
    async (err, row) => {
      if (err) {
        logger.error(' Error ambil detail akun untuk hapus mandiri:', err.message);
        return ctx.reply(' Terjadi kesalahan saat memuat detail akun.');
      }
      if (!row) {
        return ctx.reply(' Akun tidak ditemukan atau bukan milik kamu.');
      }

      const remainingDays = calcRemainingDays(row.expires_at);
      const accountAgeMs = Date.now() - Number(row.created_at || 0);
      const lockDelete24h = !isReseller && (!Number.isFinite(accountAgeMs) || accountAgeMs < (24 * 60 * 60 * 1000));
      const pricePerDay = resolveAccountPricePerDay(row, isReseller, row, true);
      const refund = Math.max(0, remainingDays * pricePerDay);
      const serverLabel = row.server_name || row.domain || '-';

      await ctx.reply(
        'Konfirmasi Hapus Akun\n\n' +
        `- <b>Username:</b> ${escapeHtml(row.username || '-')}\n` +
        `- <b>Layanan:</b> ${escapeHtml(String(row.type || '-').toUpperCase())}\n` +
        `- <b>Server:</b> ${escapeHtml(serverLabel)}\n` +
        `- <b>Sisa hari:</b> ${remainingDays} hari\n` +
        `- <b>Konversi saldo:</b> Rp ${Number(refund).toLocaleString('id-ID')}\n\n` +
        ((remainingDays < 2 || lockDelete24h)
          ? `Akun ini belum bisa dihapus.${remainingDays < 2 ? ' Minimal sisa masa aktif 2 hari.' : ''}${lockDelete24h ? ' Akun harus aktif minimal 24 jam.' : ''}`
          : 'Akun akan dihapus permanen dari server.'),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              ...((remainingDays >= 2 && !lockDelete24h) ? [[{ text: 'Ya, Hapus Akun Ini', callback_data: `delete_my_account_confirm_${row.id}` }]] : []),
              [{ text: 'Batal', callback_data: 'delete_my_account_select_server' }]
            ]
          }
        }
      );
    }
  );
});

bot.action(/delete_my_account_confirm_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const accountId = Number(ctx.match[1]);
  const isReseller = await isUserReseller(userId).catch(() => false);

  const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
  const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

  try {
    const row = await dbGet(
      `SELECT a.*, COALESCE(s.harga, 0) AS harga, COALESCE(s.harga_reseller, 0) AS harga_reseller
       FROM accounts a
       LEFT JOIN Server s ON s.id = a.server_id
       WHERE a.id = ? AND a.user_id = ?`,
      [accountId, userId]
    );

    if (!row) {
      return ctx.reply(' Akun tidak ditemukan atau sudah terhapus.');
    }

    const deleteFn = SELF_DELETE_TYPE_HANDLERS[row.type];
    if (!deleteFn) {
      return ctx.reply(` Layanan ${row.type} belum didukung untuk hapus mandiri.`);
    }

    const result = await deleteFn(row.username, 'none', 'none', 'none', row.server_id);
    const resultText = typeof result === 'string' ? result : JSON.stringify(result || {});
    if (/gagal|error|failed|tidak\s+ditemukan|not\s+found/i.test(resultText)) {
      logger.error(` Gagal hapus akun mandiri ${row.username} (${row.type}): ${resultText}`);
      return ctx.reply(` Gagal hapus akun dari server.\n\n${resultText}`);
    }

    const remainingDays = calcRemainingDays(row.expires_at);
    if (remainingDays < 2) {
      return ctx.reply('Akun belum bisa dihapus. Minimal sisa masa aktif 2 hari.');
    }
    const accountAgeMs = Date.now() - Number(row.created_at || 0);
    if (!isReseller && (!Number.isFinite(accountAgeMs) || accountAgeMs < (24 * 60 * 60 * 1000))) {
      return ctx.reply('Akun belum bisa dihapus. Akun harus aktif minimal 24 jam.');
    }
    const pricePerDay = resolveAccountPricePerDay(row, isReseller, row, true);
    const refund = Math.max(0, remainingDays * pricePerDay);

    await dbRun('DELETE FROM accounts WHERE id = ? AND user_id = ?', [accountId, userId]);

    if (refund > 0) {
      await dbRun('INSERT OR IGNORE INTO users (user_id, saldo) VALUES (?, 0)', [userId]);
      await dbRun('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [refund, userId]);
      await dbRun(
        'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?, ?, ?, ?, ?)',
        [userId, refund, 'delete_refund', `delete_refund_${accountId}_${Date.now()}`, Date.now()]
      );
    }

    await notifyGroupAccountDeleted({
      action: 'self_delete',
      actorId: ctx.from.id,
      actorUsername: ctx.from.username || '',
      targetUserId: userId,
      accountUsername: row.username,
      service: String(row.type || '-').toUpperCase(),
      serverName: row.server_name || row.domain || '-',
      refund,
      remainingDays,
      note: 'User hapus akun sendiri'
    });

    await ctx.reply(
      ` Akun berhasil dihapus.\n` +
      `• Username: ${row.username}\n` +
      `• Layanan: ${String(row.type || '-').toUpperCase()}\n` +
      `• Server: ${row.server_name || row.domain || '-'}\n` +
      `• Konversi ke saldo: Rp ${Number(refund).toLocaleString('id-ID')}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: ' Hapus Akun Lain', callback_data: 'delete_my_account_select_server' }],
            [{ text: ' Menu Utama', callback_data: 'send_main_menu' }]
          ]
        }
      }
    );
  } catch (e) {
    logger.error(' Error konfirmasi hapus akun mandiri:', e.message);
    await ctx.reply(' Terjadi kesalahan saat menghapus akun.');
  }
});
async function renderRemoteOwnedAccountsPage(ctx, page = 0) {
  const state = userState[ctx.chat.id]?.remote_owned_accounts;
  if (!state || !Array.isArray(state.rows) || state.rows.length === 0) {
    return ctx.reply('Tidak ada akun remote untuk ditampilkan.');
  }

  const pageSize = Number(state.pageSize || 10);
  const total = state.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  const start = safePage * pageSize;
  const end = Math.min(start + pageSize, total);
  const rows = state.rows.slice(start, end);

  const lines = rows.map((row, idx) => {
    const no = start + idx + 1;
    const expText = row.expires_at
      ? formatDateId(new Date(row.expires_at))
      : (row.date_exp || '-');
    return (
      `${no}. ${String(row.type || '-').toUpperCase()} - ${row.username}\n` +
      `   Server: ${row.server_name || row.domain || '-'}\n` +
      `   Expired: ${expText}`
    );
  });

  const keyboard = [];
  const nav = [];
  if (safePage > 0) nav.push({ text: 'Sebelumnya', callback_data: `view_accounts_remote_page_${safePage - 1}` });
  if (safePage < totalPages - 1) nav.push({ text: 'Selanjutnya', callback_data: `view_accounts_remote_page_${safePage + 1}` });
  if (nav.length) keyboard.push(nav);
  keyboard.push([{ text: 'Kembali', callback_data: 'view_accounts' }]);

  return ctx.reply(
    `Daftar akun dari server (halaman ${safePage + 1}/${totalPages})\n\n${lines.join('\n\n')}`,
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

async function renderLocalOwnedAccountsPage(ctx, listType = 'active', page = 0) {
  const state = userState[ctx.chat.id]?.local_owned_accounts;
  if (!state || !Array.isArray(state.rows) || state.rows.length === 0) {
    return ctx.reply(listType === 'expired' ? ' Tidak ada akun expired.' : ' Tidak ada akun aktif.');
  }
  if (String(state.type || 'active') !== String(listType || 'active')) {
    return ctx.reply(' Daftar akun sudah berubah. Buka ulang dari menu "Lihat Akun Saya".');
  }

  const pageSize = Number(state.pageSize || 4);
  const total = state.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  const start = safePage * pageSize;
  const end = Math.min(start + pageSize, total);
  const rows = state.rows.slice(start, end);

  const escapeHtmlLocal = (text) => {
    if (!text && text !== 0) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const typeIcon = { ssh:'🔵', vmess:'🟡', vless:'🟣', trojan:'🔴', zivpn:'🟠', udp_http:'🟢', shadowsocks:'⚪' };
  const blocks = rows.map((row, idx) => {
    const number = start + idx + 1;
    const expDate = row.expires_at ? new Date(row.expires_at) : null;
    const expText = expDate ? formatDateTimeId(expDate) : '-';
    const nowMs = Date.now();
    const sisaHari = expDate ? Math.ceil((expDate.getTime() - nowMs) / 86400000) : null;
    const expWarn = sisaHari !== null && sisaHari <= 3 ? ' ⚠️' : '';
    const type = String(row.type || '').toLowerCase();
    const icon = typeIcon[type] || '⚪';
    const serverName = escapeHtmlLocal(row.server_name || row.domain || '-');
    const domain = escapeHtmlLocal(row.domain || '-');
    const username = escapeHtmlLocal(row.username || '-');
    const password = escapeHtmlLocal(row.password || '');
    const hasLinks = row.link_tls || row.link_none || row.link_grpc || row.link_uptls || row.link_upntls;
    let block = `<code>┌──────────────────────────────────┐</code>
`;
    block += `<code>│ #${number} · ${icon} ${type.toUpperCase()}</code>
`;
    block += `<code>├──────────────────────────────────┤</code>
`;
    block += `🖥  ${serverName}
`;
    block += `🌐  <code>${domain}</code>
`;
    block += `👤  <code>${username}</code>
`;
    if (password) block += `🔑  <code>${password}</code>
`;
    block += `📅  ${expText}${expWarn}
`;
    if (sisaHari !== null) block += `⏳  ${sisaHari > 0 ? sisaHari+' hari lagi' : 'Sudah expired'}
`;
    if (hasLinks) {
      block += `<code>├──────────────────────────────────┤</code>
`;
      if (row.link_tls)    block += `🔗 TLS: <code>${escapeHtmlLocal(row.link_tls)}</code>
`;
      if (row.link_none)   block += `🔗 NTLS: <code>${escapeHtmlLocal(row.link_none)}</code>
`;
      if (row.link_grpc)   block += `🔗 GRPC: <code>${escapeHtmlLocal(row.link_grpc)}</code>
`;
      if (row.link_uptls)  block += `🔗 UPTLS: <code>${escapeHtmlLocal(row.link_uptls)}</code>
`;
      if (row.link_upntls) block += `🔗 UPNTLS: <code>${escapeHtmlLocal(row.link_upntls)}</code>
`;
    }
    block += `<code>└──────────────────────────────────┘</code>`;
    return block;
  });
  const title = listType === 'expired' ? '📋 Akun Expired' : '📋 Akun Aktif';
  const text =
    `<b>${title}</b> — <i>Hal. ${safePage + 1}/${totalPages}</i>\n\n` +

    blocks.join('\n\n');


  const nav = [];
  if (safePage > 0) nav.push({ text: '\u25c0\ufe0f Sebelumnya', callback_data: `view_accounts_local_page_${listType}_${safePage - 1}` });
  if (safePage < totalPages - 1) nav.push({ text: 'Selanjutnya \u25b6\ufe0f', callback_data: `view_accounts_local_page_${listType}_${safePage + 1}` });
  const keyboard = [];
  if (nav.length) keyboard.push(nav);
  keyboard.push([{ text: '🔙 Kembali', callback_data: 'view_accounts' }]);

  return ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
}

function normalizeRenewAccountType(rawType) {
  const value = String(rawType || '').trim().toLowerCase();
  if (value === 'udp') return 'udp_http';
  if (value === 'ovpn') return 'ssh';
  return value;
}

function inferIpPackageByAccount(type, iplimit) {
  const normalizedType = normalizeRenewAccountType(type);
  const ip = Number(iplimit || 0);
  if (!Number.isFinite(ip) || ip <= 0) return 1;
  if (normalizedType === 'udp_http') {
    // Kompatibel dengan mapping lama (1IP=5,2IP=6) dan mapping baru (1IP=3,2IP=4)
    if (ip >= 6) return 2;
    if (ip === 5) return 1;
    return ip >= 4 ? 2 : 1;
  }
  // Untuk akun reguler: paket 1IP dikirim sebagai limit 2, paket 2IP sebagai limit 3.
  return ip >= 3 ? 2 : 1;
}

async function findRenewCandidatesByUsername(ctx, rawUsername) {
  const userId = ctx.from.id;
  const username = String(rawUsername || '').trim().toLowerCase();
  if (!username) return [];

  const localRows = await dbAllAsync(
    `SELECT a.*, s.iplimit AS server_iplimit, s.quota AS server_quota,
            COALESCE(NULLIF(s.nama_server, ''), s.domain, a.server_name, a.domain, '-') AS resolved_server_name,
            COALESCE(NULLIF(s.domain, ''), a.domain, '-') AS resolved_domain
     FROM accounts a
     LEFT JOIN Server s ON s.id = a.server_id
     WHERE a.user_id = ?
       AND LOWER(TRIM(COALESCE(a.username, ''))) = LOWER(TRIM(?))
     ORDER BY a.id DESC`,
    [userId, username]
  ).catch(() => []);

  const candidates = [];
  const seen = new Set();
  const now = Date.now();

  const pushCandidate = (item) => {
    const normalizedType = normalizeRenewAccountType(item.type);
    const supportedTypes = new Set(['vmess', 'vless', 'trojan', 'shadowsocks', 'ssh', 'zivpn', 'udp_http']);
    if (!supportedTypes.has(normalizedType)) return;
    if (!Number.isFinite(item.serverId) || item.serverId <= 0) return;

    const key = `${item.serverId}|${normalizedType}|${String(item.username || '').toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    const expiresAtNum = Number(item.expiresAt || 0);
    const remainingDays = expiresAtNum > 0
      ? calcRemainingDays(expiresAtNum)
      : calcRemainingDaysFromDateExp(item.dateExp || '');

    candidates.push({
      username: String(item.username || '').trim(),
      type: normalizedType,
      password: String(item.password || '').trim(),
      serverId: Number(item.serverId),
      serverName: String(item.serverName || '-').trim() || '-',
      domain: String(item.domain || '-').trim() || '-',
      iplimit: Number(item.iplimit || 0),
      quota: Number(item.quota || 0),
      expiresAt: expiresAtNum > 0 ? expiresAtNum : null,
      dateExp: String(item.dateExp || '').trim(),
      status: String(item.status || '').trim().toUpperCase(),
      source: String(item.source || 'local'),
      remainingDays,
      selectedIpPackage: Number(item.accountIpPackage || inferIpPackageByAccount(normalizedType, item.iplimit)) === 2 ? 2 : 1,
      accountPricePerDay: Math.max(0, Number(item.accountPricePerDay || 0))
    });
  };

  for (const row of localRows) {
    pushCandidate({
      username: row.username,
      type: row.type,
      password: row.password,
      serverId: Number(row.server_id || 0),
      serverName: row.resolved_server_name || row.server_name || row.domain || '-',
      domain: row.resolved_domain || row.domain || '-',
      iplimit: Number(row.server_iplimit || 0),
      quota: Number(row.server_quota || 0),
      accountIpPackage: Number(row.account_ip_package || 0),
      accountPricePerDay: Number(row.account_price_per_day || 0),
      expiresAt: Number(row.expires_at || 0) || null,
      dateExp: row.expires_at ? formatDateYmdLocal(new Date(Number(row.expires_at))) : '',
      status: (Number(row.expires_at || 0) > now) ? 'ACTIVE' : 'EXPIRED',
      source: 'local'
    });
  }

  if (candidates.length > 0) {
    return candidates;
  }

  const isReseller = await isUserReseller(userId).catch(() => false);
  const servers = await dbAllAsync(
    `SELECT id, nama_server, domain, sync_host, auth
     FROM Server
     WHERE COALESCE(is_active, 1) = 1
       AND (COALESCE(is_reseller_only, 0) = 0 OR ? = 1)
     ORDER BY nama_server COLLATE NOCASE ASC`,
    [isReseller ? 1 : 0]
  ).catch(() => []);

  for (const server of servers) {
    const owned = await fetchOwnedAccountsByTelegramFromServer(server, userId);
    for (const row of owned) {
      if (String(row.username || '').trim().toLowerCase() !== username) continue;
      pushCandidate({
        username: row.username,
        type: row.type,
        password: row.password,
        serverId: Number(server.id || row.server_id || 0),
        serverName: server.nama_server || server.domain || row.server_name || '-',
        domain: server.domain || row.domain || '-',
        iplimit: Number(row.limitip || 0),
        quota: Number(row.quota || 0),
        accountIpPackage: inferIpPackageByAccount(row.type, row.limitip),
        expiresAt: Number(row.expires_at || 0) || null,
        dateExp: String(row.date_exp || '').trim(),
        status: row.status || ((Number(row.expires_at || 0) > now) ? 'ACTIVE' : 'EXPIRED'),
        source: 'remote'
      });
    }
  }

  return candidates;
}

async function renderRenewLookupList(ctx, page = 0) {
  const state = userState[ctx.chat.id]?.renew_lookup;
  if (!state || !Array.isArray(state.rows) || state.rows.length === 0) {
    return ctx.reply('Data akun tidak tersedia. Silakan mulai ulang perpanjang akun.');
  }

  const pageSize = Number(state.pageSize || 8);
  const total = state.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));
  const start = safePage * pageSize;
  const rows = state.rows.slice(start, start + pageSize);

  const keyboard = rows.map((row, idx) => {
    const absIndex = start + idx;
    return [{
      text: `${row.username} | ${String(row.type || '-').toUpperCase()} | ${row.serverName}`,
      callback_data: `renew_lookup_pick_${absIndex}`
    }];
  });

  const nav = [];
  if (safePage > 0) nav.push({ text: 'Sebelumnya', callback_data: `renew_lookup_page_${safePage - 1}` });
  if (safePage < totalPages - 1) nav.push({ text: 'Selanjutnya', callback_data: `renew_lookup_page_${safePage + 1}` });
  if (nav.length > 0) keyboard.push(nav);
  keyboard.push([{ text: 'Menu Utama', callback_data: 'send_main_menu' }]);

  return ctx.reply(
    `Ditemukan ${total} akun dengan username "${state.username}". Pilih akun yang ingin diperpanjang.\nHalaman ${safePage + 1}/${totalPages}`,
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

async function sendRenewAccountDetail(ctx, rowIndex) {
  const state = userState[ctx.chat.id]?.renew_lookup;
  if (!state || !Array.isArray(state.rows) || rowIndex < 0 || rowIndex >= state.rows.length) {
    return ctx.reply('Data akun tidak ditemukan, silakan cari ulang.');
  }

  const row = state.rows[rowIndex];
  const expText = row.expiresAt
    ? formatDateId(new Date(row.expiresAt))
    : (row.dateExp || '-');
  const statusText = row.status || (row.remainingDays > 0 ? 'ACTIVE' : 'EXPIRED');
  const pkgText = Number(row.selectedIpPackage || 1) === 2 ? '2 IP' : '1 IP';
  const hargaPerHariText = Number(row.accountPricePerDay || 0) > 0
    ? `Rp ${Number(row.accountPricePerDay).toLocaleString('id-ID')}`
    : '-';

  const text =
    'Detail akun ditemukan:\n\n' +
    `- Username: ${row.username}\n` +
    `- Layanan: ${String(row.type || '-').toUpperCase()}\n` +
    `- Server: ${row.serverName || '-'}\n` +
    `- Domain: ${row.domain || '-'}\n` +
    `- Paket IP: ${pkgText}\n` +
    `- Limit IP: ${Number(row.iplimit || 0)}\n` +
    `- Quota: ${Number(row.quota || 0)} GB\n` +
    `- Harga/Hari Tersimpan: ${hargaPerHariText}\n` +
    `- Expired: ${expText}\n` +
    `- Sisa aktif: ${Number(row.remainingDays || 0)} hari\n` +
    `- Status: ${statusText}`;

  const keyboard = [
    [{ text: 'Perpanjang akun ini', callback_data: `renew_lookup_extend_${rowIndex}` }]
  ];
  if ((state.rows || []).length > 1) {
    keyboard.push([{ text: 'Pilih akun lain', callback_data: 'renew_lookup_page_0' }]);
  }
  keyboard.push([{ text: 'Menu Utama', callback_data: 'send_main_menu' }]);

  return ctx.reply(text, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendAccountList(ctx, isExpired, limit = 10) {
  const userId = ctx.from.id;
  const now = Date.now();
  const cutoff = now - (3 * 24 * 60 * 60 * 1000);
  if (isExpired) {
    cleanupExpiredAccounts();
    limit = 0;
  }

  const query = isExpired
    ? `SELECT * FROM accounts WHERE user_id = ? AND expires_at <= ? AND expires_at >= ? ORDER BY expires_at DESC${limit ? ' LIMIT ' + limit : ''}`
    : `SELECT * FROM accounts WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC${limit ? ' LIMIT ' + limit : ''}`;
  const params = isExpired ? [userId, now, cutoff] : [userId, now];

  db.all(query, params, async (err, rows) => {
    if (err) {
      const errMsg = err && err.message ? err.message : String(err);
      logger.error(' Error ambil akun:', errMsg);
      if (errMsg.includes('no such table')) {
        return ctx.reply(' Belum ada data akun. Silakan buat akun dulu.');
      }
      return ctx.reply(' Terjadi kesalahan saat mengambil data akun.');
    }
    if (!rows || rows.length === 0) {
      if (!isExpired) {
        const isReseller = await isUserReseller(userId).catch(() => false);
        const servers = await dbAllAsync(
          `SELECT id, nama_server, domain, sync_host, auth
           FROM Server
           WHERE COALESCE(is_active, 1) = 1
             AND (COALESCE(is_reseller_only, 0) = 0 OR ? = 1)
           ORDER BY nama_server COLLATE NOCASE ASC`,
          [isReseller ? 1 : 0]
        ).catch(() => []);

        const remoteRows = [];
        for (const server of servers) {
          const owned = await fetchOwnedAccountsByTelegramFromServer(server, userId);
          for (const item of owned) {
            if (item.expires_at && item.expires_at <= now) continue;
            remoteRows.push(item);
          }
        }

        const unique = [];
        const seen = new Set();
        for (const item of remoteRows) {
          const key = `${item.server_id}|${String(item.type || '').toLowerCase()}|${String(item.username || '').toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(item);
        }

        if (unique.length > 0) {
          userState[ctx.chat.id] = userState[ctx.chat.id] || {};
          userState[ctx.chat.id].remote_owned_accounts = { rows: unique, pageSize: 10 };
          return renderRemoteOwnedAccountsPage(ctx, 0);
        }
      }
      return ctx.reply(isExpired ? ' Tidak ada akun expired.' : ' Tidak ada akun aktif.');
    }

    userState[ctx.chat.id] = userState[ctx.chat.id] || {};
    userState[ctx.chat.id].local_owned_accounts = {
      type: isExpired ? 'expired' : 'active',
      rows,
      pageSize: 4
    };
    await renderLocalOwnedAccountsPage(ctx, isExpired ? 'expired' : 'active', 0);
  });
}

bot.action('view_accounts_active', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await sendAccountList(ctx, false, 10);
});

bot.action('view_accounts_active_all', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await sendAccountList(ctx, false, 0);
});

bot.action('view_accounts_expired', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await sendAccountList(ctx, true, 0);
});

bot.action(/view_accounts_remote_page_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const page = Number(ctx.match[1] || 0);
  await renderRemoteOwnedAccountsPage(ctx, Number.isFinite(page) ? page : 0);
});

bot.action(/view_accounts_local_page_(active|expired)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const listType = String(ctx.match[1] || 'active');
  const page = Number(ctx.match[2] || 0);
  await renderLocalOwnedAccountsPage(ctx, listType, Number.isFinite(page) ? page : 0);
});

bot.action(/renew_lookup_page_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const page = Number(ctx.match[1] || 0);
  await renderRenewLookupList(ctx, Number.isFinite(page) ? page : 0);
});

bot.action(/renew_lookup_pick_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const rowIndex = Number(ctx.match[1] || -1);
  await sendRenewAccountDetail(ctx, rowIndex);
});

bot.action(/renew_lookup_extend_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const rowIndex = Number(ctx.match[1] || -1);
  const lookupState = userState[ctx.chat.id]?.renew_lookup;
  if (!lookupState || !Array.isArray(lookupState.rows) || rowIndex < 0 || rowIndex >= lookupState.rows.length) {
    return ctx.reply('Data akun tidak ditemukan, silakan mulai ulang proses perpanjang.');
  }

  const row = lookupState.rows[rowIndex];
  userState[ctx.chat.id] = {
    step: `exp_renew_${row.type}`,
    action: 'renew',
    type: row.type,
    username: row.username,
    password: row.password || '',
    serverId: row.serverId,
    selectedIpPackage: row.selectedIpPackage || 1,
    accountIpPackage: row.selectedIpPackage || 1,
    accountPricePerDay: Number(row.accountPricePerDay || 0),
    accountIpLimit: Number(row.iplimit || 0),
    accountQuota: Number(row.quota || 0),
    serverName: row.serverName || '',
    serverDomain: row.domain || ''
  };

  await ctx.reply(
    `Akun ${row.username} dipilih untuk diperpanjang.\n` +
    'Masukkan mau berapa hari perpanjangnya:',
    { parse_mode: 'Markdown' }
  );
});

async function sendToolsMenu(ctx) {
  const keyboard = [
    [
      { text: 'Perpanjang Akun', callback_data: 'service_renew', style: 'primary' },
      { text: 'Cek Server', callback_data: 'cek_server', style: 'primary' }
    ],
    [
      { text: 'Rubah Link V2Ray ke JSON', callback_data: 'hc_v2ray', style: 'success' }
    ],
    [
      { text: 'Riwayat Transaksi', callback_data: 'tx_history', style: 'danger' }
    ],
    [
      { text: 'Riwayat TopUp', callback_data: 'topup_history', style: 'danger' }
    ],
    [{ text: 'Kembali', callback_data: 'send_main_menu' }]
  ];

  try {
    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText('* MENU TOOLS*', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await ctx.reply('* MENU TOOLS*', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  } catch (error) {
    logger.error('Error saat mengirim menu tools:', error);
  }
}


// ════════════════════════════════════════════════════════════
// PPOB — HidePulsa Integration
// ════════════════════════════════════════════════════════════

// State untuk PPOB login OTP
const ppobLoginState = {}; // { userId: { step, challengeToken } }

// ── Helper format pesan ──────────────────────────────────────
function ppobStatusEmoji(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'sukses' || s === 'success') return '✅';
  if (s === 'pending') return '⏳';
  if (s === 'gagal' || s === 'failed' || s === 'failure') return '❌';
  return '🔄';
}

function ppobMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Pulsa", callback_data: "ppob_list_pulsa", style: "primary" }, { text: "Kuota Data", callback_data: "ppob_list_kuota", style: "primary" }],
      [{ text: "Combo Plus", callback_data: "ppob_cat_combo", style: "success" }, { text: "Masa Aktif", callback_data: "ppob_cat_masaaktif", style: "success" }],
      [{ text: "Aktivasi Perdana", callback_data: "ppob_cat_aktivasi", style: "primary" }],
      [{ text: "Listrik PLN", callback_data: "ppob_cat_listrik", style: "danger" }],
      [{ text: "Games", callback_data: "ppob_cat_games", style: "success" }],
      [{ text: "Riwayat", callback_data: "ppob_history", style: "primary" }],
      [{ text: "Kembali", callback_data: "send_main_menu" }]
    ]
  };
}

// ── Menu utama PPOB ──────────────────────────────────────────
bot.action('menu_ppob', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const isAdmin = adminIds.includes(userId);
  const isLoggedIn = ppob.isSessionActive();
  const saldoAkrab = await dbH.getSaldoAkrab(db, userId).catch(() => 0);
  const statusLine = isAdmin ? (isLoggedIn ? '\n🟢 Status API: Terhubung' : '\n🔴 Status API: Belum login') : '';
  const text =
    '🛒 <b>LAYANAN PPOB</b>\n' +
    '<blockquote>' +
    '<code>┌─────────────────────────┐</code>\n' +
    '<code>│</code> 💳 <b>Saldo Tembak Kuota</b>\n' +
    '<code>│</code>    <code>Rp ' + Number(saldoAkrab).toLocaleString('id-ID') + '</code>\n' +
    '<code>├─────────────────────────┤</code>\n' +
    '<code>│</code> 📱 Pulsa   · 📶 Kuota Data\n' +
    '<code>│</code> 🎁 Combo   · 🔄 Masa Aktif\n' +
    '<code>│</code> 🆕 Aktivasi · ⚡ PLN · 🎮 Games\n' +
    '<code>└─────────────────────────┘</code>' +
    '</blockquote>' + statusLine;
  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: ppobMenuKeyboard(isAdmin && isLoggedIn) });
  } catch (_) {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: ppobMenuKeyboard(isAdmin && isLoggedIn) });
  }
});

// ── Cek session, jika belum login minta OTP ──────────────────
async function ensurePpobSession(ctx) {
  if (ppob.isSessionActive()) return true;
  const userId = ctx.from.id;
  const botTgId = ppob.getBotTelegramUserId();
  if (!botTgId) {
    await ctx.reply(
      '⚠️ *PPOB belum dikonfigurasi*\n\nAdmin perlu set `HIDEPULSA_TELEGRAM_USER_ID` di `.vars.json`\nlalu restart bot.',
      { parse_mode: 'Markdown' }
    );
    return false;
  }
  // Mulai flow OTP
  try {
    const challengeToken = await ppob.registerAndRequestOtp(botTgId);
    ppobLoginState[userId] = { step: 'otp', challengeToken };
    await ctx.reply(
      '🔐 *Login HidePulsa*\n\nOTP telah dikirim ke akun Telegram HidePulsa bot.\nKirim kode OTP (6 digit):',
      { parse_mode: 'Markdown' }
    );
    return false; // tunggu OTP
  } catch (err) {
    await ctx.reply(`❌ Gagal request OTP: ${err.message}`);
    return false;
  }
}

// ── Handler teks OTP ──────────────