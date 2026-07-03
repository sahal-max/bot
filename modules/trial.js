const axios = require('axios');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');

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

// ════════════════════════════════════════════
// TRIAL SSH
// ════════════════════════════════════════════
async function trialssh(username, password, exp, iplimit, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);

      const curlCmd = `curl -s -X POST "${domain}/vps/trialsshvpn" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"timelimit":"1h","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}'`;

      exec(curlCmd, (_, stdout) => {
        let d;
        try { d = JSON.parse(stdout); } catch (e) { return resolve('❌ Format respon dari server tidak valid.'); }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s = d.data;
        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*TRIAL SSH ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username}\`
Password : \`${s.password}\`
Expired  : \`${s.exp} ${s.time || ''}\`
IP Limit : \`1 Device\`
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
// TRIAL UDP HTTP
// ════════════════════════════════════════════
async function trialudphttp(username, password, exp, iplimit, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);

      const curlCmd = `curl -s -X POST "${domain}/vps/trialsshvpn" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"timelimit":"1h","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}'`;

      exec(curlCmd, (_, stdout) => {
        let d;
        try { d = JSON.parse(stdout); } catch (e) { return resolve('❌ Format respon dari server tidak valid.'); }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s       = d.data;
        const port    = '1-65535';
        const expired = s.exp || s.expired || s.to || 'N/A';

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*TRIAL UDP HTTP ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username}\`
Password : \`${s.password}\`
UDP Port : \`${port}\`
Expired  : \`${expired}\`
IP Limit : \`1 Device\`
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
// TRIAL VMESS
// ════════════════════════════════════════════
async function trialvmess(username, exp, quota, limitip, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      const LIMIT_IP   = limitip;

      const curlCmd = `curl -s -X POST "${domain}/vps/trialvmessall" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"timelimit":"1h","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}'`;

      exec(curlCmd, (_, stdout) => {
        let d;
        try { d = JSON.parse(stdout); } catch (e) { return resolve('❌ Format respon dari server tidak valid.'); }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s      = d.data;
        const ipText = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*TRIAL VMESS ACCOUNT*
━━━━━━━━━━━━━━━━━━━━━━
*INFO AKUN*
Host     : \`${s.hostname}\`
Username : \`${s.username || username}\`
UUID     : \`${s.uuid}\`
Expired  : \`${s.expired || '-'} ${s.time || ''}\`
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
NON TLS : \`${s.link?.none || '-'}\`
┄┄┄┄┄┄┄┄┄┄
gRPC    : \`${s.link?.grpc || '-'}\`
━━━━━━━━━━━━━━━━━━━━━━`
        );
      });
    });
  });
}

// ════════════════════════════════════════════
// TRIAL VLESS
// ════════════════════════════════════════════
async function trialvless(username, exp, quota, limitip, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      const KUOTA      = quota;
      const LIMIT_IP   = limitip;

      const curlCmd = `curl -s -X POST "${domain}/vps/trialvlessall" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"timelimit":"1h","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}'`;

      exec(curlCmd, (_, stdout) => {
        let d;
        try { d = JSON.parse(stdout); } catch (e) { return resolve('❌ Format respon dari server tidak valid.'); }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s         = d.data;
        const quotaText = KUOTA    === '0' ? 'Unlimited' : `${KUOTA} GB`;
        const ipText    = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*TRIAL VLESS ACCOUNT*
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
// TRIAL TROJAN
// ════════════════════════════════════════════
async function trialtrojan(username, exp, quota, limitip, serverId, telegramUserId = '', telegramChatId = '') {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';

  return new Promise((resolve) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain     = normalizeApiBase(server.domain);
      const AUTH_TOKEN = normalizeAuthToken(server.auth);
      const KUOTA      = quota;
      const LIMIT_IP   = limitip;

      const curlCmd = `curl -s -X POST "${domain}/vps/trialtrojanall" \
-H "Authorization: ${AUTH_TOKEN}" \
-H "X-Telegram-User-Id: ${telegramUserId}" \
-H "X-Telegram-Chat-Id: ${telegramChatId}" \
-H "Content-Type: application/json" \
-H "Accept: application/json" \
-d '{"timelimit":"1h","telegram_user_id":"${telegramUserId}","telegram_chat_id":"${telegramChatId}"}'`;

      exec(curlCmd, (_, stdout) => {
        let d;
        try { d = JSON.parse(stdout); } catch (e) { return resolve('❌ Format respon dari server tidak valid.'); }
        if (d?.meta?.code !== 200 || !d.data) {
          return resolve(`❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`);
        }

        const s         = d.data;
        const quotaText = KUOTA    === '0' ? 'Unlimited' : `${KUOTA} GB`;
        const ipText    = LIMIT_IP === '0' ? 'Unlimited' : `${LIMIT_IP} Device`;

        return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*TRIAL TROJAN ACCOUNT*
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
// TRIAL SHADOWSOCKS
// ════════════════════════════════════════════
async function trialshadowsocks(username, exp, quota, limitip, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
      if (err || !server) return resolve('❌ Server tidak ditemukan. Silakan coba lagi.');

      const domain = server.domain;
      const auth   = server.auth;
      const url    = `http://${domain}:5888/createshadowsocks?user=${username}&exp=${exp}&quota=${quota}&iplimit=${limitip}&auth=${auth}`;

      axios.get(url)
        .then(response => {
          if (response.data.status === 'success') {
            const s         = response.data.data;
            const quotaText = s.quota === '0 GB' ? 'Unlimited' : s.quota;
            const ipText    = s.ip_limit === '0' ? 'Unlimited' : `${s.ip_limit} Device`;
            return resolve(
`━━━━━━━━━━━━━━━━━━━━━━
*TRIAL SHADOWSOCKS ACCOUNT*
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
          console.error('Error Shadowsocks trial:', error);
          return resolve('❌ Terjadi kesalahan saat membuat Shadowsocks. Silakan coba lagi nanti.');
        });
    });
  });
}

module.exports = { trialssh, trialudphttp, trialvmess, trialvless, trialtrojan, trialshadowsocks };
