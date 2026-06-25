-- =========================================================================
-- SUPABASE DATABASE SCHEMA & INITIAL SEED DATA FOR ASYIFA MART
-- =========================================================================
-- Petunjuk Penggunaan:
-- 1. Buka dashboard Supabase Anda (https://supabase.com).
-- 2. Pilih proyek Supabase Anda.
-- 3. Navigasikan ke menu "SQL Editor" dari sidebar sebelah kiri.
-- 4. Klik "New Query" untuk membuat lembar kerja baru.
-- 5. Salin dan tempel seluruh kode SQL di bawah ini.
-- 6. Klik tombol "Run" untuk mengeksekusi skema dan memasukkan data default.
-- =========================================================================

-- Hapus tabel lama jika sudah ada (Opsional, pastikan Anda ingin me-reset data)
DROP TABLE IF EXISTS wishlist CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS promos CASCADE;
DROP TABLE IF EXISTS banners CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS store_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. TABEL STORE SETTINGS
CREATE TABLE store_settings (
    id SERIAL PRIMARY KEY,
    nama_toko VARCHAR(255) NOT NULL DEFAULT 'ASYIFA MART',
    whatsapp VARCHAR(50) NOT NULL,
    alamat TEXT NOT NULL,
    google_maps TEXT,
    latitude DOUBLE PRECISION DEFAULT 0.0,
    longitude DOUBLE PRECISION DEFAULT 0.0,
    payment_cod_active BOOLEAN NOT NULL DEFAULT TRUE,
    payment_cod_note TEXT,
    payment_qris_active BOOLEAN NOT NULL DEFAULT FALSE,
    payment_qris_image TEXT,
    payment_dana_active BOOLEAN NOT NULL DEFAULT FALSE,
    payment_dana_number VARCHAR(50),
    payment_dana_name VARCHAR(100),
    struk_header TEXT,
    struk_footer TEXT,
    struk_lebar VARCHAR(10) DEFAULT '58mm',
    struk_show_alamat BOOLEAN NOT NULL DEFAULT TRUE,
    struk_show_kontak BOOLEAN NOT NULL DEFAULT TRUE,
    struk_show_waktu BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. TABEL USERS (Pelanggan & Admin)
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY, -- Mendukung format string kustom (misal dari Auth / email)
    nama VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    whatsapp VARCHAR(50),
    alamat TEXT,
    google_maps TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'pelanggan', -- 'admin' atau 'pelanggan'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABEL CATEGORIES
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    nama_kategori VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50)
);

-- 4. TABEL PRODUCTS
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    nama_produk VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    kategori_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
    deskripsi TEXT,
    foto TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'aktif' -- 'aktif' atau 'nonaktif'
);

-- 5. TABEL PRODUCT VARIANTS
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    nama_varian VARCHAR(150) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    harga DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    harga_promo DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    stok INTEGER NOT NULL DEFAULT 0,
    berat INTEGER NOT NULL DEFAULT 0 -- dalam satuan gram
);

-- 6. TABEL BANNERS
CREATE TABLE banners (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    gambar TEXT NOT NULL,
    link TEXT,
    aktif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 7. TABEL PROMOS
CREATE TABLE promos (
    id SERIAL PRIMARY KEY,
    nama_promo VARCHAR(255) NOT NULL,
    tipe VARCHAR(20) NOT NULL, -- 'Persen' atau 'Nominal'
    nilai DOUBLE PRECISION NOT NULL,
    tanggal_mulai VARCHAR(50) NOT NULL,
    tanggal_selesai VARCHAR(50) NOT NULL
);

-- 8. TABEL ORDERS
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL, -- Menghubungkan ke user
    kode_order VARCHAR(100) UNIQUE NOT NULL,
    total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'Baru', -- 'Baru', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'
    nama_pembeli VARCHAR(255) NOT NULL,
    whatsapp_pembeli VARCHAR(50) NOT NULL,
    alamat TEXT NOT NULL,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. TABEL ORDER ITEMS
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL, -- Menyimpan ID Varian yang dibeli
    qty INTEGER NOT NULL DEFAULT 1,
    harga DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

-- 10. TABEL WISHLIST
CREATE TABLE wishlist (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE
);

-- =========================================================================
-- INDEKS UNTUK MENGOPTIMALKAN KINERJA QUERY (OPTIONAL BUT RECOMMENDED)
-- =========================================================================
CREATE INDEX idx_products_category ON products(kategori_id);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_wishlist_user ON wishlist(user_id);

-- =========================================================================
-- MASUKKAN DATA SEED DEFAULT (MENGACU PADA seedData.ts)
-- =========================================================================

-- Seed Store Settings (Sesuai defaultStoreSettings)
INSERT INTO store_settings (
    id, nama_toko, whatsapp, alamat, google_maps, latitude, longitude,
    payment_cod_active, payment_cod_note, payment_qris_active, payment_qris_image,
    payment_dana_active, payment_dana_number, payment_dana_name,
    struk_header, struk_footer, struk_lebar, struk_show_alamat, struk_show_kontak, struk_show_waktu
) VALUES (
    1,
    'ASYIFA MART',
    '6285648054845',
    'Jl.Raya Trantang Sakti Kec.Bp.Peliung',
    'https://maps.google.com/?q=-4.2816,104.5936',
    -4.2816,
    104.5936,
    TRUE,
    'Bayar langsung secara tunai ke kurir saat sembako mendarat di rumah Anda.',
    FALSE,
    '',
    FALSE,
    '',
    '',
    'ASYIFA MART - BELANJA SEMBAKO HEMAT',
    'Terima Kasih Atas Kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
    '58mm',
    TRUE,
    TRUE,
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- Reset sequence jika diperlukan
SELECT setval('store_settings_id_seq', (SELECT MAX(id) FROM store_settings));

-- Seed Categories (Sesuai defaultCategories)
INSERT INTO categories (id, nama_kategori, slug, icon) VALUES
(1, 'Sembako Utama', 'sembako-utama', '🌾'),
(2, 'Bumbu Dapur', 'bumbu-dapur', '🌶️'),
(3, 'Sayuran & Buah', 'sayuran-buah', '🍎'),
(4, 'Perawatan Rumah', 'perawatan-rumah', '🧼')
ON CONFLICT (id) DO NOTHING;

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- Seed Products (Sesuai defaultProducts)
INSERT INTO products (id, nama_produk, slug, kategori_id, deskripsi, foto, status) VALUES
(101, 'Beras Cianjur Pandan Wangi Premium', 'beras-cianjur', 1, 'Beras pulen alami kualitas terbaik nusantara langsung giling, bersih tanpa pemutih buatan.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80', 'aktif'),
(102, 'Minyak Goreng Filma Double Refined 2L', 'minyak-goreng', 1, 'Minyak goreng jernih berkualitas tinggi terbuat dari kelapa sawit segar pilihan bermutu.', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80', 'aktif'),
(103, 'Bawang Putih Kupas Bersih Segar', 'bawang-putih', 2, 'Bawang putih pilihan yang telah dikupas higienis, bersih dan siap langsung dimasak harian.', 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=500&q=80', 'aktif'),
(104, 'Sabun Cuci Cair Sunlight Jeruk Nipis 700ml', 'sunlight', 4, 'Sabun cuci piring konsentrat andalan keluarga efektif mengangkat lemak membandel 5x lebih cepat.', 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=500&q=80', 'aktif')
ON CONFLICT (id) DO NOTHING;

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- Seed Product Variants (Sesuai defaultVariants)
INSERT INTO product_variants (id, product_id, nama_varian, sku, harga, harga_promo, stok, berat) VALUES
(1, 101, 'Kemasan 5 Kg', 'SKU-101-5', 85000, 79000, 35, 5000),
(2, 101, 'Kemasan 10 Kg', 'SKU-101-10', 165000, 154000, 20, 10000),
(3, 102, 'Pouch 2 Liter', 'SKU-102-2', 42000, 39500, 60, 2000),
(4, 103, 'Pack 250 Gram', 'SKU-103-250', 18000, 15000, 45, 250),
(5, 104, 'Kemasan Refill', 'SKU-104-700', 19500, 0, 90, 700)
ON CONFLICT (id) DO NOTHING;

SELECT setval('product_variants_id_seq', (SELECT MAX(id) FROM product_variants));

-- Seed Banners (Sesuai defaultBanners)
INSERT INTO banners (id, judul, gambar, link, aktif) VALUES
(1, 'Festival Belanja Sembako Hemat Akhir Pekan', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80', '#', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval('banners_id_seq', (SELECT MAX(id) FROM banners));

-- =========================================================================
-- SELESAI
-- =========================================================================
