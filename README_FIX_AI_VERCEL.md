# Fix: Fitur AI di Admin Panel Tidak Berfungsi di Vercel

## Akar masalah

Endpoint `/api/gemini` sebelumnya hanya didefinisikan sebagai route Express di
dalam `server.ts`. Itu cocok untuk Google AI Studio / hosting Node.js biasa
(Cloud Run, Railway, dll.), tapi **Vercel tidak menjalankan server Express
custom seperti itu secara default** — Vercel adalah platform serverless yang
mengenali endpoint dari file-file di dalam folder `/api/`, bukan dari route
yang didefinisikan di dalam sebuah server yang berjalan terus-menerus.

Akibatnya, setiap kali AdminPanel memanggil `fetch('/api/gemini', ...)` di
Vercel, request itu tidak menemukan endpoint yang valid — yang membuat
tombol AI Insights / generate deskripsi / generate emoji macet (loading
terus) tanpa pesan error yang jelas.

## Yang sudah diperbaiki

Dibuat file baru: **`api/gemini.ts`**

Vercel otomatis mengenali setiap file di folder `api/` sebagai serverless
function — file ini akan otomatis menjadi endpoint `/api/gemini`, persis
URL yang sudah dipanggil dari `AdminPanel.tsx` (tidak perlu ubah kode
frontend sama sekali). Logic di dalamnya (memanggil Gemini API, retry
otomatis kalau model sedang sibuk, fallback ke model lain) sama persis
dengan yang ada di `server.ts` sebelumnya — cuma formatnya disesuaikan ke
gaya handler Vercel (`Request` / `Response` Web API standar).

`server.ts` **tidak dihapus** — tetap dipakai untuk development lokal
(`npm run dev`), di mana Express berjalan normal sebagai server biasa.

## Langkah WAJIB yang perlu Anda lakukan: set environment variable di Vercel

Ini terpisah dari masalah routing di atas, dan **harus** dilakukan supaya
fitur AI benar-benar berfungsi:

1. Buka **Vercel Dashboard** -> pilih project ASYIFA MART.
2. **Settings** -> **Environment Variables**.
3. Tambahkan:
   - Key: `GEMINI_API_KEY`
   - Value: API key Gemini Anda (dari aistudio.google.com/apikey kalau belum punya)
   - Environment: pilih **Production** (dan **Preview**/**Development** kalau perlu juga)
4. **Save**.
5. **Redeploy** project (Vercel biasanya perlu redeploy baru supaya environment variable baru terbaca -- push commit baru, atau klik "Redeploy" di Dashboard).

Tanpa langkah ini, `api/gemini.ts` akan tetap mengembalikan error
"GEMINI_API_KEY belum dikonfigurasi..." -- tapi setidaknya errornya akan
jelas ditampilkan sebagai toast di Admin Panel, bukan loading tanpa
penjelasan seperti sebelumnya.

## Cara memastikan sudah benar setelah deploy

1. Buka Admin Panel -> coba klik **AI Insights** (atau generate deskripsi
   produk).
2. Kalau berhasil: muncul hasil analisis/teks dari AI.
3. Kalau `GEMINI_API_KEY` belum diset: muncul toast error yang menyebutkan
   API key belum dikonfigurasi -- itu tanda routing-nya sudah benar, cuma
   tinggal isi API key di Vercel.
4. Kalau masih loading tanpa respons sama sekali: cek tab **Network** di
   DevTools (F12), cari request ke `/api/gemini`, lihat status code-nya
   (harus 200 atau error JSON, bukan 404).
