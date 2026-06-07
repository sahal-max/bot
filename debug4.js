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
    console.log('=== SEMUA BRAND UNIK ===');
    const brands = [...new Set(data.map(p => p.brand))];
    brands.forEach(b => {
      const count = data.filter(p => p.brand === b).length;
      console.log(`"${b}" : ${count} produk`);
    });
  } catch(e) { console.error('ERROR:', e.message); }
  db.close();
});
