-- =========================================================================
-- FITUR KOIN & PENUKARAN HADIAH (Loyalty Program)
-- =========================================================================
-- Jalankan di Supabase SQL Editor. Aman dijalankan di database yang sudah
-- ada datanya -- tidak ada DROP TABLE, hanya ADD COLUMN / CREATE TABLE IF
-- NOT EXISTS.
-- =========================================================================

-- 1. Tambah kolom saldo koin ke tabel users.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS koin INTEGER NOT NULL DEFAULT 0;

-- 2. Tambah kolom pencatat berapa koin yang didapat dari tiap pesanan
--    (supaya riwayat pesanan bisa menampilkan ini secara transparan).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS koin_diperoleh INTEGER NOT NULL DEFAULT 0;

-- 3. Tabel daftar hadiah yang bisa ditukar dengan koin. Dikelola admin
--    lewat Admin Panel, mirip pola kelola produk.
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    nama_hadiah VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    foto TEXT,
    biaya_koin INTEGER NOT NULL CHECK (biaya_koin >= 100), -- minimal 100 koin per aturan
    stok INTEGER NOT NULL DEFAULT 0,
    aktif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel riwayat penukaran koin. nama_hadiah disalin (snapshot) saat
--    penukaran terjadi, supaya riwayat tetap utuh & akurat walau reward
--    aslinya diedit atau dihapus admin di kemudian hari.
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
    nama_hadiah VARCHAR(255) NOT NULL,
    koin_terpakai INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Menunggu', -- Menunggu, Diproses, Terkirim, Dibatalkan
    catatan_admin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_id ON reward_redemptions(user_id);


-- =========================================================================
-- RLS untuk tabel baru -- konsisten dengan kebijakan Tahap 2 sebelumnya:
-- rewards itu seperti katalog (publik baca, admin kelola), redemptions
-- seperti orders (pelanggan lihat miliknya sendiri, admin lihat semua).
-- =========================================================================

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read rewards" ON rewards;
CREATE POLICY "Public read rewards" ON rewards FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write rewards" ON rewards;
CREATE POLICY "Admin write rewards" ON rewards FOR ALL USING (is_admin()) WITH CHECK (is_admin());


ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own redemptions or admin reads all" ON reward_redemptions;
CREATE POLICY "Users read own redemptions or admin reads all" ON reward_redemptions
  FOR SELECT USING (user_id = auth.uid()::text OR is_admin());

-- Pelanggan menukar koin untuk dirinya sendiri.
DROP POLICY IF EXISTS "Users insert own redemptions" ON reward_redemptions;
CREATE POLICY "Users insert own redemptions" ON reward_redemptions
  FOR INSERT WITH CHECK (user_id = auth.uid()::text OR is_admin());

-- Hanya admin yang boleh mengubah status penukaran (Diproses/Terkirim/dst).
DROP POLICY IF EXISTS "Admin update redemptions" ON reward_redemptions;
CREATE POLICY "Admin update redemptions" ON reward_redemptions
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin delete redemptions" ON reward_redemptions;
CREATE POLICY "Admin delete redemptions" ON reward_redemptions
  FOR DELETE USING (is_admin());


-- Catatan: is_admin() adalah fungsi helper yang sudah dibuat di
-- rls_policies_tahap2.sql. Kalau Anda menjalankan file ini di database yang
-- BELUM pernah menjalankan rls_policies_tahap2.sql, jalankan dulu bagian
-- "HELPER" dari file itu sebelum melanjutkan ke bawah ini.
