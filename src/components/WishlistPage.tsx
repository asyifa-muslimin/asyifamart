import React from 'react';
import { Heart, HeartOff } from 'lucide-react';
import { Product, ProductVariant, WishlistItem } from '../types';
import { isVariantOfProduct, getProductId } from '../utils';

interface WishlistPageProps {
  wishlist: WishlistItem[];
  products: Product[];
  variants: ProductVariant[];
  onRemoveFavorite: (e: React.MouseEvent, prodId: number) => void;
  onOpenDetail: (prodId: number) => void;
  onBackToHome: () => void;
}

export const WishlistPage: React.FC<WishlistPageProps> = ({
  wishlist,
  products,
  variants,
  onRemoveFavorite,
  onOpenDetail,
  onBackToHome,
}) => {
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  if (wishlist.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl custom-shadow">
        <HeartOff className="w-16 h-16 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-bold">Belum Ada Favorit</p>
        <p className="text-xs text-slate-400 mt-1">
          Tekan ikon hati di produk kesukaanmu untuk ditampilkan di halaman ini.
        </p>
        <button
          type="button"
          onClick={onBackToHome}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl mt-4 inline-block uppercase tracking-wider transition"
        >
          Mulai Belanja
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
        <Heart className="w-6 h-6 text-red-500 fill-red-500" /> Produk Favorit Anda
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {wishlist.map((item) => {
          const prod = products.find((p) => {
            const pId = getProductId(p);
            return pId !== null && pId !== undefined && String(pId) === String(item.product_id);
          });
          if (!prod) return null;

          const pVariants = variants.filter((v) => isVariantOfProduct(v, prod));
          const minPriceVar = pVariants.reduce((min, curr) => {
            const priceA = min.harga_promo > 0 ? min.harga_promo : min.harga;
            const priceB = curr.harga_promo > 0 ? curr.harga_promo : curr.harga;
            return priceB < priceA ? curr : min;
          }, pVariants[0] || { id: 0, harga: 0, harga_promo: 0 });

          const hasPromo = minPriceVar && minPriceVar.harga_promo > 0;
          const displayPrice = minPriceVar ? (hasPromo ? minPriceVar.harga_promo : minPriceVar.harga) : 0;

          return (
            <div
              key={item.id}
              className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between p-3 relative group"
            >
              <button
                type="button"
                onClick={(e) => onRemoveFavorite(e, prod.id)}
                className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full z-10 text-red-500 hover:scale-105 transition shadow-xs"
              >
                <Heart className="w-4 h-4 fill-red-500 text-red-500" />
              </button>

              <div
                onClick={() => onOpenDetail(prod.id)}
                className="cursor-pointer"
              >
                <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2">
                  <img
                    src={prod.foto || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80'}
                    className="w-full h-full object-cover"
                    alt={prod.nama_produk}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/300x300/e2e8f0/64748b?text=Produk';
                    }}
                  />
                </div>
                <h4 className="font-extrabold text-slate-800 text-xs line-clamp-2 min-h-[2.5rem] tracking-tight leading-tight">
                  {prod.nama_produk}
                </h4>
                <div className="mt-2 min-h-[2.25rem]">
                  {hasPromo ? (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 line-through">Rp {formatRupiah(minPriceVar.harga)}</span>
                      <span className="text-xs font-black text-emerald-600">Rp {formatRupiah(minPriceVar.harga_promo)}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-black text-slate-700">Rp {formatRupiah(displayPrice)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
