const fs = require('fs');
const FILE = 'app.js';
let lines = fs.readFileSync(FILE, 'utf8').split('\n');

// Replace baris 10677-10680 dengan versi yang benar
const idx = 10676; // baris 10677 (0-indexed)

console.log('OLD baris 10677-10680:');
for (let i = 0; i < 4; i++) {
  console.log(`  ${10677+i}: ${lines[idx+i].substring(0, 80)}...`);
}

// Ganti dengan versi baru yang pasti benar
lines[idx] = '    await ctx.editMessageText(';
lines[idx+1] = "      label+'\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ 📦 <b>'+filtered.length+'</b> produk tersedia | Total stok: <b>'+totalStok+'</b>\\n<code>━━━━━━━━━━━━━━━━━━━━━━</code>\\n┃ ✦ Pilih produk:',";
lines[idx+2] = "      { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }";
lines[idx+3] = '    ).catch(()=>ctx.reply(label, { reply_markup: { inline_keyboard: rows } }));';

console.log('\nNEW baris 10677-10680:');
for (let i = 0; i < 4; i++) {
  console.log(`  ${10677+i}: ${lines[idx+i].substring(0, 80)}...`);
}

fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log('\n✅ Baris 10677-10680 berhasil diperbaiki!');
