import { StoreSettings, Category, Product, ProductVariant, Banner, Promo } from './types';

export const defaultStoreSettings: StoreSettings = {
  nama_toko: "ASYIFA MART",
  whatsapp: "6285648054845",
  alamat: "Jl.Raya Trantang Sakti Kec.Bp.Peliung",
  google_maps: "https://maps.google.com/?q=-4.2816,104.5936",
  latitude: -4.2816,
  longitude: 104.5936,
  payment_cod_active: true,
  payment_cod_note: "Bayar langsung secara tunai ke kurir saat sembako mendarat di rumah Anda.",
  payment_qris_active: false,
  payment_qris_image: "",
  payment_dana_active: false,
  payment_dana_number: "",
  payment_dana_name: "",
  struk_header: "ASYIFA MART - BELANJA SEMBAKO HEMAT",
  struk_footer: "Terima Kasih Atas Kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.",
  struk_lebar: "58mm",
  struk_show_alamat: true,
  struk_show_kontak: true,
  struk_show_waktu: true
};

export const defaultCategories: Category[] = [
  { id: 1, nama_kategori: "Sembako Utama", slug: "sembako-utama", icon: "🌾" },
  { id: 2, nama_kategori: "Bumbu Dapur", slug: "bumbu-dapur", icon: "🌶️" },
  { id: 3, nama_kategori: "Sayuran & Buah", slug: "sayuran-buah", icon: "🍎" },
  { id: 4, nama_kategori: "Perawatan Rumah", slug: "perawatan-rumah", icon: "🧼" }
];

export const defaultProducts: Product[] = [
  { id: 101, nama_produk: "Beras Cianjur Pandan Wangi Premium", kategori_id: 1, deskripsi: "Beras pulen alami kualitas terbaik nusantara langsung giling, bersih tanpa pemutih buatan.", foto: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80", status: "aktif", slug: "beras-cianjur" },
  { id: 102, nama_produk: "Minyak Goreng Filma Double Refined 2L", kategori_id: 1, deskripsi: "Minyak goreng jernih berkualitas tinggi terbuat dari kelapa sawit segar pilihan bermutu.", foto: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80", status: "aktif", slug: "minyak-goreng" },
  { id: 103, nama_produk: "Bawang Putih Kupas Bersih Segar", kategori_id: 2, deskripsi: "Bawang putih pilihan yang telah dikupas higienis, bersih dan siap langsung dimasak harian.", foto: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=500&q=80", status: "aktif", slug: "bawang-putih" },
  { id: 104, nama_produk: "Sabun Cuci Cair Sunlight Jeruk Nipis 700ml", kategori_id: 4, deskripsi: "Sabun cuci piring konsentrat andalan keluarga efektif mengangkat lemak membandel 5x lebih cepat.", foto: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=500&q=80", status: "aktif", slug: "sunlight" }
];

export const defaultVariants: ProductVariant[] = [
  { id: 1, product_id: 101, nama_varian: "Kemasan 5 Kg", sku: "SKU-101-5", harga: 85000, harga_promo: 79000, stok: 35, berat: 5000 },
  { id: 2, product_id: 101, nama_varian: "Kemasan 10 Kg", sku: "SKU-101-10", harga: 165000, harga_promo: 154000, stok: 20, berat: 10000 },
  { id: 3, product_id: 102, nama_varian: "Pouch 2 Liter", sku: "SKU-102-2", harga: 42000, harga_promo: 39500, stok: 60, berat: 2000 },
  { id: 4, product_id: 103, nama_varian: "Pack 250 Gram", sku: "SKU-103-250", harga: 18000, harga_promo: 15000, stok: 45, berat: 250 },
  { id: 5, product_id: 104, nama_varian: "Kemasan Refill", sku: "SKU-104-700", harga: 19500, harga_promo: 0, stok: 90, berat: 700 }
];

export const defaultBanners: Banner[] = [
  { id: 1, judul: "Festival Belanja Sembako Hemat Akhir Pekan", gambar: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80", link: "#", aktif: true }
];

export const defaultPromos: Promo[] = [];
