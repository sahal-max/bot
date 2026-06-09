// ============================================================
// rapihkan-format.js — Auto-fix semua format tampilan bot
// ============================================================
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'app.js');
const BACKUP = path.join(__dirname, 'app.js.before-rapihkan');

// Backup dulu
fs.copyFileSync(FILE, BACKUP);
console.log('✅ Backup tersimpan:', BACKUP);

let code = fs.readFileSync(FILE, 'utf8');
let changes = 0;

function replace(oldStr, newStr, label) {
  if (!code.includes(oldStr)) {
    console.log('⚠️  SKIP (tidak ditemukan):', label);
    return;
  }
  code = code.replace(oldStr, newStr);
  changes++;
  console.log('✅ FIXED:', label);
}

// ============================================================
// [1] TEST AKRAB V3 DRY RUN
// ============================================================
replace(
  `'🧪 TEST AKRAB V3 — DRY RUN</code>\\n<code>──────────</code>\\n<code>Produk: '+s.product_name.slice(0,30)+'</code>\\n<code>Stok: '+(s.unlimited_stock?'unlimited':s.stock)+'</code>\\n<code>Harga: Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>──────────</code>\\n<code>Masukkan nomor HP test:</code>'`,
  `'🧪 <b>TEST AKRAB V3 — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:'`,
  '[1] Test Akrab V3 Dry Run'
);

// ============================================================
// [2] TEST CIRCLE DRY RUN
// ============================================================
replace(
  `'🧪 TEST CIRCLE — DRY RUN</code>\\n<code>──────────</code>\\n<code>Produk: '+s.product_name.slice(0,30)+'</code>\\n<code>Stok: '+(s.unlimited_stock?'unlimited':s.stock)+'</code>\\n<code>Harga: Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>──────────</code>\\n<code>Masukkan nomor HP test:</code>'`,
  `'🔴 <b>TEST CIRCLE — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b> : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 📊 <b>Stok</b>   : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>  : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:'`,
  '[2] Test Circle Dry Run'
);

// ============================================================
// [3] TEST PPOB DRY RUN
// ============================================================
replace(
  `'🧪 TEST PPOB — DRY RUN</code>\\n<code>──────────</code>\\n<code>Produk: '+s.product_name.slice(0,30)+'</code>\\n<code>Kategori: '+s.category+'</code>\\n<code>Stok: '+(s.unlimited_stock?'unlimited':s.stock)+'</code>\\n<code>Harga: Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>──────────</code>\\n<code>Masukkan nomor HP test:</code>'`,
  `'📱 <b>TEST PPOB — DRY RUN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b>   : <code>'+s.product_name.slice(0,30)+'</code>\\n┃ 🏷 <b>Kategori</b> : <code>'+s.category+'</code>\\n┃ 📊 <b>Stok</b>     : <code>'+(s.unlimited_stock?'unlimited':s.stock)+'</code> unit\\n┃ 💰 <b>Harga</b>    : <code>Rp '+harga.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Masukkan nomor HP test:'`,
  '[3] Test PPOB Dry Run'
);

// ============================================================
// [4a] PPOB KONFIRMASI BELI (ppob_listed handler)
// ============================================================
replace(
  `return ctx.reply('Konfirmasi\\nProduk: ' + produk.product_name + '\\nNomor: ' + state.customerNo + '\\nHarga: ' + ppob.formatRupiah(finalPrice1) + '\\nLanjutkan?', { parse_mode: 'Markdown', reply_markup: keyboard });`,
  `return ctx.reply('✅ <b>KONFIRMASI PEMBELIAN</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>Produk</b> : <code>'+produk.product_name+'</code>\\n┃ 📱 <b>Nomor</b>  : <code>'+state.customerNo+'</code>\\n┃ 💰 <b>Harga</b>  : <code>'+ppob.formatRupiah(finalPrice1)+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\nLanjutkan pembelian?', { parse_mode: 'HTML', reply_markup: keyboard });`,
  '[4a] PPOB Konfirmasi Beli'
);

// ============================================================
// [4b] PPOB BELI LANGSUNG (ppob_beli handler) - prompt input nomor
// ============================================================
replace(
  `await ctx.reply('Produk: ' + produk.product_name + '\\nHarga: ' + ppob.formatRupiah(finalPrice2) + '\\nKirim nomor tujuan:', { parse_mode: 'Markdown' });`,
  `await ctx.reply('📦 <b>'+produk.product_name+'</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💰 <b>Harga</b>: <code>'+ppob.formatRupiah(finalPrice2)+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📱 Kirim nomor tujuan (08xxxxxxxxxx):', { parse_mode: 'HTML' });`,
  '[4b] PPOB Beli - Input Nomor'
);

// ============================================================
// [5] LIST PRODUK AKRAB/CIRCLE (showHidepulsaGlobal)
// ============================================================
replace(
  `return ctx.editMessageText(label+'\\n<code>──────────────────────</code>\\n✦ Tidak ada stok tersedia.', {`,
  `return ctx.editMessageText(label+'\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ ✦ Tidak ada stok tersedia.\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>', {`,
  '[5a] List Produk - Kosong'
);

replace(
  `const rows = filtered.map(p => {
      const stok = p.unlimited_stock ? 'unlimited' : (p.stock||0);
      const base = Number(p.price||0);
      const finalPrice = wallet.getEffectivePrice(base, mkGlobal, mkReseller);
      const gbMatch = p.product_name.match(/(\\d+GB[^|\\n]*)/i);
      const shortName = gbMatch ? gbMatch[0].trim() : p.product_name.slice(0,35);
      return [{ text: shortName+' | Rp '+finalPrice.toLocaleString('id-ID'), callback_data: 'ppob_beli_global_'+p.buyer_sku_code }];
    });`,
  `const rows = filtered.map(p => {
      const stok = p.unlimited_stock ? '∞' : (p.stock||0);
      const base = Number(p.price||0);
      const finalPrice = wallet.getEffectivePrice(base, mkGlobal, mkReseller);
      const gbMatch = p.product_name.match(/(\\d+GB[^|\\n]*)/i);
      const shortName = gbMatch ? gbMatch[0].trim() : p.product_name.slice(0,35);
      return [{ text: shortName+' | Rp '+finalPrice.toLocaleString('id-ID')+' | '+stok+' unit', callback_data: 'ppob_beli_global_'+p.buyer_sku_code }];
    });`,
  '[5b] List Produk - Tombol dengan Stok'
);

replace(
  `label+'\\n<code>──────────────────────</code>\\n📦 '+filtered.length+' produk tersedia\\n✦ Pilih produk:',`,
  `label+'\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>'+filtered.length+'</b> produk tersedia | Total stok: <b>'+totalStok+'</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ ✦ Pilih produk:'`,
  '[5c] List Produk - Header'
);

// ============================================================
// [6a] DETAIL PRODUK PPOB GLOBAL
// ============================================================
replace(
  `'🛒 <b>Detail Produk</b>\\n<code>──────────────────────</code>\\n'+
      '📦 '+item.product_name+'\\n'+
      '💰 Harga: <b>Rp '+finalPrice.toLocaleString('id-ID')+'</b>\\n'+
      '📊 Stok: <b>'+stok+'</b>\\n\\n✦ Masukkan nomor HP tujuan:',`,
  `'🛒 <b>Detail Produk</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n'+
      '┃ 📦 <b>Produk</b> : <code>'+item.product_name+'</code>\\n'+
      '┃ 💰 <b>Harga</b>  : <code>Rp '+finalPrice.toLocaleString('id-ID')+'</code>\\n'+
      '┃ 📊 <b>Stok</b>   : <code>'+stok+'</code> unit\\n'+
      '<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n'+
      '┃ 📱 Masukkan nomor HP tujuan:',`,
  '[6a] Detail Produk PPOB Global'
);

// ============================================================
// [6b] SALDO TIDAK CUKUP (Global purchase)
// ============================================================
replace(
  `'❌  Saldo tembak kuota tidak cukup.\\nSaldo: Rp '+Number(saldo).toLocaleString('id-ID')+'\\nDibutuhkan: Rp '+finalPrice.toLocaleString('id-ID'),`,
  `'❌ <b>Saldo Tidak Cukup</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💳 <b>Saldo</b>     : <code>Rp '+Number(saldo).toLocaleString('id-ID')+'</code>\\n┃ 💰 <b>Dibutuhkan</b>: <code>Rp '+finalPrice.toLocaleString('id-ID')+'</code>\\n┃ 📉 <b>Kekurangan</b>: <code>Rp '+(finalPrice - saldo).toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ ⚠️ Top up saldo terlebih dahulu.',`,
  '[6b] Saldo Tidak Cukup (Global)'
);

// ============================================================
// [6c] TRANSAKSI BERHASIL (Global purchase)
// ============================================================
replace(
  `'✅  <b>Transaksi Berhasil!</b>\\n<code>──────────────────────</code>\\n'+
      '📦 '+item.product_name+'\\n'+
      '📱 Tujuan: <code>'+customerNo+'</code>\\n'+
      '💰 Nominal: Rp '+finalPrice.toLocaleString('id-ID')+'\\n'+
      '🔖 Ref ID: <code>'+txId+'</code>\\n'+
      '📊 Status: '+(result&&result.data&&result.data.message||'pending'),`,
  `'✅ <b>Transaksi Berhasil!</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n'+
      '┃ 📦 <b>Produk</b>   : <code>'+item.product_name+'</code>\\n'+
      '┃ 📱 <b>Tujuan</b>   : <code>'+customerNo+'</code>\\n'+
      '┃ 💰 <b>Nominal</b>  : <code>Rp '+finalPrice.toLocaleString('id-ID')+'</code>\\n'+
      '┃ 🔖 <b>Ref ID</b>   : <code>'+txId+'</code>\\n'+
      '┃ 📊 <b>Status</b>   : '+(result&&result.data&&result.data.message||'pending')+'\\n'+
      '<code>━━━━━━━━━━━━━━━━━━━━━━</code>',`,
  '[6c] Transaksi Berhasil (Global)'
);

// ============================================================
// [7] RIWAYAT TRANSAKSI HEADER
// ============================================================
replace(
  `let text = '📜 <b>Riwayat Transaksi — ' + (katLabel[kategori] || 'Semua') + '</b>\\n';
  text += '<code>──────────────────────</code>\\n';`,
  `let text = '📜 <b>Riwayat Transaksi — ' + (katLabel[kategori] || 'Semua') + '</b>\\n';
  text += '<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n';`,
  '[7] Riwayat Transaksi Header'
);

// ============================================================
// [8] SYARAT RESELLER
// ============================================================
replace(
  `'*SYARAT RESELLER*\\n\\n' +
      \`Minimal top up jadi reseller: \${formatRupiah(terms.join_topup_min)}\\n\` +
      \`Minimal top up per bulan: \${formatRupiah(terms.min_topup)}\\n\\n\` +
      'Gunakan tombol di bawah untuk mengubah syarat.',`,
  `'📋 <b>SYARAT RESELLER</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💰 <b>Top Up Awal</b>   : <code>'+formatRupiah(terms.join_topup_min)+'</code>\\n┃ 📅 <b>Top Up Bulanan</b> : <code>'+formatRupiah(terms.min_topup)+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\nGunakan tombol di bawah untuk mengubah syarat.', { parse_mode: 'HTML' };
    const message2 =`,
  '[8] Syarat Reseller'
);

// ============================================================
// [9a] SALDO USER TIDAK CUKUP (admin hapus saldo)
// ============================================================
replace(
  `return ctx.reply(\` *Saldo user tidak mencukupi!*\\n\\nSaldo user: Rp \${user.saldo.toLocaleString('id-ID')}\\nJumlah hapus: Rp \${amount.toLocaleString('id-ID')}\\nKekurangan: Rp \${(amount - user.saldo).toLocaleString('id-ID')}\`, {
          parse_mode: 'Markdown'
        });`,
  `return ctx.reply('❌ <b>Saldo Tidak Cukup</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💳 <b>Saldo User</b>  : <code>Rp '+user.saldo.toLocaleString('id-ID')+'</code>\\n┃ 💰 <b>Jumlah Hapus</b>: <code>Rp '+amount.toLocaleString('id-ID')+'</code>\\n┃ 📉 <b>Kekurangan</b>  : <code>Rp '+(amount - user.saldo).toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>', { parse_mode: 'HTML' });`,
  '[9a] Saldo User Tidak Cukup'
);

// ============================================================
// [9b] SALDO BERHASIL DIHAPUS
// ============================================================
replace(
  `\` Saldo sebesar *Rp \${amount.toLocaleString('id-ID')}* berhasil dihapus dari user \\\`\${targetUserId}\\\`.\\n Saldo user sekarang: *Rp \${updatedRow.saldo.toLocaleString('id-ID')}*\`,
              { parse_mode: 'Markdown' }`,
  `'✅ <b>Saldo Berhasil Dihapus</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 💰 <b>Dihapus</b>    : <code>Rp '+amount.toLocaleString('id-ID')+'</code>\\n┃ 👤 <b>User</b>       : <code>'+targetUserId+'</code>\\n┃ 💳 <b>Saldo Kini</b>  : <code>Rp '+updatedRow.saldo.toLocaleString('id-ID')+'</code>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>',
              { parse_mode: 'HTML' }`,
  '[9b] Saldo Berhasil Dihapus'
);

// ============================================================
// RESTOK BROADCAST — AKRAB V3
// ============================================================
replace(
  `await broadcastHidepulsaRestok(\`🟣 <b>RESTOK AKRAB V3</b>\\n<code>──────────────────────</code>\\n\${stokText}\\n<code>──────────────────────</code>\\n🛒 <i>Segera beli sebelum habis!</i>\`);`,
  `await broadcastHidepulsaRestok(\`🟣 <b>RESTOK AKRAB V3</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n\${stokText}\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n📌 <i>Segera beli sebelum habis!</i>\`);`,
  '[10a] Restok Broadcast Akrab V3'
);

// ============================================================
// RESTOK BROADCAST — CIRCLE
// ============================================================
replace(
  `await broadcastHidepulsaRestok(\`🔴 <b>RESTOK CIRCLE</b>\\n<code>──────────────────────</code>\\n\${stokText}\\n<code>──────────────────────</code>\\n🛒 <i>Segera beli sebelum habis!</i>\`);`,
  `await broadcastHidepulsaRestok(\`🔴 <b>RESTOK CIRCLE</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n\${stokText}\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n📌 <i>Segera beli sebelum habis!</i>\`);`,
  '[10b] Restok Broadcast Circle'
);

// ============================================================
// Tulis file
// ============================================================
if (changes === 0) {
  console.log('\n⚠️  Tidak ada perubahan yang berhasil diterapkan!');
  console.log('File asli tidak diubah.');
  fs.unlinkSync(BACKUP);
  process.exit(0);
}

fs.writeFileSync(FILE, code, 'utf8');
console.log('\n🎉 SELESAI! Total', changes, 'bagian berhasil dirapikan.');
console.log('📁 Backup:', BACKUP);
console.log('\nSelanjutnya jalankan: pm2 restart sellvpn');
