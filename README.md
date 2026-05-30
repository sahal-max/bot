# RETRI VPN

Bot Telegram multi-layanan untuk penjualan produk digital dalam satu antarmuka percakapan. Menggabungkan layanan VPN, Akrab & Circle, dan SMM dengan sistem dual wallet dan program reseller lintas layanan.

---

## Layanan

| Modul | Deskripsi | Provider |
|-------|-----------|----------|
| 🔑 Akun VPN | SSH/Ovpn, VMESS, VLESS, TROJAN, ZIVPN, UDP HTTP | AutoScript Potato (self-hosted) |
| 🤝 Akrab & Circle | Produk Akrab V1 (XLA), V2 (XDA), Circle (XCLP) | khfy-store |
| 💉 Suntik Followers | Layanan SMM: followers, likes, views | FayuPedia |
| 🏪 Join Reseller | Program reseller lintas layanan + markup harga | Internal |

---

## Dual Wallet

Dua wallet saldo berjalan independen — tidak bisa saling transfer:

- 💰 **Saldo VPN** — untuk Akun VPN + Suntik Followers. Top up via QRIS otomatis (OrderKuota/GoPay) atau manual.
- 💳 **Saldo Tembak Kuota** — untuk Akrab & Circle. Top up via QRIS.

---

## Fitur Utama

### User
- Buat / trial / perpanjang / hapus akun VPN semua protokol.
- Lihat akun saya (aktif / semua / expired) dan cek masa aktif.
- Beli produk Akrab & Circle dan layanan SMM.
- **Cek stok real-time** Akrab (XLA / XDA / Circle) dengan jumlah unit.
- **Pre-Order otomatis** — daftar produk Akrab, bot auto-beli saat stok tersedia kembali. Saldo dikembalikan penuh jika gagal.
- **Test Transaksi (Dry Run)** — cek koneksi API tanpa potong saldo (bisa diaktifkan/nonaktifkan admin).
- Top up dua wallet (otomatis QRIS, manual QRIS, bonus per range nominal).
- Riwayat dan cek status transaksi tiap layanan.
- Join reseller dengan kontak admin dinamis (WA/Telegram).
- Welcome animation 🔥 saat `/start`.

### Reseller
- Akses server reseller (harga lebih murah).
- Lock/unlock akun VPN.
- Markup harga independen per layanan: VPN, Akrab, SMM.
- **Markup tidak bertumpuk** — reseller pakai markup sendiri, member biasa pakai markup global admin.
- Cek semua saldo dan statistik transaksi bulanan.

### Admin
- Dashboard: User, Server, Saldo, Reseller, Tools.
- 🔑 Setting API Keys via menu (FayuPedia, Akrab) — update tanpa edit file manual.
- 📢 Markup Global Produk (SMM & Akrab) khusus member biasa.
- 💾 **Backup & Restore Saldo** member + reseller ke file JSON.
- 📋 Lihat antrian Pre-Order aktif (XLA & XDA).
- 🧪 Toggle menu Test Transaksi on/off.
- Manajemen server tunnel, saldo, reseller, broadcast.
- Setting payment gateway (OrderKuota / GoPay / fallback).
- Mode maintenance, backup/restore database.

---

## Pre-Order & Auto-Beli Akrab

- User daftar pre-order produk XLA/XDA spesifik + nomor tujuan.
- Bot cek stok setiap **10 menit**.
- Saat produk yang dari **0 → ada stok**, bot otomatis:
  1. Proses beli untuk semua user yang antri produk itu.
  2. Potong saldo, kirim notif sukses + Reff ID.
  3. Jika gagal (error API) → **saldo dikembalikan penuh**.
  4. Jika saldo kurang → notif, pre-order dihapus.
- Setelah auto-beli, broadcast notif restok ke user lain yang antri.

---

## Logika Stok Akrab

Stok ditampilkan untuk 3 kategori: **XLA** (V1), **XDA** (V2), **Circle** (XCLP).

- Sumber daftar produk: `getProducts()` (`/api_v2/list_product`).
- Jumlah unit (slot) di-enrich dari endpoint stok:
  - XLA → `/api_v3/cek_stock_akrab`
  - XDA → `/api_v3/cek_stock_akrab_v2`
- Ketersediaan: prioritas slot dari endpoint, fallback field `kosong`/`status`.
- Field `gangguan` **tidak dipakai** (tidak reliable, false positive).
- Ikon: ✅ tersedia · ❌ kosong.

---

## Webhook & Polling

- **Webhook Akrab** (`GET/POST /webhook/akrab`) — parse format `RC={reffid} TrxID={id} {status} {keterangan}`.
- **Auto-polling Akrab** setiap 5 menit dan **SMM** setiap 3 menit untuk update status order pending.
- **Auto-cek restok Akrab** setiap 10 menit untuk pre-order.
- **Health check** (`GET /health`) untuk monitoring uptime.

---

## Instalasi

Rekomendasi OS: Ubuntu 24 LTS / Debian 12

```bash
sysctl -w net.ipv6.conf.all.disable_ipv6=1 && sysctl -w net.ipv6.conf.default.disable_ipv6=1 && apt update -y && apt install -y git curl && curl -L -k -sS https://raw.githubusercontent.com/sahal-max/bot/main/start -o start && bash start sellvpn && [ $? -eq 0 ] && rm -f start
```

### Setup
1. Salin `.vars.template.json` → `.vars.json`
2. Isi `BOT_TOKEN` dan `USER_ID` (admin Telegram)
3. API key FayuPedia dan Akrab diisi via menu Admin → 🔑 Setting API Keys
4. Payment Gateway & Server VPN diisi via menu Admin → Setting

---

## Update

Tarik versi terbaru tanpa menghapus `.vars.json` dan database (otomatis di-backup ke `/tmp`):

```bash
curl -L -k -sS https://raw.githubusercontent.com/sahal-max/bot/main/update -o update && bash update && rm -f update
```

Script update akan:
- Backup `.vars.json`, `*.db`, dan file config JSON ke `/tmp`
- `git reset --hard origin/main` lalu pull kode terbaru
- Mengembalikan konfigurasi & database
- Update dependency lalu restart bot via PM2

> Catatan: jika menu masih versi lama setelah update, pastikan bot berjalan di folder `/root/BotVPN`, cek `pm2 logs sellvpn`, lalu kirim `/start` baru di Telegram (bot pakai edit pesan, bukan kirim baru).

---

## Tampilan Menu

- Dashboard pakai box header `┏━━┓` dengan judul bertanda ✨, data monospace bergaya tree (`├ └`).
- Menu layanan pakai box `┌─┐│└─┘` dengan saldo dan keterangan ikon.
- Stok Akrab compact 2 produk per baris dengan jumlah unit.
- Keyboard 2 kolom, nama tombol singkat.

---

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Bot Framework | Node.js + Telegraf v4 |
| Database | SQLite3 (`sellvpn.db` + `ressel.db`) |
| HTTP Client | axios |
| Web Server | Express.js (webhook endpoint) |
| Process Manager | PM2 |
| Reverse Proxy | Nginx + SSL (Let's Encrypt) |

---

## Struktur Modul

```
app.js                  — entry point utama, semua handler bot
modules/
├── create.js           — buat akun VPN (SSH, VMess, VLESS, Trojan, Shadowsocks, UDP HTTP)
├── createzivpn.js      — buat akun ZIVPN
├── trial.js            — trial akun VPN
├── trialzivpn.js       — trial ZIVPN
├── renew.js            — perpanjang akun VPN
├── del.js              — hapus akun VPN
├── lock.js / unlock.js — kunci/buka akun VPN (reseller)
├── wallet.js           — manajemen saldo + getEffectivePrice (markup tidak numpuk)
├── akrab.js            — layanan Akrab/Circle via khfy-store
├── smm.js              — layanan SMM via FayuPedia
├── reseller.js         — manajemen daftar reseller
├── db_helpers.js       — helper DB: saldo, markup, order history
└── utils.js            — shared utils (normalizeApiBase, normalizeAuthToken, dll)
```

---

## Sinkronisasi Server Tunnel (AutoScript Potato)

API tunnel dipakai bot untuk sinkron total akun aktif, lookup masa aktif, dan ambil trafik bandwidth harian dari vnstat.

Trigger sinkron:
- Manual: `/syncservernow` atau tombol admin Sync Server Sekarang.
- Otomatis: setiap 30 menit.

Endpoint:
- `GET /internal/account-summary`
- `GET /internal/account-expiry?username=<USERNAME>`
- `GET /internal/expiry-summary?date=<YYYY-MM-DD>`
- `GET /internal/vnstat-daily`

Auth: header `x-sync-token: <TOKEN>`

Repo installer API tunnel: https://github.com/harismy/apiCekTotalUserPotato

---

## Command Admin

| Command | Fungsi |
|---------|--------|
| `/admin` | Buka menu admin |
| `/syncservernow` | Sinkron semua server tunnel |
| `/checkpaymentconfig` | Cek status payment gateway |
| `/setserverbw <id> <limit_tb> [avg_gb]` | Set limit bandwidth server |
| `/broadcast <pesan>` | Broadcast ke semua user |
| `/resellerstats` / `/allresellerstats` | Statistik reseller |
| `/helpadmin` | Daftar command admin |

---

## Catatan
Simpan file dengan encoding UTF-8 agar teks dan simbol tampil normal.
