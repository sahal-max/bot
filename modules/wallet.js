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

// Markup DIPISAH, TIDAK ditumpuk:
//  - Reseller (punya markup reseller sendiri) → pakai markup reseller SAJA
//  - Member biasa (tanpa markup reseller)      → pakai markup global SAJA
// Reseller dan member tidak pernah dijumlah bersama.
function getEffectivePrice(basePrice, markupGlobal, markupReseller) {
  if (markupReseller) return dbH.applyMarkup(basePrice, markupReseller);
  if (markupGlobal) return dbH.applyMarkup(basePrice, markupGlobal);
  return Number(basePrice) || 0;
}

module.exports = {
  potongSaldoVPN,
  potongSaldoAkrab,
  tambahSaldoVPN,
  tambahSaldoAkrab,
  getEffectivePrice,
};
