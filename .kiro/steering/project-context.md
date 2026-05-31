---
inclusion: always
---

# BotVPN — Konteks Proyek

Bot Telegram multi-layanan (Node.js + Telegraf + SQLite + Express) untuk jualan
Akun VPN, Akrab (kuota data), dan SMM (suntik followers). Bahasa: Indonesia.

## Aturan Komunikasi
- Balas dalam Bahasa Indonesia.
- Setelah perubahan kode, jalankan `node --check app.js` lalu commit + push ke GitHub (branch `main`).
- Remote GitHub mengandung token di URL — JANGAN echo/print isi token.
- File `.vars.json` berisi semua secret/API key dan TIDAK ada di repo lokal (hanya di server).

## Arsitektur
- `app.js` — file utama (~20rb baris): semua command, callback handler, middleware, scheduler, webhook Express.
- `modules/`:
  - `create.js`, `trial.js`, `renew.js`, `del.js`, `lock.js`, `unlock.js` — operasi akun VPN via curl ke AutoScript Potato VPS.
  - `createzivpn.js`, `trialzivpn.js` — khusus ZIVPN.
  - `wallet.js` — logika saldo + `getEffectivePrice()` (markup).
  - `db_helpers.js` — abstraksi SQLite (Promise), markup, order helpers.
  - `akrab.js` — client khfy-store (Akrab V1/V2). `smm.js` — FayuPedia. (modul `ppob.js` SUDAH DIHAPUS).
  - `reseller.js` — daftar reseller via file teks `ressel.db`.
  - `utils.js` — helper umum.

## Database & File Config
- `sellvpn.db` (SQLite): users, Server, accounts, transactions, markup_config, akrab_orders, smm_orders, server_iplimit_rules, pending_deposits.
- `ressel.db` — daftar Telegram ID reseller (plain text, 1 ID per baris).
- `trial.db` — tracking trial harian (JSON).
- File JSON config (runtime, bisa diubah tanpa restart): `.vars.json`, `reseller_terms.json`,
  `topup_bonus.json`, `topup_manual.json`, `topup_auto.json`, `maintenance_mode.json`,
  `join_channel.json`, `blacklist.json`, `sc_nexus_menu.json`, `test_menu.json`.

## Dua Wallet Terpisah
- `saldo` (VPN) → untuk Akun VPN + SMM.
- `saldo_akrab` (Tembak Kuota) → untuk Akrab.
- Tidak boleh dicampur.

## Markup (PENTING — sudah final)
- DIPISAH, TIDAK ditumpuk. Lihat `wallet.getEffectivePrice(base, markupGlobal, markupReseller)`:
  - Reseller punya markup sendiri → pakai markup reseller SAJA.
  - Member biasa → pakai markup global SAJA.
- Base price Akrab = field `harga` (harga modal), fallback `price` lalu `harga_final`.

## Akrab (khfy-store) — Catatan Penting
- `getProducts()` = `/api_v2/list_product` → produk yang DIJUAL (punya harga).
- `cekStokAkrab()` = `/api_v3/cek_stock_akrab` (XLA/V1).
- `cekStokAkrabV2()` = `/api_v3/cek_stock_akrab_v2` (XDA/V2), format string "XDA76 | 70 unit".
- Helper bersama `fetchAkrabStokMap()` dipakai di menu Akrab V1/V2, Cek Stok, dan Pre-Order agar SINKRON.
- **Cek Stok** menampilkan SEMUA produk dari slot map API (data asli provider, bisa >produk yang dijual).
- **Menu Beli** hanya produk dari `list_product` (yang punya harga & bisa ditransaksikan).
- Grup: `getAkrabGroup()` — v1=XLA, v2=XDA (cek kode_produk, kode_provider, nama).
- Produk virtual/estimasi sudah DIHAPUS (dulu bikin nama aneh & stok tidak sinkron).
- `KHFY_API_KEY` diset via Menu Admin → Setting API Keys → Akrab. Kalau kosong, produk kosong `[]`.

## Middleware (urutan di app.js, sebelum semua handler)
1. Maintenance — blokir non-admin saat `maintenance_mode.json.enabled`.
2. Blacklist — blokir user di `blacklist.json`.
3. Wajib Join Channel — kalau `join_channel.json.enabled`, cek `getChatMember`. Bot harus admin channel.
- Admin selalu lolos ketiganya. Helper terpusat: `isAdminId(userId)` (robust untuk format USER_ID array/string/number).

## Command Admin Penting
- `/admin` menu admin. `/summary` dashboard harian. `/exportusers` CSV.
- `/blacklist <id>`, `/unblacklist <id>`, `/listblacklist`.
- `/helpadmin` daftar lengkap. `/debugakrab [xla|xda]`, `/debugakrabraw`, `/debugcekstok` untuk diagnosa Akrab.
- `/addsaldo`, `/hapussaldo`, `/addserver*`, `/editharga`, `/syncservernow`, `/setserverbw`, dll.

## Scheduler (node-schedule, WIB)
- Backup saldo harian 02:00 (JSON ke admin, terpisah dari backup DB).
- Notif expired akun H-3 jam 09:00.
- Evaluasi reseller bulanan, sync server tiap 10 menit, laporan bandwidth, cek restok Akrab tiap 10 menit.

## Payment Gateway
- Mode: orderkuota / gopay / both (`PAYMENT_GATEWAY_MODE`).
- OrderKuota: QRIS via RajaServer + cek mutasi manual (tombol "Sudah Bayar, Cek Status").
- GoPay: cek status otomatis tiap 10 detik.
- Top up VPN bisa dapat bonus (`topup_bonus.json`); top up Akrab tidak dapat bonus.

## Fitur yang SUDAH dihapus / diubah (jangan tambahkan lagi)
- PPOB (HidePulsa) dan Circle — DIHAPUS total.
- Animasi 🔥 saat /start — DIHAPUS.
- Tombol "Akun Saya" di menu utama — DIHAPUS (sudah ada di menu VPN).
- Info akun aktif + exp terdekat ada di MENU VPN (di bawah saldo), bukan di menu utama.

## Riwayat Perubahan Besar
- Hapus PPOB & Circle.
- Tambah wajib join channel, blacklist, dashboard /summary, export users, riwayat transaksi & Akrab.
- Konfirmasi sebelum beli akun VPN (preview harga + tombol Ya/Batal).
- Pesan sambutan user baru saat pertama /start.
- Emoji di semua menu admin.
