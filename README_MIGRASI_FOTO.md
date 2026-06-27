# Migrasi Foto: Base64 Database → Supabase Storage

Ini mengatasi penyebab utama loading lambat: 62 foto produk (dan kemungkinan
beberapa banner/QRIS) tersimpan sebagai teks base64 langsung di kolom
database, membuat setiap `select('*')` menarik puluhan MB data tiap kali.

## Langkah 1 — Buat bucket Storage (manual, sekali saja)

1. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → pilih
   project ASYIFA MART.
2. Menu **Storage** (sidebar kiri) → **New bucket**.
3. Nama: `product-photos`
4. **Centang "Public bucket"** — wajib, supaya foto bisa diakses langsung
   lewat URL tanpa token/login (sama seperti foto Unsplash yang sudah ada).
5. **Create bucket**.

## Langkah 2 — Jalankan skrip migrasi foto lama (sekali saja)

File: `migrate-photos-to-storage.mjs`

```bash
node migrate-photos-to-storage.mjs
```

Syarat: Node.js 18 atau lebih baru, dijalankan dari folder project (perlu
`node_modules/@supabase/supabase-js` sudah terinstall — kalau belum,
`npm install` dulu).

Skrip ini akan:
1. Memindai tabel `products`, `banners`, dan `store_settings` mencari nilai
   kolom yang masih berupa base64 (`data:image/...`).
2. Mengunggah tiap foto base64 ke bucket `product-photos`.
3. Mengganti nilai kolom (`foto`, `gambar`, `payment_qris_image`) jadi URL
   publik hasil upload.

Aman dijalankan berulang kali — foto yang sudah berupa URL akan otomatis
dilewati (tidak diupload ulang).

**Sebelum menjalankan di data produksi**, sangat disarankan backup dulu lewat
fitur **Export Backup JSON** yang sudah ada di Admin Panel, supaya ada
cadangan kalau perlu rollback.

## Langkah 3 — Sudah otomatis: upload foto baru ke Storage

`handleImageUpload` di `AdminPanel.tsx` sudah diubah — sekarang setiap kali
admin upload foto baru (produk, banner, atau QRIS), file langsung diunggah ke
bucket `product-photos` dan yang disimpan ke database adalah URL publiknya,
bukan base64 lagi. Tidak ada langkah tambahan yang perlu dilakukan untuk ini,
selama bucket di Langkah 1 sudah dibuat.

Pengecualian: dalam **mode Emulasi Offline**, upload tetap memakai base64
lokal (karena memang tidak ada koneksi ke Supabase Storage saat offline).

## Dampak yang diharapkan

- Payload `select('*')` pada tabel `products` turun drastis (dari puluhan MB
  jadi puluhan KB untuk 158 produk), karena kolom `foto` sekarang isinya
  cuma teks URL pendek, bukan data gambar penuh.
- Foto bisa di-cache oleh browser (base64 tidak bisa di-cache seperti file
  biasa), jadi loading kedua kali dst. jauh lebih cepat.
- Bersama perubahan `silentSync()` paralel yang sudah dikerjakan sebelumnya,
  total waktu loading aplikasi seharusnya jauh lebih cepat.

## Jika migrasi gagal dengan error permission/RLS

Kalau skrip atau upload baru gagal dengan pesan terkait izin (permission
denied / row-level security), kemungkinan bucket Storage punya policy yang
membatasi upload dari anon key. Buka **Storage → product-photos → Policies**
di Dashboard Supabase, dan tambahkan policy yang mengizinkan `INSERT` untuk
role `anon` pada bucket ini (atau policy publik penuh kalau toko ini tidak
mengharuskan otentikasi ketat untuk upload admin).
