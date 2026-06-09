const fs = require('fs');
const FILE = 'app.js';
let lines = fs.readFileSync(FILE, 'utf8').split('\n');
let changes = 0;

function replaceByLineNum(lineNum, newContent, label) {
  const idx = lineNum - 1;
  if (idx < 0 || idx >= lines.length) {
    console.log('⚠️  SKIP (out of range):', label);
    return;
  }
  console.log('  OLD [' + lineNum + ']:', lines[idx].trim().substring(0, 80) + '...');
  lines[idx] = newContent;
  changes++;
  console.log('✅ FIXED [line ' + lineNum + ']:', label);
}

function findByPattern(pattern) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) return i + 1;
  }
  return -1;
}

// Cari nomor baris yang tepat
let ln;

// [1] TEST AKRAB V3
ln = findByPattern("🧪 TEST AKRAB V3");
if (ln > 0) {
  replaceByLineNum(ln,
    "    await ctx.editMessageText('🧪 <b>TEST AKRAB V3 — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:',",
    '[1] Test Akrab V3'
  );
}

// [2] TEST CIRCLE
ln = findByPattern("🧪 TEST CIRCLE");
if (ln > 0) {
  replaceByLineNum(ln,
    "    await ctx.editMessageText('🔴 <b>TEST CIRCLE — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:',",
    '[2] Test Circle'
  );
}

// [3] TEST PPOB
ln = findByPattern("🧪 TEST PPOB");
if (ln > 0) {
  replaceByLineNum(ln,
    "    await ctx.editMessageText('📱 <b>TEST PPOB — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b>   : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 🏷 <b>Kategori</b> : <code>'+s.category+'</code>\\n┃ 📊 <b>Stok</b>     : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>    : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:',",
    '[3] Test PPOB'
  );
}

// [6b] SALDO TEMBAK KUOTA TIDAK CUKUP
ln = findByPattern("Saldo tembak kuota tidak cukup");
if (ln > 0) {
  replaceByLineNum(ln,
    "      return ctx.editMessageText('❌ <b>Saldo Tidak Cukup</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💳 <b>Saldo</b>     : <code>Rp '+Number(saldo).toLocaleString('id-ID')+'</code>\\n┃ 💰 <b>Dibutuhkan</b>: <code>Rp '+finalPrice.toLocaleString('id-ID')+'</code>\\n┃ 📉 <b>Kekurangan</b>: <code>Rp '+(finalPrice - Number(saldo)).toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ ⚠️ Top up saldo terlebih dahulu.',",
    '[6b] Saldo Tidak Cukup'
  );
}

// [6c] TRANSAKSI BERHASIL - 6 baris
ln = findByPattern("'✅  <b>Transaksi Berhasil!</b>");
if (ln > 0) {
  replaceByLineNum(ln,
    "      '✅ <b>Transaksi Berhasil!</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n'+",
    '[6c] Transaksi - Header'
  );
}
ln = findByPattern("'📦 '+item.product_name+'\\n'+");
if (ln > 0) {
  replaceByLineNum(ln,
    "      '┃ 📦 <b>Produk</b>   : <code>'+item.product_name+'</code>\\n'+",
    '[6c] Transaksi - Produk'
  );
}
ln = findByPattern("'📱 Tujuan: <code>'+customerNo+'</code>");
if (ln > 0) {
  replaceByLineNum(ln,
    "      '┃ 📱 <b>Tujuan</b>   : <code>'+customerNo+'</code>\\n'+",
    '[6c] Transaksi - Tujuan'
  );
}
ln = findByPattern("'💰 Nominal: Rp '+finalPrice.toLocaleString('id-ID')");
if (ln > 0) {
  replaceByLineNum(ln,
    "      '┃ 💰 <b>Nominal</b>  : <code>Rp '+finalPrice.toLocaleString('id-ID')+'</code>\\n'+",
    '[6c] Transaksi - Nominal'
  );
}
ln = findByPattern("'🔖 Ref ID: <code>'+txId+'</code>");
if (ln > 0) {
  replaceByLineNum(ln,
    "      '┃ 🔖 <b>Ref ID</b>   : <code>'+txId+'</code>\\n'+",
    '[6c] Transaksi - RefID'
  );
}
ln = findByPattern("'📊 Status: '+(result&&result.data&&result.data.message||'pending')");
if (ln > 0) {
  replaceByLineNum(ln,
    "      '┃ 📊 <b>Status</b>   : '+(result&&result.data&&result.data.message||'pending')+'\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>',",
    '[6c] Transaksi - Status'
  );
}

// [8] SYARAT RESELLER - multi baris
ln = findByPattern("*SYARAT RESELLER*");
if (ln > 0) {
  replaceByLineNum(ln,
    "      '📋 <b>SYARAT RESELLER</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n'+",
    '[8] Syarat - Header'
  );
  // Baris berikutnya
  if (ln < lines.length) {
    replaceByLineNum(ln + 1,
      "      `┃ 💰 <b>Top Up Awal</b>   : <code>\${formatRupiah(terms.join_topup_min)}</code>\\n` +",
      '[8] Syarat - Top Up Awal'
    );
  }
  if (ln + 1 < lines.length) {
    replaceByLineNum(ln + 2,
      "      `┃ 📅 <b>Top Up Bulanan</b> : <code>\${formatRupiah(terms.min_topup)}</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n` +",
      '[8] Syarat - Top Up Bulanan'
    );
  }
}

// [9a] SALDO USER TIDAK CUKUP (admin hapus saldo)
ln = findByPattern("Saldo user tidak mencukupi");
if (ln > 0) {
  replaceByLineNum(ln,
    "        return ctx.reply('❌ <b>Saldo Tidak Cukup</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💳 <b>Saldo User</b>  : <code>Rp '+user.saldo.toLocaleString('id-ID')+'</code>\\n┃ 💰 <b>Jumlah Hapus</b>: <code>Rp '+amount.toLocaleString('id-ID')+'</code>\\n┃ 📉 <b>Kekurangan</b>  : <code>Rp '+(amount - user.saldo).toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>', {",
    '[9a] Saldo Tidak Cukup'
  );
  // Fix parse_mode di baris berikutnya
  if (ln < lines.length && lines[ln].includes("parse_mode: 'Markdown'")) {
    replaceByLineNum(ln + 1,
      "          parse_mode: 'HTML'",
      '[9a-fix] Parse mode'
    );
  }
}

// [PREORDER] Separator
ln = findByPattern("Antrian Pre-Order Aktif");
if (ln > 0 && ln < lines.length) {
  // Baris berikutnya biasanya separator
  if (lines[ln].includes('──────────────────────')) {
    replaceByLineNum(ln + 1,
      "    `<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n` +",
      '[PREORDER] Separator'
    );
  }
}

fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log('\n🎉 SELESAI! Total ' + changes + ' bagian berhasil diperbaiki.');
console.log('Selanjutnya: pm2 restart sellvpn');
