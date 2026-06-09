const ppob = require('./modules/ppob');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

(async () => {
  try {
    const tgId = 6619099194;
    console.log('📱 Step 1: Request OTP ke Telegram ID', tgId);
    console.log('   Cek @apphidepulsa_bot di Telegram untuk kode OTP\n');
    
    const { challengeToken } = await ppob.registerAndRequestOtp(tgId);
    console.log('✅ OTP dikirim!');
    
    const otp = await ask('📲 Masukkan 6 digit OTP dari @apphidepulsa_bot: ');
    
    console.log('\n🔄 Verifying OTP...');
    await ppob.verifyOtp(challengeToken, otp.trim());
    console.log('✅ Login berhasil! Token tersimpan.\n');
    
    // Cek token
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./sellvpn.db');
    db.get('SELECT * FROM ppob_tokens WHERE id = 1', [], (err, row) => {
      if (row) {
        console.log('📊 Token Info:');
        console.log('   Access expired:', new Date(row.access_expires_at).toLocaleString('id-ID'));
        console.log('   Refresh expired:', new Date(row.refresh_expires_at).toLocaleString('id-ID'));
      }
      db.close();
      rl.close();
      process.exit(0);
    });
  } catch (e) {
    console.error('❌ Error:', e.message);
    rl.close();
    process.exit(1);
  }
})();
