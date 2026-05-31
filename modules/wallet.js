'use strict';
const dbH = require('./db_helpers');

async function potongSaldoVPN(db, userId, amount, referenceId, type) {
  const saldo = await dbH.getSaldo(db, userId);
  if (saldo < amount) throw new Error(`Saldo VPN tidak cukup. Saldo: ${saldo}, Dibutuhkan: ${amount}`);
  await dbH.updateSaldo(db, userId, -amount);
  await new Promise((res, rej) => db.run(
    'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?,?,?,?,?)',
    [userId, -amount, type, referenceId, Date.now()],
    err => err ? rej(err) : res()
  ));
}

async function potongSaldoAkrab(db, userId, amount, referenceId, type) {
  const saldo = await dbH.getSaldoAkrab(db, userId);
  if (saldo < amount) throw new Error(`Saldo Akrab tidak cukup. Saldo: ${saldo}, Dibutuhkan: ${amount}`);
  await dbH.updateSaldoAkrab(db, userId, -amount);
  await new Promise((res, rej) => db.run(
    'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?,?,?,?,?)',
    [userId, -amount, type, referenceId, Date.now()],
    err => err ? rej(err) : res()
  ));
}

async function tambahSaldoVPN(db, userId, amount) {
  await dbH.updateSaldo(db, userId, amount);
  await new Promise((res, rej) => db.run(
    'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?,?,?,?,?)',
    [userId, amount, 'deposit_vpn', 'topup-vpn-' + Date.now(), Date.now()],
    err => err ? rej(err) : res()
  ));
}

async function tambahSaldoAkrab(db, userId, amount) {
  await dbH.updateSaldoAkrab(db, userId, amount);
  await new Promise((res, rej) => db.run(
    'INSERT INTO transactions (user_id, amount, type, reference_id, timestamp) VALUES (?,?,?,?,?)',
    [userId, amount, 'deposit_akrab', 'topup-akrab-' + Date.now(), Date.now()],
    err => err ? rej(err) : res()
  ));
}

// Markup bertingkat sesuai PRD section 6 & 7.2:
//  - Harga dasar bot  = harga API + markup global admin
//  - Harga jual reseller = harga dasar bot + markup reseller (DITUMPUK)
// Contoh: API 10.000 → +10% global = 11.000 → +9% reseller = 11.990
//  - User biasa (tanpa markup reseller) → harga API + markup global saja
function getEffectivePrice(basePrice, markupGlobal, markupReseller) {
  let price = Number(basePrice) || 0;
  if (markupGlobal) price = dbH.applyMarkup(price, markupGlobal);
  if (markupReseller) price = dbH.applyMarkup(price, markupReseller);
  return price;
}

module.exports = {
  potongSaldoVPN,
  potongSaldoAkrab,
  tambahSaldoVPN,
  tambahSaldoAkrab,
  getEffectivePrice,
};
