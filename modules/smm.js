'use strict';
const axios = require('axios');

// FayuPedia SMM — endpoint pakai GET dengan path-based:
//   GET /api/services?api_id=X&api_key=Y
//   GET /api/balance?api_id=X&api_key=Y
//   POST/GET /api/order?api_id=X&api_key=Y&service=...&link=...&quantity=...
//   GET /api/status?api_id=X&api_key=Y&id=ORDER_ID
//   GET /api/refill?api_id=X&api_key=Y&id=ORDER_ID
//   GET /api/refill/status?api_id=X&api_key=Y&id=REFILL_ID

async function apiGet(BASE_URL, path, apiId, apiKey, extraParams = {}) {
  const resp = await axios.get(`${BASE_URL}${path}`, {
    params: { api_id: apiId, api_key: apiKey, ...extraParams },
    timeout: 30000,
  });
  return resp.data;
}

async function getBalance(BASE_URL, apiId, apiKey) {
  return await apiGet(BASE_URL, '/api/balance', apiId, apiKey);
}

async function getServices(BASE_URL, apiId, apiKey) {
  const result = await apiGet(BASE_URL, '/api/services', apiId, apiKey);
  // FayuPedia mengembalikan: { ok, status, count, data: [...] }
  if (result && Array.isArray(result.data)) return result.data;
  if (Array.isArray(result)) return result;
  return [];
}

async function createOrder(BASE_URL, apiId, apiKey, serviceId, link, quantity) {
  return await apiGet(BASE_URL, '/api/order', apiId, apiKey, {
    service: serviceId,
    link,
    quantity,
  });
}

async function getOrderStatus(BASE_URL, apiId, apiKey, orderId) {
  return await apiGet(BASE_URL, '/api/status', apiId, apiKey, { id: orderId });
}

async function createRefill(BASE_URL, apiId, apiKey, orderId) {
  return await apiGet(BASE_URL, '/api/refill', apiId, apiKey, { id: orderId });
}

async function getRefillStatus(BASE_URL, apiId, apiKey, refillId) {
  return await apiGet(BASE_URL, '/api/refill/status', apiId, apiKey, { id: refillId });
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
