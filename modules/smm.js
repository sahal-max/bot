'use strict';
const axios = require('axios');

async function apiCall(BASE_URL, apiId, apiKey, extra = {}) {
  const resp = await axios.post(
    BASE_URL + '/api',
    { api_id: apiId, api_key: apiKey, ...extra },
    { timeout: 30000 }
  );
  return resp.data;
}

async function getBalance(BASE_URL, apiId, apiKey) {
  return await apiCall(BASE_URL, apiId, apiKey, { action: 'balance' });
}

async function getServices(BASE_URL, apiId, apiKey) {
  const result = await apiCall(BASE_URL, apiId, apiKey, { action: 'services' });
  return Array.isArray(result) ? result : (result && result.data) || [];
}

async function createOrder(BASE_URL, apiId, apiKey, serviceId, link, quantity) {
  return await apiCall(BASE_URL, apiId, apiKey, {
    action: 'add',
    service: serviceId,
    link,
    quantity,
  });
}

async function getOrderStatus(BASE_URL, apiId, apiKey, orderId) {
  return await apiCall(BASE_URL, apiId, apiKey, { action: 'status', order: orderId });
}

async function createRefill(BASE_URL, apiId, apiKey, orderId) {
  return await apiCall(BASE_URL, apiId, apiKey, { action: 'refill', order: orderId });
}

async function getRefillStatus(BASE_URL, apiId, apiKey, refillId) {
  return await apiCall(BASE_URL, apiId, apiKey, { action: 'refill_status', refill: refillId });
}

function groupByCategory(services) {
  const grouped = {};
  services.forEach((s) => {
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
