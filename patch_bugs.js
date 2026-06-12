const fs = require('fs');
const path = '/root/BotVPN/app.js';

let src = fs.readFileSync(path, 'utf8');
let patched = 0;

// ============================================================
// BUG A FIX: "Lihat Semua Akun Saya" selalu tampil
// ============================================================
const bugA_old = `      const keyboard = [
        [{ text: ' Lihat Akun Aktif Saya', callback_data: 'view_accounts_active' }]
      ];
      if (total > 0) {
        keyboard.push([{ text: ' Lihat Semua Akun Saya', callback_data: 'view_accounts_active_all' }]);
      }`;

const bugA_new = `      const keyboard = [
        [{ text: ' Lihat Akun Aktif Saya', callback_data: 'view_accounts_active' }],
        [{ text: ' Lihat Semua Akun Saya', callback_data: 'view_accounts_active_all' }]
      ];`;

if (src.includes(bugA_old)) {
  src = src.replace(bugA_old, bugA_new);
  patched++;
  console.log('[OK] Bug A fixed: Lihat Semua Akun selalu tampil');
} else {
  console.log('[SKIP] Bug A: string tidak ditemukan, skip');
}

// ============================================================
// BUG B FIX: akrab_konfirmasi - extract variabel dari userState
// ============================================================
const bugB_old = `bot.action(/^akrab_konfirmasi_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Memproses...');
  const amount = Number(confirm.amount || 0);`;

const bugB_new = `bot.action(/^akrab_konfirmasi_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Memproses...');
  const userId = ctx.from.id;
  const produkCode = ctx.match[1];
  const confirm = (userState[ctx.chat.id] && userState[ctx.chat.id].akrabConfirm) ? userState[ctx.chat.id].akrabConfirm : {};
  const tujuan = confirm.tujuan;
  const amount = Number(confirm.amount || 0);`;

if (src.includes(bugB_old)) {
  src = src.replace(bugB_old, bugB_new);
  patched++;
  console.log('[OK] Bug B fixed: akrab_konfirmasi variabel di-extract dari userState');
} else {
  console.log('[SKIP] Bug B: string tidak ditemukan, skip');
}

// ============================================================
// BUG C FIX: Notif buat akun VPN ke GROUP_ID_NUM
// ============================================================
const bugC_old = `    if (!isResellerUser) {
      const creatorLabel = ctx.from.username ? \`@\${ctx.from.username}\` : (ctx.from.first_name || 'User');
      await sendNonResellerCreateNotification({ service: type.toUpperCase(), serverName: state.serverName, domain: state.serverDomain, accountUsername: username, accountPassword: usedPassword, expDays: exp, expiredDate: formatDateId(expDate), creatorLabel, creatorId: ctx.from.id });
    }
  } catch (_) {}`;

const bugC_new = `    if (!isResellerUser) {
      const creatorLabel = ctx.from.username ? \`@\${ctx.from.username}\` : (ctx.from.first_name || 'User');
      await sendNonResellerCreateNotification({ service: type.toUpperCase(), serverName: state.serverName, domain: state.serverDomain, accountUsername: username, accountPassword: usedPassword, expDays: exp, expiredDate: formatDateId(expDate), creatorLabel, creatorId: ctx.from.id });
    }
    if (GROUP_ID_NUM) {
      const nowC = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const expDateC = new Date(Date.now() + exp * 24 * 60 * 60 * 1000);
      const roleC = isResellerUser ? 'RESELLER' : 'USER';
      const notifC =
        '\u2705 <b>AKUN BARU DIBUAT</b>\n' +
        '<blockquote><code>\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510</code>\n' +
        '<code>\u2502</code> \ud83d\udc64 <b>Pembuat</b>  : <code>' + (ctx.from.username ? '@' + ctx.from.username : ctx.from.first_name || '-') + '</code>\n' +
        '<code>\u2502</code> \ud83c\udd94 <b>ID</b>       : <code>' + ctx.from.id + '</code>\n' +
        '<code>\u2502</code> \ud83c\udff7 <b>Role</b>     : <code>' + roleC + '</code>\n' +
        '<code>\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524</code>\n' +
        '<code>\u2502</code> \ud83d\udee0 <b>Layanan</b>  : <code>' + String(type || '-').toUpperCase() + '</code>\n' +
        '<code>\u2502</code> \ud83d\udda5 <b>Server</b>   : <code>' + (state.serverName || state.serverDomain || '-') + '</code>\n' +
        '<code>\u2502</code> \ud83d\udc64 <b>Username</b> : <code>' + (username || '-') + '</code>\n' +
        '<code>\u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524</code>\n' +
        '<code>\u2502</code> \u23f3 <b>Durasi</b>   : <code>' + exp + ' hari</code>\n' +
        '<code>\u2502</code> \ud83d\udcc5 <b>Expired</b>  : <code>' + formatDateId(expDateC) + '</code>\n' +
        '<code>\u2502</code> \ud83d\udcb0 <b>Bayar</b>    : <code>Rp ' + Number(totalHarga || 0).toLocaleString('id-ID') + '</code>\n' +
        '<code>\u2502</code> \ud83d\udd50 <b>Waktu</b>    : <code>' + nowC + '</code>\n' +
        '<code>\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518</code></blockquote>';
      bot.telegram.sendMessage(GROUP_ID_NUM, notifC, { parse_mode: 'HTML' }).catch(() => {});
    }
  } catch (_) {}`;

if (src.includes(bugC_old)) {
  src = src.replace(bugC_old, bugC_new);
  patched++;
  console.log('[OK] Bug C fixed: notif buat akun VPN dikirim ke GROUP_ID_NUM');
} else {
  console.log('[SKIP] Bug C: string tidak ditemukan, skip');
}

if (patched > 0) {
  fs.writeFileSync(path, src, 'utf8');
  console.log('\nTotal patch diterapkan: ' + patched + '/3');
} else {
  console.log('\nTidak ada patch diterapkan.');
}
