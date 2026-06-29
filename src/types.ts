export interface StoreSettings {
  id?: number;
  nama_toko: string;
  whatsapp: string;
  alamat: string;
  google_maps: string;
  latitude: number;
  longitude: number;
  payment_cod_active: boolean;
  payment_cod_note: string;
  payment_qris_active: boolean;
  payment_qris_image: string;
  payment_dana_active: boolean;
  payment_dana_number: string;
  payment_dana_name: string;
  struk_header?: string;
  struk_footer?: string;
  struk_lebar?: '58mm' | '80mm';
  struk_show_alamat?: boolean;
  struk_show_kontak?: boolean;
  struk_show_waktu?: boolean;
  printer_thermal_nama?: string;
  printer_auto_print_aktif?: boolean;
}

export interface Category {
  id: number;
  nama_kategori: string;
  slug: string;
  icon?: string;
}

export interface Product {
  id: number;
  nama_produk: string;
  slug: string;
  kategori_id: number;
  deskripsi?: string;
  foto?: string;
  status: string; // 'aktif' | 'nonaktif'
}

export interface ProductVariant {
  id: number;
  product_id: number;
  nama_varian: string;
  sku: string;
  harga: number;
  harga_promo: number;
  stok: number;
  berat: number;
}

export interface Banner {
  id: number;
  judul: string;
  gambar: string;
  link?: string;
  aktif: boolean;
}

export interface Promo {
  id: number;
  nama_promo: string;
  tipe: 'Persen' | 'Nominal';
  nilai: number;
  tanggal_mulai: string;
  tanggal_selesai: string;
}

export interface User {
  id: string;
  nama: string;
  email: string;
  whatsapp?: string;
  alamat?: string;
  google_maps?: string;
  role: 'admin' | 'pelanggan';
  koin?: number;
  created_at?: string;
}

export interface Order {
  id: number;
  user_id: string;
  kode_order: string;
  total: number;
  status: 'Baru' | 'Diproses' | 'Dikirim' | 'Selesai' | 'Dibatalkan';
  nama_pembeli: string;
  whatsapp_pembeli: string;
  alamat: string;
  catatan?: string;
  koin_diperoleh?: number;
  created_at?: string;
  items?: Array<{
    id?: number;
    nama_produk: string;
    nama_varian: string;
    qty: number;
    harga: number;
  }>;
}

export interface OrderItem {
  id: number;
  order_id: number;
  variant_id: number;
  qty: number;
  harga: number;
}

export interface WishlistItem {
  id: number;
  user_id?: string;
  product_id: number;
}

export interface CartItem {
  variant_id: number;
  qty: number;
}

export interface Reward {
  id: number;
  nama_hadiah: string;
  deskripsi?: string;
  foto?: string;
  biaya_koin: number;
  stok: number;
  aktif: boolean;
  created_at?: string;
}

export interface RewardRedemption {
  id: number;
  user_id: string;
  reward_id: number;
  nama_hadiah: string; // disalin saat penukaran, supaya riwayat tetap utuh walau reward diedit/dihapus nanti
  koin_terpakai: number;
  status: 'Menunggu' | 'Diproses' | 'Terkirim' | 'Dibatalkan';
  catatan_admin?: string;
  created_at?: string;
}
