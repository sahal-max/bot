<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=28&pause=1000&color=00D9FF&center=true&vCenter=true&width=600&lines=RETRI+VPN;Bot+Telegram+Multi-Layanan;VPN+%E2%80%A2+Akrab+%26+Circle+%E2%80%A2+SMM" alt="Typing SVG" />

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)
![Telegraf](https://img.shields.io/badge/Telegraf-v4-2CA5E0?logo=telegram&logoColor=white)
![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?logo=sqlite&logoColor=white)
![PM2](https://img.shields.io/badge/Process-PM2-2B037A?logo=pm2&logoColor=white)
![License](https://img.shields.io/badge/License-Private-lightgrey)

Bot Telegram multi-layanan untuk jualan produk digital dalam satu antarmuka percakapan.
Menggabungkan **VPN**, **Akrab & Circle**, dan **SMM** dengan dual wallet & sistem reseller.

</div>

---

## ✨ Layanan

| Modul | Deskripsi |
|-------|-----------|
| 🔑 Akun VPN | SSH/Ovpn, VMESS, VLESS, TROJAN, ZIVPN, UDP HTTP |
| 🤝 Akrab & Circle | Akrab V1 (XLA), V2 (XDA), Circle (XCLP) |
| 💉 Suntik Followers | Followers, likes, views via FayuPedia |
| 🏪 Join Reseller | Program reseller lintas layanan + markup harga sendiri |

**Dual Wallet** — Saldo VPN (VPN + SMM) dan Saldo Tembak Kuota (Akrab & Circle) berjalan independen, top up via QRIS otomatis atau manual.

---

## 🚀 Instalasi

Rekomendasi OS: Ubuntu 24 LTS / Debian 12

```bash
sysctl -w net.ipv6.conf.all.disable_ipv6=1 && sysctl -w net.ipv6.conf.default.disable_ipv6=1 && apt update -y && apt install -y git curl && curl -L -k -sS https://raw.githubusercontent.com/sahal-max/bot/main/start -o start && bash start sellvpn && [ $? -eq 0 ] && rm -f start
```

**Setup awal:**
1. Salin `.vars.template.json` → `.vars.json`, isi `BOT_TOKEN` & `USER_ID` admin.
2. API key FayuPedia & Akrab diisi lewat menu Admin → 🔑 Setting API Keys.
3. Payment Gateway & Server VPN diisi lewat menu Admin → Setting.

---

## 🔄 Update

Tarik versi terbaru **tanpa** menghapus `.vars.json`, database, atau file backup lama — semuanya otomatis dibackup & dibersihkan:

```bash
curl -fsSL https://raw.githubusercontent.com/sahal-max/bot/main/update -o update && chmod +x update && ./update && rm -f update
```

Script ini otomatis:
- Backup `.vars.json`, `*.db`, dan config JSON ke `/tmp`
- `git reset --hard origin/main` tarik kode terbaru
- Kembalikan konfigurasi & database
- 🧹 **Bersihkan file sampah** (`*.bak`, `*.corrupt`, dll) — tidak perlu hapus manual lagi
- Update dependency & restart bot via PM2

> 💡 Kalau menu masih versi lama setelah update: pastikan bot jalan di `/root/BotVPN`, cek `pm2 logs sellvpn`, lalu kirim `/start` baru di Telegram (bot pakai edit pesan, bukan kirim baru).

---

## 🛠️ Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Bot Framework | Node.js + Telegraf v4 |
| Database | SQLite3 (`sellvpn.db` + `ressel.db`) |
| HTTP Client | axios |
| Web Server | Express.js (webhook) |
| Process Manager | PM2 |
| Reverse Proxy | Nginx + SSL |

---

## 📁 Struktur Modul

```
app.js                  — entry point utama, semua handler bot
modules/
├── create.js           — buat akun VPN (SSH, VMess, VLESS, Trojan, UDP HTTP)
├── createzivpn.js       — buat akun ZIVPN
├── trial.js / trialzivpn.js — trial akun
├── renew.js / del.js    — perpanjang / hapus akun
├── lock.js / unlock.js  — kunci/buka akun (reseller)
├── wallet.js            — saldo + markup logic
├── akrab.js             — Akrab/Circle via khfy-store
├── smm.js                — SMM via FayuPedia
├── reseller.js           — manajemen reseller
├── db_helpers.js          — helper DB
└── utils.js               — shared utils
```

---

## ⚙️ Command Admin

| Command | Fungsi |
|---------|--------|
| `/admin` | Buka menu admin |
| `/syncservernow` | Sinkron semua server tunnel |
| `/checkpaymentconfig` | Cek status payment gateway |
| `/broadcast <pesan>` | Broadcast ke semua user |
| `/allresellerstats` | Statistik reseller |
| `/helpadmin` | Daftar command admin lengkap |

---

<div align="center">
<sub>Simpan semua file dengan encoding UTF-8 agar teks & simbol tampil normal.</sub>
</div>
