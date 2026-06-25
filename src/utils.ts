import { Product, ProductVariant } from './types';

export const getProductId = (prod: any): any => {
  if (!prod) return null;
  if (prod.id !== undefined && prod.id !== null) return prod.id;
  if (prod.id_produk !== undefined && prod.id_produk !== null) return prod.id_produk;
  if (prod.product_id !== undefined && prod.product_id !== null) return prod.product_id;
  return null;
};

export const getVariantProductId = (v: any): any => {
  if (!v) return null;
  if (v.product_id !== undefined && v.product_id !== null) return v.product_id;
  if (v.id_produk !== undefined && v.id_produk !== null) return v.id_produk;
  if (v.productId !== undefined && v.productId !== null) return v.productId;
  return null;
};

export const isVariantOfProduct = (v: any, prod: any): boolean => {
  const pId = getProductId(prod);
  const vpId = getVariantProductId(v);
  if (pId === null || pId === undefined || vpId === null || vpId === undefined) return false;
  return String(vpId) === String(pId);
};

export const safeSetLocalStorage = (key: string, value: any): void => {
  try {
    const stringified = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringified);
  } catch (error: any) {
    console.warn(`[SafeStorage] Gagal menyimpan ${key} karena error:`, error);
    
    const isQuotaError = 
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014 ||
      (error.message && error.message.toLowerCase().includes('quota')) ||
      (error.message && error.message.toLowerCase().includes('exceeded'));
      
    if (isQuotaError) {
      console.warn('[SafeStorage] Batas kapasitas penyimpanan penuh. Menjalankan optimasi otomatis...');
      try {
        let parsedValue: any = null;
        try {
          parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (_) {}

        // 1. Jika ini data produk, optimalkan dengan membuang foto base64 yang sangat berat
        if (parsedValue && Array.isArray(parsedValue) && (key === 'emulated_products' || key === 'products')) {
          const optimized = parsedValue.map((p: any) => {
            if (p.foto && (p.foto.startsWith('data:') || p.foto.length > 5000)) {
              return { 
                ...p, 
                foto: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80' 
              };
            }
            return p;
          });
          localStorage.setItem(key, JSON.stringify(optimized));
          console.log('[SafeStorage] Berhasil menyimpan produk setelah mengecilkan gambar berat!');
          return;
        }

        // 2. Jika store settings berisi QRIS base64 berat, optimalkan juga
        if (parsedValue && (key === 'emulated_store_settings' || key === 'store_settings')) {
          const settingsObj = Array.isArray(parsedValue) ? parsedValue[0] : parsedValue;
          if (settingsObj && settingsObj.payment_qris_image && settingsObj.payment_qris_image.length > 5000) {
            settingsObj.payment_qris_image = "";
            localStorage.setItem(key, JSON.stringify(Array.isArray(parsedValue) ? [settingsObj] : settingsObj));
            console.log('[SafeStorage] Berhasil menyimpan pengaturan toko setelah mengosongkan QRIS berat!');
            return;
          }
        }

        // 3. Bersihkan cache lama non-kritis lainnya untuk memberi ruang
        const nonCriticalKeys = ['emulated_orders', 'asyifa_cart', 'asyifa_wishlist', 'emulated_banners', 'emulated_promos'];
        for (const k of nonCriticalKeys) {
          if (k !== key) {
            localStorage.removeItem(k);
          }
        }

        const retryStringified = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, retryStringified);
        console.log(`[SafeStorage] Berhasil menyimpan ${key} setelah pembersihan memori.`);
      } catch (retryError) {
        console.error(`[SafeStorage] Pembersihan otomatis gagal untuk ${key}:`, retryError);
      }
    }
  }
};

