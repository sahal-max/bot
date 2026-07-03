const axios = require('axios');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');
const CREATE_REQUEST_TIMEOUT_SECONDS = Math.max(
  30,
  Number(process.env.CREATE_REQUEST_TIMEOUT_SECONDS || process.env.CREATE_REQUEST_TIMEOUT || 120) || 120
);

function shortText(input, maxLen = 900) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

function invalidServerResponseMessage(statusCode, body, stderr, errExec) {
  const parts = ['Format respon dari server tidak valid.'];
  if (statusCode) parts.push(`HTTP: ${statusCode}`);
  if (errExec?.message) parts.push(`Curl: ${shortText(errExec.message, 180)}`);
  if (stderr) parts.push(`Stderr: ${shortText(stderr, 260)}`);
  if (body) parts.push(`Body: ${shortText(body, 600)}`);
  if (!statusCode && !body) {
    parts.push(`Server tidak merespon dalam ${CREATE_REQUEST_TIMEOUT_SECONDS} detik atau koneksi terputus.`);
  }
  return `❌ ${parts.join('\n')}`;
}

function normalizeApiBase(rawDomain) {
  const value = String(rawDomain || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '');
  return `http://${value}`.replace(/\/+$/, '');
}

function normalizeAuthToken(rawAuth) {
  const value = String(rawAuth || '').trim();
  if (!value) return '';
  return value.replace(/^Bearer\s+/i, '').trim();
}

function parseJsonFromCurlOutput(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

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

function isHttp2xx(statusCode) {
  return Number(statusCode) >= 200 && Number(statusCode) < 300;
}

const SEP = '`━━━━━━━━━━━━━━━━━━━━━━`';

// ════════════════════════════════════════════
// CREATE SSH
// ════════════════════════════════════════════
async function createssh(username, password, exp, iplimit, serverId, telegramUserId = '', telegramChatId = '', quota = '0') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Gunakan huruf dan angka saja.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain   = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      if (!AUTH_TOKEN) return resolve('Auth token server kosong/tidak valid.');

      const KUOTA    = String(quota || '0');
      const LIMIT_IP = iplimit;

      const curlCmd = `curl -k -sS -L --connect-timeout 10 --max-time ${CREATE_REQUEST_TIMEOUT_SECONDS} -X POST "${domain}/vps/sshvpn" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"expired":${exp},"kuota":"${KUOTA}","limitip":"${LIMIT_IP}","password":"${password}","username":"${username}","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}' \
-w "\\n__HTTP_STATUS__:%{http_code}"`;

      exec(curlCmd, (errExec, stdout, stderr) => {
        const { body, statusCode } = splitCurlOutput(stdout);
        const d = parseJsonFromCurlOutput(body);
        if (!d) {
          if (isHttp2xx(statusCode))
            return resolve(`✅ Akun SSH berhasil dibuat\nUsername: \`${username}\`\nExpired: \`${exp} hari\``);
          return resolve(invalidServerResponseMessage(statusCode, body, stderr, errExec));
        }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s         = d.data;
        const ipText    = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;
        const quotaText = KUOTA    === '0' ? 'Unlimited' : `${KUOTA} GB`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*SSH PREMIUM ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username}\`
Password : \`${s.password}\`
Expired  : \`${s.exp} ${s.time || ''}\`
Quota    : \`${quotaText}\`
IP Limit : \`${ipText}\`
━━━━━━━━━━━━━━━━━━━━━━
*PORT*
TLS  : \`${s.port.tls}\`
NTLS : \`${s.port.none}\`
UDP  : \`${s.port.udpcustom}\`
━━━━━━━━━━━━━━━━━━━━━━
*LINK AKUN*
WS TLS  : \`${s.hostname}:${s.port.tls}@${s.username}:${s.password}\`
WS NTLS : \`${s.hostname}:${s.port.none}@${s.username}:${s.password}\`
━━━━━━━━━━━━━━━━━━━━━━
*PAYLOAD*
\`GET / HTTP/1.1[crlf]Host: ${s.hostname}[crlf]Upgrade: websocket[crlf][crlf]\`
━━━━━━━━━━━━━━━━━━━━━━`
        );
      });
    });
  });
}

// ════════════════════════════════════════════
// CREATE UDP HTTP
// ════════════════════════════════════════════
async function createudphttp(username, password, exp, iplimit, serverId, telegramUserId = '', telegramChatId = '', quota = '0') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Gunakan huruf dan angka saja.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      if (!AUTH_TOKEN) return resolve('Auth token server kosong/tidak valid.');

      const KUOTA    = String(quota || '0');
      const LIMIT_IP = iplimit;

      const curlCmd = `curl -k -sS -L --connect-timeout 10 --max-time ${CREATE_REQUEST_TIMEOUT_SECONDS} -X POST "${domain}/vps/sshvpn" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"expired":${exp},"kuota":"${KUOTA}","limitip":"${LIMIT_IP}","password":"${password}","username":"${username}","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}' \
-w "\\n__HTTP_STATUS__:%{http_code}"`;

      exec(curlCmd, (errExec, stdout, stderr) => {
        const { body, statusCode } = splitCurlOutput(stdout);
        const d = parseJsonFromCurlOutput(body);
        if (!d) {
          if (isHttp2xx(statusCode))
            return resolve(`✅ Akun UDP HTTP berhasil dibuat\nUsername: \`${username}\`\nExpired: \`${exp} hari\``);
          return resolve(invalidServerResponseMessage(statusCode, body, stderr, errExec));
        }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s         = d.data;
        const port      = '1-65535';
        const expired   = s.exp || s.expired || s.to || 'N/A';
        const ipText    = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;
        const quotaText = KUOTA    === '0' ? 'Unlimited' : `${KUOTA} GB`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*UDP HTTP ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username}\`
Password : \`${s.password}\`
UDP Port : \`${port}\`
Expired  : \`${expired}\`
Quota    : \`${quotaText}\`
IP Limit : \`${ipText}\`
━━━━━━━━━━━━━━━━━━━━━━
*COPY*
\`${s.hostname}:${port}@${s.username}:${s.password}\`
━━━━━━━━━━━━━━━━━━━━━━`
        );
      });
    });
  });
}

// ════════════════════════════════════════════
// CREATE VMESS
// ════════════════════════════════════════════
async function createvmess(username, exp, quota, limitip, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Gunakan huruf dan angka saja.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      if (!AUTH_TOKEN) return resolve('Auth token server kosong/tidak valid.');

      const KUOTA    = quota;
      const LIMIT_IP = limitip;

      const curlCmd = `curl -k -sS -L --connect-timeout 10 --max-time ${CREATE_REQUEST_TIMEOUT_SECONDS} -X POST "${domain}/vps/vmessall" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"expired":${exp},"kuota":"${KUOTA}","limitip":"${LIMIT_IP}","username":"${username}","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}' \
-w "\\n__HTTP_STATUS__:%{http_code}"`;

      exec(curlCmd, (errExec, stdout, stderr) => {
        const { body, statusCode } = splitCurlOutput(stdout);
        const d = parseJsonFromCurlOutput(body);
        if (!d) {
          if (isHttp2xx(statusCode))
            return resolve(`✅ Akun VMESS berhasil dibuat\nUsername: \`${username}\`\nExpired: \`${exp} hari\``);
          return resolve(invalidServerResponseMessage(statusCode, body, stderr, errExec));
        }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s         = d.data;
        const quotaText = KUOTA    === '0' ? 'Unlimited' : `${KUOTA} GB`;
        const ipText    = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*VMESS PREMIUM ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username || username}\`
UUID     : \`${s.uuid}\`
Expired  : \`${s.expired || '-'} ${s.time || ''}\`
Quota    : \`${quotaText}\`
IP Limit : \`${ipText}\`
━━━━━━━━━━━━━━━━━━━━━━
*PORT*
TLS     : \`${s.port?.tls  || '-'}\`
NON TLS : \`${s.port?.none || '-'}\`
gRPC    : \`${s.port?.grpc || '-'}\`
━━━━━━━━━━━━━━━━━━━━━━
*LINK AKUN*
TLS     : \`${s.link?.tls   || '-'}\`
┄┄┄┄┄┄┄┄┄┄
NON TLS : \`${s.link?.none  || '-'}\`
┄┄┄┄┄┄┄┄┄┄
gRPC    : \`${s.link?.grpc  || '-'}\`
━━━━━━━━━━━━━━━━━━━━━━`
        );
      });
    });
  });
}

// ════════════════════════════════════════════
// CREATE VLESS
// ════════════════════════════════════════════
async function createvless(username, exp, quota, limitip, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Gunakan huruf dan angka saja.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      if (!AUTH_TOKEN) return resolve('Auth token server kosong/tidak valid.');

      const KUOTA    = quota;
      const LIMIT_IP = limitip;

      const curlCmd = `curl -k -sS -L --connect-timeout 10 --max-time ${CREATE_REQUEST_TIMEOUT_SECONDS} -X POST "${domain}/vps/vlessall" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"expired":${exp},"kuota":"${KUOTA}","limitip":"${LIMIT_IP}","username":"${username}","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}' \
-w "\\n__HTTP_STATUS__:%{http_code}"`;

      exec(curlCmd, (errExec, stdout, stderr) => {
        const { body, statusCode } = splitCurlOutput(stdout);
        const d = parseJsonFromCurlOutput(body);
        if (!d) {
          if (isHttp2xx(statusCode))
            return resolve(`✅ Akun VLESS berhasil dibuat\nUsername: \`${username}\`\nExpired: \`${exp} hari\``);
          return resolve(invalidServerResponseMessage(statusCode, body, stderr, errExec));
        }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s         = d.data;
        const quotaText = KUOTA    === '0' ? 'Unlimited' : `${KUOTA} GB`;
        const ipText    = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*VLESS PREMIUM ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username || username}\`
UUID     : \`${s.uuid}\`
Expired  : \`${s.expired || '-'} ${s.time || ''}\`
Quota    : \`${quotaText}\`
IP Limit : \`${ipText}\`
━━━━━━━━━━━━━━━━━━━━━━
*PORT*
TLS     : \`${s.port?.tls  || '-'}\`
NON TLS : \`${s.port?.none || '-'}\`
gRPC    : \`${s.port?.grpc || '-'}\`
━━━━━━━━━━━━━━━━━━━━━━
*LINK AKUN*
TLS     : \`${s.link?.tls   || '-'}\`
┄┄┄┄┄┄┄┄┄┄
NON TLS : \`${s.link?.none  || '-'}\`
┄┄┄┄┄┄┄┄┄┄
gRPC    : \`${s.link?.grpc  || '-'}\`
━━━━━━━━━━━━━━━━━━━━━━`
        );
      });
    });
  });
}

// ════════════════════════════════════════════
// CREATE TROJAN
// ════════════════════════════════════════════
async function createtrojan(username, exp, quota, limitip, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Gunakan huruf dan angka saja.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      if (!AUTH_TOKEN) return resolve('Auth token server kosong/tidak valid.');

      const KUOTA    = quota;
      const LIMIT_IP = limitip;

      const curlCmd = `curl -k -sS -L --connect-timeout 10 --max-time ${CREATE_REQUEST_TIMEOUT_SECONDS} -X POST "${domain}/vps/trojanall" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"expired":${exp},"kuota":"${KUOTA}","limitip":"${LIMIT_IP}","username":"${username}","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}' \
-w "\\n__HTTP_STATUS__:%{http_code}"`;

      exec(curlCmd, (errExec, stdout, stderr) => {
        const { body, statusCode } = splitCurlOutput(stdout);
        const d = parseJsonFromCurlOutput(body);
        if (!d) {
          if (isHttp2xx(statusCode))
            return resolve(`✅ Akun TROJAN berhasil dibuat\nUsername: \`${username}\`\nExpired: \`${exp} hari\``);
          return resolve(invalidServerResponseMessage(statusCode, body, stderr, errExec));
        }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s         = d.data;
        const quotaText = KUOTA    === '0' ? 'Unlimited' : `${KUOTA} GB`;
        const ipText    = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*TROJAN PREMIUM ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username || username}\`
Key      : \`${s.uuid}\`
Expired  : \`${s.expired || '-'} ${s.time || ''}\`
Quota    : \`${quotaText}\`
IP Limit : \`${ipText}\`
━━━━━━━━━━━━━━━━━━━━━━
*PORT*
TLS     : \`${s.port?.tls  || '-'}\`
NON TLS : \`${s.port?.none || '-'}\`
gRPC    : \`${s.port?.grpc || '-'}\`
━━━━━━━━━━━━━━━━━━━━━━
*LINK AKUN*
TLS     : \`${s.link?.tls  || '-'}\`
┄┄┄┄┄┄┄┄┄┄
gRPC    : \`${s.link?.grpc || '-'}\`
━━━━━━━━━━━━━━━━━━━━━━`
        );
      });
    });
  });
}

// ════════════════════════════════════════════
// CREATE SHADOWSOCKS
// ════════════════════════════════════════════
async function createshadowsocks(username, exp, quota, limitip, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Gunakan huruf dan angka saja.';

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain = normalizeApiBase(server.domain);
      const auth   = normalizeAuthToken(server.auth);
      if (!auth) return resolve('❌ Auth token server kosong/tidak valid.');

      const url = `${domain}:5888/createshadowsocks?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;
      axios.get(url)
        .then(response => {
          if (response.data.status === 'success') {
            const s         = response.data.data;
            const quotaText = s.quota === '0 GB' ? 'Unlimited' : s.quota;
            const ipText    = s.ip_limit === '0' ? 'Unlimited' : `${s.ip_limit} Device`;
            return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*SHADOWSOCKS ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.domain}\`
Username : \`${s.username}\`
Expired  : \`${s.expired}\`
Quota    : \`${quotaText}\`
IP Limit : \`${ipText}\`
━━━━━━━━━━━━━━━━━━━━━━
*PORT*
TLS  : \`443\`
NTLS : \`80\`
━━━━━━━━━━━━━━━━━━━━━━
*LINK AKUN*
WS   : \`${s.ss_link_ws}\`
gRPC : \`${s.ss_link_grpc}\`
━━━━━━━━━━━━━━━━━━━━━━
[Save Account](https://${s.domain}:81/shadowsocks-${s.username}.txt)`
            );
          } else {
            return resolve(`❌ Terjadi kesalahan: ${response.data.message}`);
          }
        })
        .catch(error => {
          console.error('Error Shadowsocks:', error);
          return resolve('❌ Terjadi kesalahan saat membuat Shadowsocks. Silakan coba lagi nanti.');
        });
    });
  });
}

module.exports = { createssh, createudphttp, createvmess, createvless, createtrojan, createshadowsocks };
