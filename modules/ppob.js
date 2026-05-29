'use strict';
const axios = require('axios');
const dbH = require('./db_helpers');

async function getOrRefreshToken(db, userId, BASE_URL) {
  const token = await dbH.getHidepulsaToken(db, userId);
  if (!token) return null;

  // Masih valid (buffer 60 detik)
  if (token.expires_at && token.expires_at > Date.now() + 60000) {
    return token.access_token;
  }

  // Refresh
  if (!token.refresh_token) return null;
  try {
    const resp = await axios.post(`${BASE_URL}/auth/refresh`, {
      refresh_token: token.refresh_token,
    });
    const data = resp.data || {};
    const accessToken = data.access_token;
    if (!accessToken) return null;
    const expiresIn = Number(data.expires_in) || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;
    await dbH.saveHidepulsaToken(db, userId, accessToken, token.refresh_token, expiresAt);
    return accessToken;
  } catch (err) {
    return null; // perlu OTP ulang
  }
}

async function getProducts(accessToken, BASE_URL) {
  const resp = await axios.get(`${BASE_URL}/products`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return resp.data;
}

async function createTransaction(accessToken, BASE_URL, productCode, target) {
  const resp = await axios.post(
    `${BASE_URL}/transaction`,
    { product_code: productCode, target },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return resp.data;
}

async function getTransactionStatus(accessToken, BASE_URL, orderId) {
  const resp = await axios.get(`${BASE_URL}/transaction/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return resp.data;
}

module.exports = { getOrRefreshToken, getProducts, createTransaction, getTransactionStatus };
