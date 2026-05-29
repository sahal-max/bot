# RETRI VPN

Bot Telegram multi-layanan untuk penjualan produk digital dalam satu antarmuka percakapan. Menggabungkan lima layanan utama dengan sistem dual wallet dan program reseller lintas layanan.

---

## Layanan

| Modul | Deskripsi | Provider |
|-------|-----------|----------|
| 🔑 Akun VPN | SSH/Ovpn, VMESS, VLESS, TROJAN, ZIVPN, UDP HTTP | AutoScript Potato (self-hosted) |
| 📱 PPOB | Pulsa, token listrik, tagihan, produk digital | HidePulsa |
| 🤝 Akrab & Circle | Produk Akrab / XL Circle | khfy-store |
| 💉 Suntik Followers | Layanan SMM: followers, likes, views | FayuPedia |
| 🏪 Join Reseller | Program reseller lintas layanan + markup harga | Internal |

---

## Dual Wallet

Dua wallet saldo berjalan independen — tidak bisa saling transfer:

- 💰 **Saldo VPN** — untuk Akun VPN + Suntik Followers. Top up via QRIS otomatis (OrderKuota/GoPay) atau manual.
- 💳 **Saldo Akrab** — untuk PPOB + Akrab & Circle. Top up via QRIS HidePulsa (verifikasi OTP Telegram).

---

## Fitur Utama

### User
- Buat / trial / perpanjang / hapus akun VPN semua protokol.
- Lihat akun saya (aktif / semua / expired) dan cek masa aktif.
- Beli produk PPOB, Akrab & Circle, dan layanan SMM.
- Top up dua wallet (otomatis QRIS, manual QRIS, bonus per range nominal).
- Riwayat dan cek status transaksi tiap layanan.
- Join reseller dengan kontak admin dinamis (WA/Telegram).

### Reseller
- Akses server reseller (harga lebih murah).
- Lock/unlock akun VPN.
- Markup harga independent per layanan: VPN, PPOB, Akrab, SMM.
- Cek semua saldo dan statistik transaksi bulanan.
- Evaluasi syarat reseller bulanan + notifikasi pengingat otomatis.

### Admin
- Dashboard: User, Server, Saldo, Reseller, Tools.
- 🔑 Setting API Keys via menu (FayuPedia, HidePulsa, Akrab) — update tanpa edit file manual.
- 📢 Markup Global Produk (SMM & Akrab).
- Manajemen server tunnel, saldo, reseller, broadcast.
- Setting payment gateway (OrderKuota / GoPay / fallback).
- Mode maintenance, backup/restore database.

---

## Webhook & Polling

- **Webhook HidePulsa** (`POST /webhook/hidepulsa`) — verifikasi HMAC SHA-256 (`X-Webhook-Signature: v1={hex}`, window 300 detik).
- **Webhook Akrab** (`GET/POST /webhook/akrab`) — parse format `RC={reffid} TrxID={id} {status} {keterangan}`.
- **Auto-polling Akrab** setiap 5 menit dan **SMM** setiap 3 menit untuk update status order pending.
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
3. API key FayuPedia, HidePulsa, Akrab diisi via menu Admin → 🔑 Setting API Keys
4. Payment Gateway & Server VPN diisi via menu Admin → Setting

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
