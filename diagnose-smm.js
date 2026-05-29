'use strict';
// Script diagnose koneksi SMM FayuPedia
// Jalankan di server: node diagnose-smm.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const varsPath = path.join(__dirname, '.vars.json');
let vars = {};
try {
  vars = JSON.parse(fs.readFileSync(varsPath, 'utf8'));
} catch (e) {
  console.error('❌ Gagal baca .vars.json:', e.message);
  process.exit(1);
}

const FAYU_ENDPOINT = String(vars.FAYU_ENDPOINT || 'https://fayupedia.id').trim();
const FAYU_API_ID = String(vars.FAYU_API_ID || '').trim();
const FAYU_API_KEY = String(vars.FAYU_API_KEY || '').trim();

console.log('═══════════════════════════════════════');
console.log('  DIAGNOSE SMM FAYUPEDIA');
console.log('═══════════════════════════════════════');
console.log('Endpoint   :', FAYU_ENDPOINT);
console.log('API ID     :', FAYU_API_ID || '(KOSONG!)');
console.log('API Key    :', FAYU_API_KEY ? FAYU_API_KEY.substring(0, 12) + '***' : '(KOSONG!)');
console.log('Panjang ID :', FAYU_API_ID.length);
console.log('Panjang Key:', FAYU_API_KEY.length);
console.log('═══════════════════════════════════════');

if (!FAYU_API_ID || !FAYU_API_KEY) {
  console.log('\n❌ Credential masih kosong di .vars.json!');
  console.log('   Jalankan dari menu admin bot lagi, atau edit manual .vars.json');
  process.exit(1);
}

(async () => {
  console.log('\n▶ Test 1: GET /api/services');
  try {
    const resp = await axios.get(FAYU_ENDPOINT + '/api/services', {
      params: { api_id: FAYU_API_ID, api_key: FAYU_API_KEY },
      timeout: 30000,
    });
    console.log('   Status HTTP:', resp.status);
    const data = resp.data;
    if (data && Array.isArray(data.data)) {
      console.log('   ✅ SUKSES! Total layanan:', data.data.length);
      console.log('   Sample layanan pertama:', JSON.stringify(data.data[0]).substring(0, 200));
    } else if (Array.isArray(data)) {
      console.log('   ✅ SUKSES (format array). Total:', data.length);
    } else {
      console.log('   ⚠️ Response format tak dikenal:');
      console.log('   ', JSON.stringify(data).substring(0, 500));
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message);
    if (err.response) {
      console.log('   HTTP Status:', err.response.status);
      console.log('   Response   :', JSON.stringify(err.response.data).substring(0, 500));
    }
  }

  console.log('\n▶ Test 2: GET /api/balance');
  try {
    const resp = await axios.get(FAYU_ENDPOINT + '/api/balance', {
      params: { api_id: FAYU_API_ID, api_key: FAYU_API_KEY },
      timeout: 30000,
    });
    console.log('   Status HTTP:', resp.status);
    console.log('   Response   :', JSON.stringify(resp.data).substring(0, 300));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
    if (err.response) {
      console.log('   HTTP Status:', err.response.status);
      console.log('   Response   :', JSON.stringify(err.response.data).substring(0, 500));
    }
  }

  console.log('\n═══════════════════════════════════════');
})();
