const fs = require('fs');
const FILE = 'app.js';
let code = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// 1. Ganti <code>──────────────────────────</code> (panjang - 26 dash)
const longDash = '<code>──────────────────────────</code>';
const longSolid = '<code>━━━━━━━━━━━━━━━━━━━━━━━━━━</code>';
let count1 = 0;
while (code.includes(longDash)) {
  code = code.replace(longDash, longSolid);
  count1++;
}
if (count1 > 0) {
  changes += count1;
  console.log('✅ FIXED ' + count1 + 'x: Separator panjang ── → ━━');
}

// 2. Ganti <code>──────────────────────</code> (sedang - 22 dash)
const medDash = '<code>──────────────────────</code>';
const medSolid = '<code>━━━━━━━━━━━━━━━━━━━━━━</code>';
let count2 = 0;
while (code.includes(medDash)) {
  code = code.replace(medDash, medSolid);
  count2++;
}
if (count2 > 0) {
  changes += count2;
  console.log('✅ FIXED ' + count2 + 'x: Separator sedang ── → ━━');
}

// 3. Ganti <code>──────────</code> (pendek - 10 dash)
const shortDash = '<code>──────────</code>';
const shortSolid = '<code>━━━━━━━━━━</code>';
let count3 = 0;
while (code.includes(shortDash)) {
  code = code.replace(shortDash, shortSolid);
  count3++;
}
if (count3 > 0) {
  changes += count3;
  console.log('✅ FIXED ' + count3 + 'x: Separator pendek ── → ━━');
}

// 4. Ganti standalone separator (tanpa <code> tag) - hanya di template string
// Cari pola `────────────────────` yang ada di dalam backtick string
let count4 = 0;
code = code.replace(/`([^`]*?)────────────────────([^`]*?)`/g, (match) => {
  // Skip jika ini komentar kode (baris diawali //)
  const replaced = match.replace(/────────────────────/g, '━━━━━━━━━━━━━━━━━━━━');
  if (replaced !== match) count4++;
  return replaced;
});
if (count4 > 0) {
  changes += count4;
  console.log('✅ FIXED ' + count4 + 'x: Separator standalone ── → ━━');
}

// 5. Ganti garis yang di dalam string biasa (bukan komentar)
// Pattern: baris yang berisi string dengan dash separator tapi bukan // ──
const lines = code.split('\n');
let count5 = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Skip komentar kode
  if (line.trim().startsWith('//')) continue;
  // Skip import/require
  if (line.trim().startsWith('const ') && line.includes('require')) continue;
  
  // Cari separator di dalam string (ada di dalam ' atau `)
  if (line.includes("'") || line.includes('`') || line.includes('"')) {
    const newLine = line
      .replace(/──────────────────────/g, '━━━━━━━━━━━━━━━━━━━━━━')
      .replace(/──────────────────────────/g, '━━━━━━━━━━━━━━━━━━━━━━━━━━')
      .replace(/──────────/g, '━━━━━━━━━━');
    if (newLine !== line) {
      lines[i] = newLine;
      count5++;
      console.log('✅ FIXED [line ' + (i+1) + ']: ' + line.trim().substring(0, 60) + '...');
    }
  }
}
if (count5 > 0) changes += count5;

fs.writeFileSync(FILE, code, 'utf8');

// Tulis ulang jika ada perubahan per-baris
if (count5 > 0) {
  fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
}

console.log('\n🎉 SELESAI! Total ' + changes + ' separator berhasil diganti.');
console.log('Selanjutnya: pm2 restart sellvpn');
