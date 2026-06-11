#!/bin/bash
# ============================================================
#  cleanup.sh — Hapus file tidak berguna di BotVPN
#  Jalankan dari: /root/BotVPN
#  Usage: bash cleanup.sh
# ============================================================

BOT_DIR="/root/BotVPN"
cd "$BOT_DIR" || { echo "❌ Direktori $BOT_DIR tidak ditemukan!"; exit 1; }

echo "============================================"
echo "  Retri VPN — Cleanup Script"
echo "  Dir: $BOT_DIR"
echo "============================================"
echo ""

# Hitung space sebelum
BEFORE=$(du -sh . 2>/dev/null | cut -f1)
echo "📦 Space sebelum cleanup: $BEFORE"
echo ""

# ── 1. Backup app.js duplikat (hash identik) ─────────────────
echo "🗑️  [1/4] Hapus backup app.js duplikat..."
DUPS=(
  "app.js.bak_surgical"
  "app.js.bak_ultra"
  "app.js.bak_before_rm"
  "app.js.bak_final2"
  "app.js.bak_smart_rm"
  "app.js.backup_before_remove"
  "app.js.backup_v3_circle"
  "app.js.bak_20260610_001342"
)
for f in "${DUPS[@]}"; do
  if [ -f "$f" ]; then
    rm "$f" && echo "   ✅ Hapus: $f"
  else
    echo "   ⚠️  Skip (tidak ada): $f"
  fi
done

# ── 2. Backup app.js lama (semua versi lama, sudah ada yg lengkap) ──
echo ""
echo "🗑️  [2/4] Hapus backup app.js versi lama..."
OLD_BAKS=(
  "app.js.bak_20260609_231611"
  "app.js.bak_20260609_233443"
  "app.js.bak_20260609_235937"
  "app.js.bak_20260610_063753"
  "app.js.bak_20260610_064435"
  "app.js.bak_20260610_065902"
  "app.js.bak.xda"
  "app.js.bak_allreseller"
  "app.js.bak_before_3fix"
  "app.js.bak_before_rewrite"
  "app.js.bak_bugfix"
  "app.js.bak_debug"
  "app.js.bak_finalfix"
  "app.js.bak_htmlfix"
  "app.js.bak_safe"
  "app.js.bak_toolong"
  "app.js.bak_truncated_20260611_134443"
)
for f in "${OLD_BAKS[@]}"; do
  if [ -f "$f" ]; then
    rm "$f" && echo "   ✅ Hapus: $f"
  else
    echo "   ⚠️  Skip (tidak ada): $f"
  fi
done
# Hapus semua bak_truncated dengan wildcard (tanggal bisa beda)
for f in app.js.bak_truncated_*; do
  [ -f "$f" ] && rm "$f" && echo "   ✅ Hapus: $f"
done

# ── 3. Folder DB corrupt (duplikat isinya sama) ──────────────
echo ""
echo "🗑️  [3/4] Hapus folder DB corrupt duplikat..."
if [ -d "db_corrupt_backup_20260611_201500" ]; then
  rm -rf db_corrupt_backup_20260611_201500 && echo "   ✅ Hapus folder: db_corrupt_backup_20260611_201500"
else
  echo "   ⚠️  Skip (tidak ada): db_corrupt_backup_20260611_201500"
fi
# Simpan db_recovery (satu saja sudah cukup)

# ── 4. File kecil tidak berguna ───────────────────────────────
echo ""
echo "🗑️  [4/4] Hapus file kecil tidak berguna..."
MISC=(
  "database.sqlite"
  "ressel.db.corrupt_20260609_233423"
  "modules/ppob.js.backup_v3_circle"
  "ecosystem.config.js.fixed"
  "package.json.bak_20260609_233443"
)
for f in "${MISC[@]}"; do
  if [ -f "$f" ]; then
    rm "$f" && echo "   ✅ Hapus: $f"
  else
    echo "   ⚠️  Skip (tidak ada): $f"
  fi
done

# ── Hasil akhir ───────────────────────────────────────────────
echo ""
AFTER=$(du -sh . 2>/dev/null | cut -f1)
echo "============================================"
echo "✅ Cleanup selesai!"
echo "   Sebelum : $BEFORE"
echo "   Sesudah : $AFTER"
echo ""
echo "📁 File yang TETAP disimpan:"
echo "   app.js                    ← aktif (sudah di-fix)"
echo "   ecosystem.config.js       ← konfigurasi PM2"
echo "   db_recovery_*/            ← backup DB corrupt (1 folder)"
echo "   ressel.db.bak_sqlite_corrupt ← backup DB ressel"
echo "   modules/ppob.js           ← aktif"
echo "============================================"
