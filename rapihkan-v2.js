const fs = require('fs');
const FILE = 'app.js';
const BACKUP = 'app.js.before-rapihkan-v2';
fs.copyFileSync(FILE, BACKUP);

let lines = fs.readFileSync(FILE, 'utf8').split('\n');
let changes = 0;

function replaceLine(pattern, newContent, label) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) {
      lines[i] = newContent;
      changes++;
      console.log('✅ FIXED [line ' + (i+1) + ']:', label);
      return;
    }
  }
  console.log('⚠️  SKIP:', label);
}

// [1] TEST AKRAB V3 DRY RUN
replaceLine(
  "await ctx.editMessageText('<code>🧪 TEST AKRAB V3",
  "    await ctx.editMessageText('🧪 <b>TEST AKRAB V3 — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:',",
  '[1] Test Akrab V3 Dry Run'
);

// [2] TEST CIRCLE DRY RUN
replaceLine(
  "await ctx.editMessageText('<code>🧪 TEST CIRCLE",
  "    await ctx.editMessageText('🔴 <b>TEST CIRCLE — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:',",
  '[2] Test Circle Dry Run'
);

// [3] TEST PPOB DRY RUN
replaceLine(
  "await ctx.editMessageText('<code>🧪 TEST PPOB",
  "    await ctx.editMessageText('📱 <b>TEST PPOB — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b>   : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 🏷 <b>Kategori</b> : <code>'+s.category+'</code>\\n┃ 📊 <b>Stok</b>     : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>    : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:',",
  '[3] Test PPOB Dry Run'
);

// [8] SYARAT RESELLER — ganti baris pertama
replaceLine(
  "'*SYARAT RESELLER*\\n\\n' +",
  "      '📋 <b>SYARAT RESELLER</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💰 <b>Top Up Awal</b>   : <code>'+formatRupiah(terms.join_topup_min)+'</code>\\n┃ 📅 <b>Top Up Bulanan</b> : <code>'+formatRupiah(terms.min_topup)+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\nGunakan tombol di bawah untuk mengubah syarat.';",
  '[8] Syarat Reseller'
);

// Hapus 2 baris setelah [8] yang sekarang redundant
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('formatRupiah(terms.join_topup_min)') && lines[i].includes('Minimal top up jadi reseller')) {
    lines[i] = ''; // kosongkan baris ini
    if (lines[i+1] && lines[i+1].includes('Minimal top up per bulan')) {
      lines[i+1] = ''; // kosongkan baris berikutnya
    }
    if (lines[i+2] && lines[i+2].includes('Gunakan tombol di bawah')) {
      lines[i+2] = ''; // kosongkan baris berikutnya
    }
    console.log('✅ CLEANED [8] redundant lines');
    break;
  }
}

// [9a] SALDO USER TIDAK CUKUP (admin hapus saldo)
replaceLine(
  "return ctx.reply(` *Saldo user tidak mencukupi!*\\n\\nSaldo user: Rp",
  "        return ctx.reply('❌ <b>Saldo Tidak Cukup</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💳 <b>Saldo User</b>  : <code>Rp '+user.saldo.toLocaleString('id-ID')+'</code>\\n┃ 💰 <b>Jumlah Hapus</b>: <code>Rp '+amount.toLocaleString('id-ID')+'</code>\\n┃ 📉 <b>Kekurangan</b>  : <code>Rp '+(amount - user.saldo).toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>', { parse_mode: 'HTML' });",
  '[9a] Saldo User Tidak Cukup'
);

// [PREORDER] Antrian Pre-Order
replaceLine(
  "`📋 <b>Antrian Pre-Order Aktif</b>\\n` +",
  "    `📋 <b>Antrian Pre-Order Aktif</b>\\n` +",
  '[PREORDER] Header'
);

// Tulis file
fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log('\n🎉 SELESAI! Total', changes, 'bagian berhasil diperbaiki.');
console.log('📁 Backup:', BACKUP);
