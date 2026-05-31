'use strict';
// Helper DB untuk modul-modul (Akrab, SMM, Markup)

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
  );
}
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); })
  );
}
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
  );
}

// ── Saldo ────────────────────────────────────────────────
async function getSaldo(db, userId) {
  const row = await dbGet(db, 'SELECT saldo FROM users WHERE user_id = ?', [userId]);
  return row ? (row.saldo || 0) : 0;
}
async function getSaldoAkrab(db, userId) {
  const row = await dbGet(db, 'SELECT saldo_akrab FROM users WHERE user_id = ?', [userId]);
  return row ? (row.saldo_akrab || 0) : 0;
}
async function updateSaldo(db, userId, delta) {
  await dbRun(db, 'UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [delta, userId]);
}
async function updateSaldoAkrab(db, userId, delta) {
  await dbRun(db, 'UPDATE users SET saldo_akrab = saldo_akrab + ? WHERE user_id = ?', [delta, userId]);
}

// ── Markup Config ────────────────────────────────────────
// IMPORTANT: getMarkup mengembalikan EXACTLY markup pada scope yang diminta.
// Tidak ada fallback otomatis ke scope global. Pemanggil yang bertanggung jawab
// mengambil global dan reseller terpisah lalu menggabungkannya via getEffectivePrice.
async function getMarkup(db, scope, service, userId = null) {
  if (scope === 'reseller') {
    if (!userId) return null;
    return await dbGet(db,
      'SELECT * FROM markup_config WHERE scope = ? AND service = ? AND user_id = ?',
      ['reseller', service, userId]
    ) || null;
  }
  // scope = 'global' (atau lainnya)
  return await dbGet(db,
    'SELECT * FROM markup_config WHERE scope = ? AND service = ? AND (user_id IS NULL OR user_id = 0)',
    ['global', service]
  ) || null;
}

async function setMarkup(db, scope, service, userId, type, value) {
  // Untuk scope global, paksa user_id = NULL agar konsisten dengan getMarkup.
  const targetUserId = scope === 'global' ? null : userId;

  let existing;
  if (targetUserId === null || targetUserId === undefined) {
    existing = await dbGet(db,
      'SELECT id FROM markup_config WHERE scope = ? AND service = ? AND (user_id IS NULL OR user_id = 0)',
      [scope, service]
    );
  } else {
    existing = await dbGet(db,
      'SELECT id FROM markup_config WHERE scope = ? AND service = ? AND user_id = ?',
      [scope, service, targetUserId]
    );
  }

  if (existing) {
    await dbRun(db, 'UPDATE markup_config SET type = ?, value = ? WHERE id = ?', [type, value, existing.id]);
  } else {
    await dbRun(db, 'INSERT INTO markup_config (scope, service, user_id, type, value) VALUES (?,?,?,?,?)',
      [scope, service, targetUserId, type, value]);
  }
}

async function deleteMarkup(db, scope, service, userId = null) {
  const targetUserId = scope === 'global' ? null : userId;
  if (targetUserId === null || targetUserId === undefined) {
    await dbRun(db,
      'DELETE FROM markup_config WHERE scope = ? AND service = ? AND (user_id IS NULL OR user_id = 0)',
      [scope, service]);
  } else {
    await dbRun(db,
      'DELETE FROM markup_config WHERE scope = ? AND service = ? AND user_id = ?',
      [scope, service, targetUserId]);
  }
}

function applyMarkup(basePrice, markupRow) {
  if (!markupRow) return basePrice;
  const value = Number(markupRow.value);
  if (!Number.isFinite(value) || value <= 0) return basePrice;
  if (markupRow.type === 'pct') return Math.ceil(Number(basePrice) * (1 + value / 100));
  if (markupRow.type === 'flat') return Number(basePrice) + value;
  return basePrice;
}

// ── Order Helpers ────────────────────────────────────────
async function saveAkrabOrder(db, userId, reffId, produk, tujuan, amount) {
  await dbRun(db,
    'INSERT INTO akrab_orders (user_id, reff_id, produk, tujuan, amount, created_at) VALUES (?,?,?,?,?,?)',
    [userId, reffId, produk, tujuan, amount, Date.now()]
  );
}
async function updateAkrabOrderStatus(db, reffId, status) {
  await dbRun(db, 'UPDATE akrab_orders SET status = ? WHERE reff_id = ?', [status, reffId]);
}
async function getAkrabOrderByReffId(db, reffId) {
  return await dbGet(db, 'SELECT * FROM akrab_orders WHERE reff_id = ?', [reffId]);
}

async function saveSmmOrder(db, userId, orderId, serviceId, target, quantity, amount) {
  await dbRun(db,
    'INSERT INTO smm_orders (user_id, order_id, service_id, target, quantity, amount, created_at) VALUES (?,?,?,?,?,?,?)',
    [userId, orderId, serviceId, target, quantity, amount, Date.now()]
  );
}
async function updateSmmOrderStatus(db, orderId, status) {
  await dbRun(db, 'UPDATE smm_orders SET status = ? WHERE order_id = ?', [status, orderId]);
}
async function getSmmOrders(db, userId, limit = 10) {
  return await dbAll(db,
    'SELECT * FROM smm_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
}

async function getPendingAkrabOrders(db, maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  return await dbAll(db,
    "SELECT * FROM akrab_orders WHERE status = 'pending' AND created_at > ? ORDER BY created_at ASC",
    [cutoff]
  );
}

async function getPendingSmmOrders(db, maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  return await dbAll(db,
    "SELECT * FROM smm_orders WHERE (status = 'pending' OR status = 'processing' OR status = 'In Progress') AND created_at > ? ORDER BY created_at ASC",
    [cutoff]
  );
}

// ── Format Rupiah ────────────────────────────────────────
function formatRp(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

module.exports = {
  dbGet, dbRun, dbAll,
  getSaldo, getSaldoAkrab, updateSaldo, updateSaldoAkrab,
  getMarkup, setMarkup, deleteMarkup, applyMarkup,
  saveAkrabOrder, updateAkrabOrderStatus, getAkrabOrderByReffId, getPendingAkrabOrders,
  saveSmmOrder, updateSmmOrderStatus, getSmmOrders, getPendingSmmOrders,
  formatRp,
};
