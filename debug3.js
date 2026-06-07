const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');
const axios = require('axios');

db.get('SELECT access_token FROM ppob_tokens WHERE id=1', [], async (err, row) => {
  if (!row) return console.log('No token');
  const token = row.access_token;
  try {
    const res = await axios.get('https://app.hidepulsa.com/produk-list', {
      params: { category: 'Global' },
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = res.data.data || [];
    const akrab = data.filter(p => (p.brand||'').toUpperCase().includes('AKRAB'));
    console.log('Total AKRAB:', akrab.length);
    akrab.forEach(p => {
      console.log({
        sku: p.buyer_sku_code,
        stock: p.stock,
        unlimited_stock: p.unlimited_stock,
        seller: p.seller_product_status,
        buyer: p.buyer_product_status,
        stock_label: p.stock_label
      });
    });
  } catch(e) { console.error('ERROR:', e.message); }
  db.close();
});
