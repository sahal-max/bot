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

async function cekStokAkrab(BASE_URL) {
  const resp = await axios.get(`${BASE_URL}/api_v3/cek_stock_akrab`);
  return resp.data;
}

module.exports = {
  generateUUID,
  getProducts,
  createTransaction,
  getTransactionStatus,
  cekStokAkrab,
};
