'use strict';
const axios = require('axios');

// FayuPedia SMM — endpoint pakai GET dengan path-based:
//   GET /api/services?api_id=X&api_key=Y
//   GET /api/balance?api_id=X&api_key=Y
//   GET /api/order?api_id=X&api_key=Y&service=...&link=...&quantity=...
//   GET /api/status?api_id=X&api_key=Y&id=ORDER_ID
//   GET /api/refill?api_id=X&api_key=Y&id=ORDER_ID
//   GET /api/refill/status?api_id=X&api_key=Y&id=REFILL_ID

const UA = 'Mozilla/5.0 (compatible; RetriVPNBot/1.0)';

async function apiGet(BASE_URL, path, apiId, apiKey, extraParams = {}) {
  const resp = await axios.get(`${BASE_URL}${path}`, {
    params: { api_id: apiId, api_key: apiKey, ...extraParams },
    headers: {
      'Accept': 'application/json',
      'User-Agent': UA,
    },
    timeout: 30000,
    validateStatus: () => true, // jangan auto-throw, biar kita bisa baca body error
  });
  return { status: resp.status, data: resp.data };
}

async function getBalance(BASE_URL, apiId, apiKey) {
  const { status, data } = await apiGet(BASE_URL, '/api/balance', apiId, apiKey);
  if (status >= 400) throw makeApiError(status, data, '/api/balance');
  return data;
}

async function getServices(BASE_URL, apiId, apiKey) {
  const { status, data } = await apiGet(BASE_URL, '/api/services', apiId, apiKey);
  // Validasi sukses
  if (status >= 400) throw makeApiError(status, data, '/api/services');

  // Ambil array layanan dari berbagai kemungkinan struktur
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.services)) return data.services;
  if (Array.isArray(data)) return data;

  // Tidak ditemukan — lempar error dengan info lengkap untuk debugging
  throw makeApiError(status, data, '/api/services');
}

async function createOrder(BASE_URL, apiId, apiKey, serviceId, link, quantity) {
  const { status, data } = await apiGet(BASE_URL, '/api/order', apiId, apiKey, {
    service: serviceId,
    link,
    quantity,
  });
  if (status >= 400) throw makeApiError(status, data, '/api/order');
  return data;
}

async function getOrderStatus(BASE_URL, apiId, apiKey, orderId) {
  const { status, data } = await apiGet(BASE_URL, '/api/status', apiId, apiKey, { id: orderId });
  if (status >= 400) throw makeApiError(status, data, '/api/status');
  return data;
}

async function createRefill(BASE_URL, apiId, apiKey, orderId) {
  const { status, data } = await apiGet(BASE_URL, '/api/refill', apiId, apiKey, { id: orderId });
  if (status >= 400) throw makeApiError(status, data, '/api/refill');
  return data;
}

async function getRefillStatus(BASE_URL, apiId, apiKey, refillId) {
  const { status, data } = await apiGet(BASE_URL, '/api/refill/status', apiId, apiKey, { id: refillId });
  if (status >= 400) throw makeApiError(status, data, '/api/refill/status');
  return data;
}

function makeApiError(httpStatus, body, path) {
  let msg;
  if (typeof body === 'string') {
    msg = body.length > 200 ? body.slice(0, 200) + '...' : body;
  } else if (body && typeof body === 'object') {
    msg = body.msg || body.message || body.error || body.error_message || '';
    if (!msg) msg = JSON.stringify(body).slice(0, 300);
  } else {
    msg = 'Empty response';
  }
  const err = new Error('[' + path + ' HTTP ' + httpStatus + '] ' + msg);
  err.httpStatus = httpStatus;
  err.apiResponse = body;
  err.apiPath = path;
  return err;
}

function groupByCategory(services) {
  const grouped = {};
  (services || []).forEach((s) => {
    const cat = s.category || 'Lainnya';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });
  return grouped;
}

module.exports = {
  getBalance,
  getServices,
  createOrder,
  getOrderStatus,
  createRefill,
  getRefillStatus,
  groupByCategory,
};
