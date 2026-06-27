# Modul Printer Thermal (QZ Tray + ESC/POS)

Modul ini menambahkan kemampuan cetak struk langsung ke printer thermal fisik
(58mm/80mm), termasuk **cetak otomatis setiap ada pesanan baru masuk**.

## Yang perlu disiapkan dulu (sekali saja)

1. **Install QZ Tray** di laptop/PC yang dipakai admin untuk membuka Panel
   Admin: https://qz.io/download/
   QZ Tray adalah software perantara — browser tidak bisa langsung akses
   port USB/printer, jadi QZ Tray-lah yang menjembatani web app ini ke
   printer fisik lewat WebSocket lokal (`localhost`).
2. Jalankan QZ Tray (biasanya otomatis nyala di system tray/notification
   area setelah install). Harus tetap berjalan selama Panel Admin dipakai.
3. Pastikan printer thermal sudah terinstall driver-nya di OS (Windows/Mac/
   Linux) dan muncul di daftar printer biasa (Settings > Printers).

## Cara pakai di Panel Admin

1. Masuk ke **Panel Admin → Pengaturan Toko → Koneksi Printer Thermal**.
2. Klik **"Pindai Printer"** — ini akan menghubungkan ke QZ Tray dan
   menampilkan daftar printer yang terdeteksi.
3. Pilih printer thermal Anda dari dropdown.
4. Klik **"Tes Cetak Struk Contoh"** untuk memastikan format & koneksi benar.
5. Centang **"Cetak Otomatis Setiap Ada Pesanan Baru Masuk"** kalau mau
   auto-print aktif.
6. Klik **"Simpan Seluruh Pengaturan Toko"** di bagian bawah form.

## Tentang dialog izin QZ Tray (penting!)

Modul ini dikonfigurasi **tanpa sertifikat digital berbayar** dari QZ
Industries. Konsekuensinya: setiap kali browser pertama kali connect ke QZ
Tray dalam satu sesi, **QZ Tray akan menampilkan dialog "Allow/Block"** di
sisi aplikasinya sendiri (bukan di web). Admin perlu klik "Allow" sekali per
sesi (atau centang "remember this decision" kalau tersedia).

Ini wajar untuk toko kecil/menengah. Kalau ke depan Anda ingin auto-print
benar-benar tanpa dialog apa pun (misalnya berjalan di komputer kasir tanpa
pengawasan), QZ Industries menjual sertifikat signing — itu di luar lingkup
perubahan ini, tapi strukturnya (`security.setCertificatePromise` /
`setSignaturePromise` di `src/printer/qzTray.ts`) sudah disiapkan untuk
nantinya menerima sertifikat asli tanpa perlu menulis ulang kode.

## Cara kerja auto-print

- App sudah punya koneksi realtime ke Supabase (lewat
  `supabase.channel(...).on('postgres_changes', ...)`).
- Ditambahkan listener terpisah khusus event `INSERT` pada tabel `orders`.
- Begitu ada order baru, app mengambil rincian item dari `order_items`,
  menyusun struk dalam format ESC/POS (`src/printer/escpos.ts`), lalu
  mengirimkannya ke printer terpilih lewat QZ Tray.
- **Auto-print hanya berjalan kalau Panel Admin sedang terbuka** di
  perangkat yang menjalankan QZ Tray — ini bukan proses background yang
  berjalan walau browser ditutup.
- Untuk mencegah cetak ganda kalau event yang sama terkirim ulang oleh
  Supabase, setiap `order.id` yang sudah diproses ditandai di memori
  (direset setiap reload halaman).

## File yang ditambahkan/diubah

- `src/printer/escpos.ts` — builder perintah ESC/POS (bold, center, potong
  kertas, dll.) dari data Order + StoreSettings.
- `src/printer/qzTray.ts` — koneksi WebSocket ke QZ Tray, scan printer,
  kirim data biner mentah.
- `src/printer/qz-tray.d.ts` — deklarasi TypeScript untuk paket `qz-tray`
  (paket aslinya tidak menyediakan tipe).
- `src/types.ts` — tambah `printer_thermal_nama` & `printer_auto_print_aktif`
  ke `StoreSettings`.
- `src/App.tsx` — listener realtime `INSERT` khusus tabel `orders` +
  `autoPrintIncomingOrder()`.
- `src/components/AdminPanel.tsx` — UI pengaturan koneksi printer, tombol
  pindai/tes cetak, dan tombol cetak struk yang sudah ada kini memakai
  printer thermal asli (dengan fallback ke dialog print browser).
- `supabase_schema.sql` — kolom baru untuk database baru.
- `migration_printer_thermal.sql` — migration `ALTER TABLE` untuk database
  yang sudah berjalan (jalankan ini di Supabase SQL Editor kalau project
  Anda sudah punya data).

## Keterbatasan yang perlu diketahui

- Auto-print butuh Panel Admin **tetap terbuka** di device tersebut — ini
  sesuai dengan yang diminta ("admin harus buka app, tapi tidak perlu klik
  tombol print"), bukan proses background terus-menerus.
- Encoding teks pakai UTF-8 sederhana; kalau printer Anda memakai code page
  non-standar dan karakter tertentu (misalnya simbol Rupiah atau emoji)
  tercetak aneh, mungkin perlu penyesuaian encoding di `escpos.ts`.
- Belum ada retry otomatis kalau pengiriman ke printer gagal di tengah jalan
  (misalnya printer kehabisan kertas) — admin akan melihat toast error dan
  bisa cetak ulang manual lewat tombol "Cetak Struk POS" di riwayat pesanan.
