import React from 'react';
import { Heart, Plus, ShoppingBasket, ShoppingBag } from 'lucide-react';
import { Product, ProductVariant } from '../types';

interface ProductCardProps {
  product: Product;
  categoryName: string;
  variants: ProductVariant[];
  isFavorited: boolean;
  onToggleWishlist: (e: React.MouseEvent, prodId: number) => void;
  onOpenDetail: (prodId: number) => void;
  onQuickAdd: (e: React.MouseEvent, variantId: number) => void;
  onBuyNow: (e: React.MouseEvent, variantId: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  categoryName,
  variants,
  isFavorited,
  onToggleWishlist,
  onOpenDetail,
  onQuickAdd,
  onBuyNow,
}) => {
  // Find minimum price variant
  const minPriceVar = variants.reduce((min, curr) => {
    const priceA = min.harga_promo > 0 ? min.harga_promo : min.harga;
    const priceB = curr.harga_promo > 0 ? curr.harga_promo : curr.harga;
    return priceB < priceA ? curr : min;
  }, variants[0] || { id: 0, harga: 0, harga_promo: 0 });

  const hasPromo = minPriceVar && minPriceVar.harga_promo > 0;
  const originalPrice = minPriceVar ? minPriceVar.harga : 0;
  const promoPrice = minPriceVar ? minPriceVar.harga_promo : 0;

  const discountPercentage = hasPromo
    ? Math.round(((originalPrice - promoPrice) / originalPrice) * 100)
    : 0;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-emerald-500/20 transition duration-150 flex flex-col justify-between group cursor-pointer relative">
      {hasPromo && (
        <span className="absolute top-2.5 left-2.5 bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-lg z-10 shadow-sm shadow-red-500/20">
          {discountPercentage}% OFF
        </span>
      )}

      <button
        type="button"
        onClick={(e) => onToggleWishlist(e, product.id)}
        className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs p-1.5 rounded-full z-10 hover:scale-105 transition text-slate-400 hover:text-red-500 shadow-xs"
      >
        <Heart
          className={`w-4 h-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-400'}`}
        />
      </button>

      <div onClick={() => onOpenDetail(product.id)}>
        <div className="aspect-square bg-slate-50 overflow-hidden relative">
          <img
            src={product.foto || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80'}
            alt={product.nama_produk}
            className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/300x300/e2e8f0/64748b?text=Produk+Sembako';
            }}
          />
        </div>
        <div className="p-3.5 space-y-1">
          <span className="text-[8px] font-extrabold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded-md">
            {categoryName}
          </span>
          <h4 className="font-extrabold text-slate-800 text-xs mt-1 leading-tight line-clamp-2 min-h-[2rem] tracking-tight">
            {product.nama_produk}
          </h4>
          
          <div className="pt-1">
            {hasPromo ? (
              <>
                <p className="text-[9px] text-slate-400 line-through">Rp {formatRupiah(originalPrice)}</p>
                <p className="text-xs font-black text-emerald-600">Rp {formatRupiah(promoPrice)}</p>
              </>
            ) : (
              <p className="text-xs font-black text-slate-700">Rp {formatRupiah(originalPrice)}</p>
            )}
            <span className="text-[9px] text-slate-400 mt-1 block font-medium">
              Tersedia {variants.length} variasi
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 pt-0 flex gap-1.5 w-full">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            minPriceVar && onQuickAdd(e, minPriceVar.id);
          }}
          className="flex-1 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 active:scale-[0.97] duration-150 shadow-2xs"
        >
          <ShoppingBasket className="w-3.5 h-3.5 text-slate-500" />
          <span>Keranjang</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            minPriceVar && onBuyNow(e, minPriceVar.id);
          }}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold py-2 rounded-lg flex items-center justify-center gap-1 transition active:scale-[0.97] duration-150 shadow-xs hover:shadow-sm"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Beli</span>
        </button>
      </div>
    </div>
  );
};
