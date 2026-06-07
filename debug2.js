const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sellvpn.db');
const axios = require('axios');

db.get('SELECT access_token FROM ppob_tokens WHERE id=1', [], async (err, row) => {
  if (!row || !row.access_token) return console.log('No token');
  const token = row.access_token;
  try {
    const res = await axios.get('https://app.hidepulsa.com/produk-list', {
      params: { category: 'Global' },
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = res.data.data || [];
    console.log('Total produk Global:', data.length);
    const circle = data.filter(p => JSON.stringify(p).toUpperCase().includes('CIRCLE'));
    const akrab = data.filter(p => JSON.stringify(p).toUpperCase().includes('AKRAB'));
    console.log('CIRCLE total:', circle.length);
    console.log('AKRAB total:', akrab.length);
    if (circle.length) {
      console.log('\nSample CIRCLE[0]:');
      console.log(JSON.stringify(circle[0], null, 2));
    }
    if (akrab.length) {
      console.log('\nSample AKRAB[0]:');
      console.log(JSON.stringify(akrab[0], null, 2));
    }
    if (!circle.length && !akrab.length) {
      console.log('\nSample 3 produk:');
      data.slice(0,3).forEach(p => console.log(JSON.stringify(p, null, 2)));
    }
  } catch(e) {
    console.error('ERROR:', e.response ? JSON.stringify(e.response.data) : e.message);
  }
  db.close();
});
