-- Storage policies untuk bucket "product-photos"
-- Jalankan di Supabase SQL Editor. Aman dijalankan walau bucket sudah ada.
--
-- Bucket "Public" hanya mengizinkan MEMBACA file lewat URL publik.
-- Untuk MENGUNGGAH (INSERT) lewat anon key (yang dipakai aplikasi ini),
-- perlu policy RLS terpisah pada tabel storage.objects.

-- 1. Izinkan SIAPA SAJA (termasuk anon key dari aplikasi) untuk MENGUNGGAH
--    file baru ke bucket product-photos.
CREATE POLICY "Allow public upload to product-photos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'product-photos');

-- 2. Izinkan SIAPA SAJA membaca/melihat file di bucket ini (selain lewat URL
--    publik bawaan bucket Public, ini juga mengizinkan listing/get via API).
CREATE POLICY "Allow public read product-photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-photos');

-- 3. (Opsional) Izinkan UPDATE — berguna kalau nanti ada fitur replace/timpa
--    file dengan nama yang sama (upsert).
CREATE POLICY "Allow public update product-photos"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'product-photos')
WITH CHECK (bucket_id = 'product-photos');

-- 4. (Opsional) Izinkan DELETE — berguna kalau nanti admin perlu menghapus
--    foto lama dari Storage (saat ini aplikasi belum punya fitur hapus foto
--    dari Storage, hanya mengganti URL di kolom database).
CREATE POLICY "Allow public delete product-photos"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'product-photos');
