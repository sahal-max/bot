const ppob = require('./modules/ppob');
ppob.getProdukList('Global').then(list => {
  console.log('Total produk Global:', list.length);
  const circle = list.filter(p => JSON.stringify(p).toUpperCase().includes('CIRCLE'));
  const akrab = list.filter(p => JSON.stringify(p).toUpperCase().includes('AKRAB'));
  console.log('CIRCLE found:', circle.length);
  console.log('AKRAB found:', akrab.length);
  if(circle.length) {
    console.log('\nSample CIRCLE:');
    console.log(JSON.stringify(circle[0], null, 2));
  }
  if(akrab.length) {
    console.log('\nSample AKRAB:');
    console.log(JSON.stringify(akrab[0], null, 2));
  }
  if(!circle.length && !akrab.length) {
    console.log('\nSample 3 produk pertama:');
    list.slice(0,3).forEach(p => console.log(JSON.stringify(p, null, 2)));
  }
}).catch(e => console.error('ERROR:', e.message));
