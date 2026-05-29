'use strict';
// Hapus emoji dari app.js dan modules/*.js (lebih clean, tanpa menghapus menu/teks)
const fs = require('fs');
const path = require('path');

// Range Unicode emoji + variation selectors + ZWJ
const EMOJI_RE = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{1F1E0}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

// Karakter "box drawing" yang dipakai di template tampilan (━ ─ ┃ ┏ ┓ ┗ ┛ ┣ ┫) tetap dipertahankan.
// Hanya emoji yang dihapus.

function stripEmojiFromString(s) {
  // Hapus emoji + sisa-sisa spasi rangkap akibat penghapusan
  let out = s.replace(EMOJI_RE, '');
  // Rapikan spasi ganda hanya jika muncul di dalam string literal (tetap pertahankan baris baru, tab, dll)
  // Hilangkan spasi sebelum tanda baca tertentu
  out = out.replace(/  +/g, ' ');
  out = out.replace(/ +([:.,;])/g, '$1');
  // Trim spasi tepat setelah tanda kutip pembuka dan sebelum tanda kutip penutup
  return out;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  // Hanya proses string literal: '...', "...", `...`
  // Pendekatan sederhana: jalankan regex emoji di seluruh file (emoji tidak muncul di syntax JS).
  // Itu paling aman dan menghapus emoji baik di string maupun di komentar.
  const next = original.replace(EMOJI_RE, (m) => { changed++; return ''; });

  // Rapikan spasi ganda yang muncul akibat emoji dihapus, tapi hanya di dalam string literal/template.
  // Pakai regex yang konservatif: pasangan kutip ' ", template literal `, dan teks di antaranya.
  // Untuk meminimalkan resiko, kita biarkan saja spasi ganda.

  if (changed > 0) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
  return changed;
}

const root = path.resolve(__dirname, '..');
const targets = [
  path.join(root, 'app.js'),
  path.join(root, 'modules', 'akrab.js'),
  path.join(root, 'modules', 'create.js'),
  path.join(root, 'modules', 'createzivpn.js'),
  path.join(root, 'modules', 'db_helpers.js'),
  path.join(root, 'modules', 'del.js'),
  path.join(root, 'modules', 'lock.js'),
  path.join(root, 'modules', 'ppob.js'),
  path.join(root, 'modules', 'renew.js'),
  path.join(root, 'modules', 'reseller.js'),
  path.join(root, 'modules', 'smm.js'),
  path.join(root, 'modules', 'trial.js'),
  path.join(root, 'modules', 'trialzivpn.js'),
  path.join(root, 'modules', 'unlock.js'),
  path.join(root, 'modules', 'wallet.js'),
];

let total = 0;
for (const f of targets) {
  if (!fs.existsSync(f)) continue;
  const n = processFile(f);
  total += n;
  console.log(`${path.relative(root, f).padEnd(30)}: ${n} emoji dihapus`);
}
console.log(`\nTotal: ${total} emoji dihapus.`);
