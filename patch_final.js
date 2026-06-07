const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');

// ── 1: Replace handler akrab_paket_global ────────────────────
const oldHandler = `// ── Paket Global dari menu Akrab (kembali ke menu_akrab) ─────
bot.action('akrab_paket_global', async (ctx) => {
  await ctx.answerCbQuery('Memuat...');
  try {
    const produk = await ppob.getProdukList('Global');
    const active = produk.filter(p => p.seller_product_status && p.buyer_product_status);
    const brands = [...new Set(active.map(p => p.brand))].sort();
    const keyboard = { inline_keyboard: [ ...brands.map(b => [{ text: '🌐 ' + b, callback_data: 'ppob_gen_brand_Global__' + b.toLowerCase().split(' ').join('_') }]), [{ text: '🔙 Kembali', callback_data: 'menu_akrab' }] ] };
    try { await ctx.editMessageText('🌐 *Paket Global*\\n\\nPilih operator:', { parse_mode: 'Markdown', reply_markup: keyboard }); }
    catch (_) { await ctx.reply('🌐 *Paket Global*\\n\\nPilih operator:', { parse_mode: 'Markdown', reply_markup: keyboard }); }
  } catch (err) { await ctx.reply('❌ Gagal: ' + err.message); }
});`;

const newHandler = `// ── Paket Global dari menu Akrab (kembali ke menu_akrab) ─────
bot.action('akrab_paket_global', async (ctx) => {
  await ctx.answerCbQuery('Memuat...');
  try {
    const produk = await ppob.getProdukList('Global');
    // Hanya tampilkan yang stok tersedia
    const active = produk.filter(p => p.seller_product_status && p.buyer_product_status && (p.unlimited_stock || (p.stock || 0) > 0));
    if (!active.length) {
      const kb = { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu_akrab' }]] };
      return ctx.editMessageText('🌐 *Paket Global*\\n\\n❌ Tidak ada stok tersedia saat ini.', { parse_mode: 'Markdown', reply_markup: kb })
        .catch(() => ctx.reply('❌ Tidak ada stok tersedia.'));
    }
    const brands = [...new Set(active.map(p => p.brand))].sort();
    const rows = brands.map(b => {
      const items = active.filter(p => p.brand === b);
      const stokTotal = items.reduce((s, p) => s + (p.unlimited_stock ? 9999 : (p.stock || 0)), 0);
      const stokLabel = stokTotal >= 9999 ? 'unlimited' : stokTotal + ' stok';
      return [{ text: '🌐 ' + b + ' | ' + items.length + ' produk | ' + stokLabel, callback_data: 'ppob_gen_brand_Global__' + b.toLowerCase().split(' ').join('_') }];
    });
    rows.push([{ text: '🔙 Kembali', callback_data: 'menu_akrab' }]);
    const keyboard = { inline_keyboard: rows };
    try { await ctx.editMessageText('🌐 *Paket Global*\\n\\nPilih operator (stok tersedia):', { parse_mode: 'Markdown', reply_markup: keyboard }); }
    catch (_) { await ctx.reply('🌐 *Paket Global*\\n\\nPilih operator:', { parse_mode: 'Markdown', reply_markup: keyboard }); }
  } catch (err) { await ctx.reply('❌ Gagal: ' + err.message); }
});`;

if (c.includes(oldHandler)) {
  c = c.replace(oldHandler, newHandler);
  console.log('OK 1: Handler akrab_paket_global diupdate');
} else {
  // Fallback: ganti via index
  const idx = c.indexOf("bot.action('akrab_paket_global'");
  const end = c.indexOf('});', idx) + 3;
  c = c.slice(0, idx) + newHandler.replace('// ── Paket Global dari menu Akrab (kembali ke menu_akrab) ─────\n', '') + c.slice(end);
  console.log('OK 1b: Handler diganti via index');
}

// ── 2: Tambah section Paket Global di cek stok ───────────────
const stokMarker = "body += `\uD83D\uDCCA <b>Ready ${totalReady} \u00B7 Kosong ${totalKosong}</b>`";
const stokIdx = c.indexOf(stokMarker);
if (stokIdx !== -1 && !c.includes('Paket Global (HidePulsa)')) {
  const section = `
    // ── Paket Global HidePulsa ──
    try {
      const gProduk = await ppob.getProdukList('Global');
      const gBrands = [...new Set(gProduk.map(p => p.brand))].sort();
      let gBody = '';
      gBrands.forEach(b => {
        const all = gProduk.filter(p => p.brand === b);
        const aktif = all.filter(p => p.seller_product_status && p.buyer_product_status && (p.unlimited_stock || (p.stock || 0) > 0));
        const stok = aktif.reduce((s, p) => s + (p.unlimited_stock ? 9999 : (p.stock || 0)), 0);
        const icon = aktif.length > 0 ? '\u2705' : '\u274C';
        const stokLabel = stok >= 9999 ? 'unlimited' : stok;
        gBody += icon + ' ' + b + ': ' + aktif.length + '/' + all.length + ' produk, stok: ' + stokLabel + '\\n';
        if (aktif.length > 0) totalReady++; else totalKosong++;
      });
      if (gBody) body += '\uD83C\uDF10 <b>Paket Global (HidePulsa)</b>\\n<code>' + gBody.trim() + '</code>\\n\\n';
    } catch(e) { body += '\uD83C\uDF10 <b>Paket Global</b>: Gagal memuat\\n\\n'; }
  `;
  c = c.slice(0, stokIdx) + section + c.slice(stokIdx);
  console.log('OK 2: Section Paket Global ditambah di cek stok');
} else if (c.includes('Paket Global (HidePulsa)')) {
  console.log('SKIP 2: Section stok sudah ada');
} else {
  console.log('SKIP 2: Marker stok tidak ditemukan');
}

fs.writeFileSync('app.js', c);
console.log('Selesai!');
