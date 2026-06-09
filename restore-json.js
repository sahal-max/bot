const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const JSON_FILE = 'retriVPN_backup_2026-06-09_13-00-00.json';
const DB_FILE = 'sellvpn.db';

console.log('🔄 Memulai restore dari JSON...\n');

// Baca JSON
const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
console.log('✅ JSON berhasil dibaca');

// Mapping nama tabel JSON ke SQLite
const TABLE_MAP = {
  'users': 'users',
  'accounts': 'accounts',
  'servers': 'Server',
  'transactions': 'transactions',
  'pending_deposits': 'pending_deposits',
  'server_iplimit_rules': 'server_iplimit_rules',
  'akrab_orders': 'akrab_orders',
  'akrab_preorders': 'akrab_preorders',
  'smm_orders': 'smm_orders',
  'markup_config': 'markup_config',
  'broadcast_polls': 'broadcast_polls',
  'broadcast_poll_votes': 'broadcast_poll_votes',
  'download_configs': 'download_configs',
  'ppob_tokens': 'ppob_tokens'
};

// Buka database
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('❌ Gagal buka database:', err.message);
    process.exit(1);
  }
  console.log('✅ Database SQLite terbuka\n');
});

// Fungsi untuk cek kolom yang ada di tabel
function getTableColumns(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.name));
    });
  });
}

// Fungsi untuk insert data
function insertTable(tableName, records) {
  return new Promise(async (resolve, reject) => {
    if (records.length === 0) {
      console.log(`  ⏭️  ${tableName}: kosong, skip`);
      return resolve(0);
    }

    try {
      const dbColumns = await getTableColumns(tableName);
      console.log(`  📋 Kolom SQLite: ${dbColumns.join(', ')}`);

      // Ambil kolom dari record pertama
      const jsonColumns = Object.keys(records[0]);
      
      // Cari kolom yang ada di kedua sisi
      const commonColumns = jsonColumns.filter(c => dbColumns.includes(c));
      const missingColumns = jsonColumns.filter(c => !dbColumns.includes(c));
      
      if (missingColumns.length > 0) {
        console.log(`  ⚠️  Kolom di JSON tapi tidak di SQLite: ${missingColumns.join(', ')}`);
      }

      const placeholders = commonColumns.map(() => '?').join(',');
      const columnList = commonColumns.join(',');
      const sql = `INSERT OR REPLACE INTO ${tableName} (${columnList}) VALUES (${placeholders})`;

      let inserted = 0;
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(sql);
        for (const record of records) {
          const values = commonColumns.map(c => {
            const val = record[c];
            if (val === null || val === undefined) return null;
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
          });
          stmt.run(values, function(err) {
            if (err) {
              console.error(`    ❌ Error insert: ${err.message}`);
            } else {
              inserted++;
            }
          });
        }
        stmt.finalize();
        
        db.run('COMMIT', (err) => {
          if (err) {
            console.error(`  ❌ Commit gagal: ${err.message}`);
            reject(err);
          } else {
            console.log(`  ✅ ${tableName}: ${inserted}/${records.length} records di-restore`);
            resolve(inserted);
          }
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Restore semua tabel
async function restoreAll() {
  let totalRestored = 0;
  
  for (const [jsonKey, sqliteTable] of Object.entries(TABLE_MAP)) {
    const records = data[jsonKey];
    if (!records) {
      console.log(`⏭️  ${jsonKey}: tidak ada di JSON`);
      continue;
    }
    
    console.log(`\n📦 Restore ${jsonKey} → ${sqliteTable} (${records.length} records)`);
    try {
      const count = await insertTable(sqliteTable, records);
      totalRestored += count;
    } catch (err) {
      console.error(`  ❌ Gagal restore ${jsonKey}:`, err.message);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ RESTORE SELESAI! Total: ${totalRestored} records`);
  console.log('='.repeat(50));
  
  // Verifikasi
  console.log('\n📊 Verifikasi hasil restore:');
  const verifyTables = ['users', 'accounts', 'Server', 'transactions'];
  for (const table of verifyTables) {
    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
      if (err) console.log(`  ❌ ${table}: ${err.message}`);
      else console.log(`  ✅ ${table}: ${row.count} records`);
    });
  }
  
  setTimeout(() => {
    db.close();
    console.log('\n✅ Database ditutup. Restore selesai!');
  }, 2000);
}

restoreAll();
