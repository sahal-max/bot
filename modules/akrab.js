'use strict';
const axios = require('axios');
const crypto = require('crypto');

function generateUUID() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getProducts(BASE_URL, apiKey) {
  const resp = await axios.get(`${BASE_URL}/api_v2/list_product`, {
    params: { api_key: apiKey },
  });
  return Array.isArray(resp.data) ? resp.data : (resp.data && resp.data.data) || [];
}

async function createTransaction(BASE_URL, apiKey, produk, tujuan, reffId) {
  const resp = await axios.get(`${BASE_URL}/api_v2/trx`, {
    params: { produk, tujuan, reff_id: reffId, api_key: apiKey },
  });
  return resp.data;
}

async function getTransactionStatus(BASE_URL, apiKey, reffId) {
  const resp = await axios.get(`${BASE_URL}/api_v2/history`, {
    params: { api_key: apiKey, refid: reffId },
  });
  return resp.data;
}

// KHFY membungkus banyak endpoint dengan bentuk { status, data: [...] / {...}, message }.
// createTransaction/getTransactionStatus mengembalikan body mentah, jadi caller harus
// mem-bongkar sendiri — fungsi ini menyatukan logikanya supaya konsisten di semua tempat
// dan tidak salah membaca field `status` milik wrapper (boolean sukses-panggil-API)
// sebagai status transaksi (sukses/gagal/pending).
function extractTrxRecord(result) {
  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result.data)) return result.data[0] || null;
  if (result.data && typeof result.data === 'object') return result.data;
  return result;
}

// Ambil teks status transaksi yang sesungguhnya (bukan flag boolean wrapper API).
function extractTrxStatusText(result, fallback = 'pending') {
  const record = extractTrxRecord(result);
  if (!record) return fallback;
  const candidates = [record.status, record.keterangan, record.message];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return fallback;
}

async function cekStokAkrab(BASE_URL) {
  const resp = await axios.get(`${BASE_URL}/api_v3/cek_stock_akrab`);
  return resp.data;
}

async function cekStokAkrabV2(BASE_URL) {
  // Endpoint khusus XDA (Akrab V2). Format: { status, message: "XDA76 | 93 unit\nXDA31 | 216 unit\n..." }
  const resp = await axios.get(`${BASE_URL}/api_v3/cek_stock_akrab_v2`);
  return resp.data;
}

// Parse string format "XDA76 | 93 unit\nXDA31 | 216 unit" → [{type:"XDA76", sisa_slot:93}, ...]
function parseStokV2Message(msg) {
  if (!msg || typeof msg !== 'string') return [];
  return msg.split('\n').map((line) => {
    const m = line.match(/^\s*([A-Z0-9]+)\s*\|\s*(\d+)\s*unit/i);
    if (!m) return null;
    return { type: m[1].toUpperCase(), nama: m[1], sisa_slot: Number(m[2]) };
  }).filter(Boolean);
}

module.exports = {
  generateUUID,
  getProducts,
  createTransaction,
  getTransactionStatus,
  extractTrxRecord,
  extractTrxStatusText,
  cekStokAkrab,
  cekStokAkrabV2,
  parseStokV2Message,
};
