'use strict';
const axios = require('axios');

// HidePulsa PPOB — autentikasi pakai API Key global (tanpa OTP / sesi per-user).
// API key dipakai langsung sebagai Bearer token + dikirim juga sebagai header/param
// agar kompatibel dengan beberapa varian backend HidePulsa.

const UA = 'Mozilla/5.0 (compatible; RetriVPNBot/1.0)';

function buildHeaders(apiKey, password) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-KEY': apiKey,
    'X-API-PASSWORD': password || '',
    'Content-Type': 'application/json',
    'User-Agent': UA,
    'Accept': 'application/json',
  };
}

// Dipertahankan agar pemanggil lama tidak error. Sekarang cukup kembalikan API key global.
async function getOrRefreshToken(db, userId, BASE_URL, apiKey) {
  return apiKey || null;
}

async function getProducts(apiKey, BASE_URL, password) {
  const resp = await axios.get(`${BASE_URL}/products`, {
    headers: buildHeaders(apiKey, password),
    params: { api_key: apiKey },
    timeout: 30000,
  });
  return resp.data;
}

async function createTransaction(apiKey, BASE_URL, productCode, target, password) {
  const resp = await axios.post(
    `${BASE_URL}/transaction`,
    { product_code: productCode, target, api_key: apiKey, password },
    { headers: buildHeaders(apiKey, password), timeout: 30000 }
  );
  return resp.data;
}

async function getTransactionStatus(apiKey, BASE_URL, orderId, password) {
  const resp = await axios.get(`${BASE_URL}/transaction/${encodeURIComponent(orderId)}`, {
    headers: buildHeaders(apiKey, password),
    params: { api_key: apiKey },
    timeout: 30000,
  });
  return resp.data;
}

module.exports = { getOrRefreshToken, getProducts, createTransaction, getTransactionStatus };
