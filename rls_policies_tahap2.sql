-- =========================================================================
-- TAHAP 2: ROW LEVEL SECURITY (RLS) untuk ASYIFA MART
-- =========================================================================
-- Jalankan ini di Supabase SQL Editor SETELAH Tahap 1 (Supabase Auth) sudah
-- berjalan normal dan sudah diuji (Daftar + Masuk berhasil).
--
-- Aman dijalankan ulang -- pakai DROP POLICY IF EXISTS sebelum CREATE.
-- =========================================================================

-- -------------------------------------------------------------------------
-- HELPER: fungsi untuk mengecek apakah user yang sedang login adalah admin.
-- Dipakai berulang di banyak policy di bawah supaya tidak duplikasi logic.
-- SECURITY DEFINER supaya fungsi ini tetap bisa membaca tabel users walau
-- pemanggilnya sendiri belum punya akses SELECT ke tabel itu.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- =========================================================================
-- 1. TABEL PUBLIK: products, product_variants, categories, banners, promos,
--    store_settings -- semua orang boleh baca, cuma admin boleh ubah.
-- =========================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write products" ON products;
CREATE POLICY "Admin write products" ON products FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product_variants" ON product_variants;
CREATE POLICY "Public read product_variants" ON product_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write product_variants" ON product_variants;
CREATE POLICY "Admin write product_variants" ON product_variants FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read categories" ON categories;
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write categories" ON categories;
CREATE POLICY "Admin write categories" ON categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read banners" ON banners;
CREATE POLICY "Public read banners" ON banners FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write banners" ON banners;
CREATE POLICY "Admin write banners" ON banners FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read promos" ON promos;
CREATE POLICY "Public read promos" ON promos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write promos" ON promos;
CREATE POLICY "Admin write promos" ON promos FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read store_settings" ON store_settings;
CREATE POLICY "Public read store_settings" ON store_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write store_settings" ON store_settings;
CREATE POLICY "Admin write store_settings" ON store_settings FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- =========================================================================
-- 2. TABEL users -- paling sensitif. User cuma boleh lihat/ubah baris
--    miliknya sendiri. Admin boleh lihat semua (untuk kebutuhan kelola toko).
-- =========================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- User boleh INSERT baris untuk dirinya sendiri (dipakai saat pendaftaran,
-- setelah supabase.auth.signUp() berhasil).
DROP POLICY IF EXISTS "Users insert own profile" ON users;
CREATE POLICY "Users insert own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid()::text);

-- User boleh baca profilnya sendiri; admin boleh baca semua profil.
DROP POLICY IF EXISTS "Users read own profile or admin reads all" ON users;
CREATE POLICY "Users read own profile or admin reads all" ON users
  FOR SELECT USING (id = auth.uid()::text OR is_admin());

-- User boleh update profilnya sendiri; admin boleh update siapa saja
-- (misalnya untuk ubah role pelanggan jadi admin).
DROP POLICY IF EXISTS "Users update own profile or admin updates all" ON users;
CREATE POLICY "Users update own profile or admin updates all" ON users
  FOR UPDATE USING (id = auth.uid()::text OR is_admin())
  WITH CHECK (id = auth.uid()::text OR is_admin());

-- Hanya admin yang boleh menghapus akun pengguna.
DROP POLICY IF EXISTS "Admin delete users" ON users;
CREATE POLICY "Admin delete users" ON users
  FOR DELETE USING (is_admin());


-- =========================================================================
-- 3. TABEL orders -- pelanggan cuma boleh lihat & buat pesanan miliknya
--    sendiri. Admin boleh lihat & ubah status semua pesanan.
-- =========================================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own orders or admin reads all" ON orders;
CREATE POLICY "Users read own orders or admin reads all" ON orders
  FOR SELECT USING (user_id = auth.uid()::text OR is_admin());

-- Pelanggan membuat pesanan untuk dirinya sendiri saat checkout.
DROP POLICY IF EXISTS "Users insert own orders" ON orders;
CREATE POLICY "Users insert own orders" ON orders
  FOR INSERT WITH CHECK (user_id = auth.uid()::text OR is_admin());

-- Hanya admin yang boleh mengubah status pesanan (Diproses/Dikirim/dst).
DROP POLICY IF EXISTS "Admin update orders" ON orders;
CREATE POLICY "Admin update orders" ON orders
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin delete orders" ON orders;
CREATE POLICY "Admin delete orders" ON orders
  FOR DELETE USING (is_admin());


-- =========================================================================
-- 4. TABEL order_items -- tidak punya user_id langsung, jadi cek lewat
--    tabel orders yang terhubung (order_id).
-- =========================================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own order_items or admin reads all" ON order_items;
CREATE POLICY "Users read own order_items or admin reads all" ON order_items
  FOR SELECT USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users insert own order_items" ON order_items;
CREATE POLICY "Users insert own order_items" ON order_items
  FOR INSERT WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Admin manage order_items" ON order_items;
CREATE POLICY "Admin manage order_items" ON order_items
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin delete order_items" ON order_items;
CREATE POLICY "Admin delete order_items" ON order_items
  FOR DELETE USING (is_admin());


-- =========================================================================
-- 5. TABEL wishlist -- pelanggan cuma boleh kelola wishlist miliknya sendiri.
-- =========================================================================

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own wishlist select" ON wishlist;
CREATE POLICY "Users manage own wishlist select" ON wishlist
  FOR SELECT USING (user_id = auth.uid()::text OR is_admin());

DROP POLICY IF EXISTS "Users manage own wishlist insert" ON wishlist;
CREATE POLICY "Users manage own wishlist insert" ON wishlist
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users manage own wishlist delete" ON wishlist;
CREATE POLICY "Users manage own wishlist delete" ON wishlist
  FOR DELETE USING (user_id = auth.uid()::text OR is_admin());
