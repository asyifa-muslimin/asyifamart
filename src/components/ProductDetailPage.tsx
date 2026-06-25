import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingBasket, ShoppingBag } from 'lucide-react';
import { Product, ProductVariant } from '../types';

interface ProductDetailPageProps {
  product: Product;
  categoryName: string;
  variants: ProductVariant[];
  onBack: () => void;
  onAddToCart: (variantId: number) => void;
  onBuyNow?: (variantId: number) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  categoryName,
  variants,
  onBack,
  onAddToCart,
  onBuyNow,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    if (variants.length > 0) {
      setSelectedVariant(variants[0]);
    }
  }, [variants]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const currentPrice = selectedVariant
    ? selectedVariant.harga_promo > 0
      ? selectedVariant.harga_promo
      : selectedVariant.harga
    : 0;

  const originalPrice = selectedVariant ? selectedVariant.harga : 0;
  const isPromo = selectedVariant && selectedVariant.harga_promo > 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-8 custom-shadow">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-emerald-600 font-bold mb-6 hover:underline text-xs bg-emerald-50 px-3 py-2 rounded-xl w-fit transition"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Katalog Toko
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 shadow-xs">
            <img
              src={product.foto || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80'}
              className="w-full h-full object-cover"
              alt={product.nama_produk}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/300x300/e2e8f0/64748b?text=Produk+Sembako';
              }}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl">
                {categoryName}
              </span>
              <h3 className="text-lg md:text-xl font-black text-slate-800 mt-2.5 leading-tight tracking-tight">
                {product.nama_produk}
              </h3>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Pilihan Variasi Ukuran</label>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={`border px-3.5 py-2.5 rounded-2xl text-xs font-bold flex flex-col items-start gap-0.5 transition duration-150 ${
                      selectedVariant?.id === v.id
                        ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-600'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <span>{v.nama_varian}</span>
                    <span className="text-[9px] text-slate-500 font-medium">
                      {v.harga_promo > 0 ? (
                        <>
                          <span className="line-through text-slate-400 mr-1.5">Rp {formatRupiah(v.harga)}</span>
                          <span className="text-emerald-600 font-bold">Rp {formatRupiah(v.harga_promo)}</span>
                        </>
                      ) : (
                        `Rp ${formatRupiah(v.harga)}`
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div id="detail-price-box">
                {isPromo ? (
                  <>
                    <span className="text-[8px] text-red-500 bg-red-100 px-2 py-0.5 rounded-lg font-black uppercase tracking-wider inline-block mb-1">
                      PROMO SPESIAL
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-emerald-600">Rp {formatRupiah(currentPrice)}</span>
                      <span className="text-[10px] text-slate-400 line-through">Rp {formatRupiah(originalPrice)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-slate-800">Rp {formatRupiah(currentPrice)}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
                <div>Stok Tersedia: <span className="font-bold text-slate-800">{selectedVariant?.stok ?? '-'} Pcs</span></div>
                <div>Berat Produk: <span className="font-bold text-slate-800">{selectedVariant?.berat ?? '-'} Gram</span></div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 text-xs mb-1.5 uppercase tracking-wide">Deskripsi Lengkap</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {product.deskripsi || 'Tidak ada deskripsi produk.'}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-row items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => selectedVariant && onAddToCart(selectedVariant.id)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition text-xs uppercase tracking-wider"
            >
              <ShoppingBasket className="w-5 h-5 text-emerald-600" /> + Keranjang
            </button>
            <button
              type="button"
              onClick={() => selectedVariant && onBuyNow && onBuyNow(selectedVariant.id)}
              className="flex-1 bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 hover:scale-[1.01] active:scale-[0.98] text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-red-500/25 text-xs uppercase tracking-wider"
            >
              <ShoppingBag className="w-5 h-5" /> Beli Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
