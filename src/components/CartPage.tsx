import React, { useState, useEffect } from 'react';
import { ShoppingBasket, Trash2, Truck, MapPin, Locate, MessageSquare, HandCoins, QrCode, Wallet } from 'lucide-react';
import { CartItem, Product, ProductVariant, StoreSettings, User } from '../types';
import { isVariantOfProduct } from '../utils';

interface CartPageProps {
  cart: CartItem[];
  products: Product[];
  variants: ProductVariant[];
  storeSettings: StoreSettings;
  currentUser: User | null;
  onUpdateQty: (variantId: number, change: number) => void;
  onRemoveItem: (variantId: number) => void;
  onCheckout: (data: {
    nama: string;
    wa: string;
    alamat: string;
    catatan: string;
    mapsUrl: string;
    paymentMethod: string;
    distance: number;
    ongkir: number;
  }) => void;
  onNavigateToHome: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  cart,
  products,
  variants,
  storeSettings,
  currentUser,
  onUpdateQty,
  onRemoveItem,
  onCheckout,
  onNavigateToHome,
  showToast,
}) => {
  const [nama, setNama] = useState('');
  const [wa, setWa] = useState('');
  const [alamat, setAlamat] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [catatan, setCatatan] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');

  const [distance, setDistance] = useState(0);
  const [ongkir, setOngkir] = useState(0);
  const [isOutOfDeliveryRange, setIsOutOfDeliveryRange] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setNama(currentUser.nama || '');
      setWa(currentUser.whatsapp || '');
      setAlamat(currentUser.alamat || '');
      setMapsUrl(currentUser.google_maps || '');
      if (currentUser.google_maps) {
        handleMapsUrlParse(currentUser.google_maps);
      }
    }
  }, [currentUser]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  // Distance calculator using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's Radius in Km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleMapsUrlParse = (url: string) => {
    const regex = /q=(-?\d+\.\d+),(-?\d+\.\d+)|@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(regex);
    if (match) {
      const lat = parseFloat(match[1] || match[3]);
      const lon = parseFloat(match[2] || match[4]);
      applyShipping(lat, lon);
    }
  };

  // Aturan ongkos kirim ASYIFA MART:
  // - 0 s.d. 2 km   : gratis ongkir
  // - 2.1 s.d. 5 km  : Rp2.000 per km, dihitung HANYA dari kelebihan jarak di
  //                    atas 2 km (bukan dari total jarak), presisi desimal
  //                    tanpa pembulatan. Misal 3.4 km -> kelebihan 1.4 km
  //                    -> Rp2.000 x 1.4 = Rp2.800.
  // - lebih dari 5 km: di luar area layanan, pesanan tidak dapat diproses.
  const RADIUS_GRATIS_KM = 2;
  const RADIUS_MAKSIMAL_KM = 5;
  const TARIF_PER_KM = 2000;

  const calculateOngkir = (jarak: number): number => {
    if (jarak <= RADIUS_GRATIS_KM) return 0;
    const kelebihanKm = jarak - RADIUS_GRATIS_KM;
    return Math.round(kelebihanKm * TARIF_PER_KM);
  };

  const applyShipping = (userLat: number, userLon: number) => {
    const storeLat = storeSettings.latitude || -4.2816;
    const storeLon = storeSettings.longitude || 104.5936;

    const computedDistance = calculateDistance(storeLat, storeLon, userLat, userLon);
    setDistance(computedDistance);

    if (computedDistance > RADIUS_MAKSIMAL_KM) {
      // Di luar area layanan: kosongkan ongkir & tandai tidak valid supaya
      // handleSubmit menolak checkout, bukan cuma menampilkan peringatan.
      setOngkir(0);
      setIsOutOfDeliveryRange(true);
      showToast(
        `Maaf, lokasi Anda (${computedDistance.toFixed(2)} Km) di luar area layanan kami (maksimal ${RADIUS_MAKSIMAL_KM} Km).`,
        'error'
      );
      return;
    }

    setIsOutOfDeliveryRange(false);

    if (computedDistance <= RADIUS_GRATIS_KM) {
      setOngkir(0);
      showToast(`Radius Pengantaran: ${computedDistance.toFixed(2)} Km. Anda mendapatkan Gratis Ongkir!`, 'success');
    } else {
      const computedOngkir = calculateOngkir(computedDistance);
      setOngkir(computedOngkir);
      showToast(`Radius Pengantaran: ${computedDistance.toFixed(2)} Km. Ongkir Rp ${formatRupiah(computedOngkir)} otomatis diterapkan.`, 'info');
    }
  };

  const handleLacakGps = () => {
    if (navigator.geolocation) {
      showToast('Melacak koordinat GPS handphone Anda...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const url = `https://www.google.com/maps?q=${lat},${lon}`;
          setMapsUrl(url);
          applyShipping(lat, lon);
          showToast('Berhasil mendapatkan koordinat GPS!', 'success');
        },
        () => {
          showToast('Gagal melacak GPS. Pastikan izin lokasi aktif.', 'error');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      showToast('Perangkat tidak mendukung pelacakan lokasi.', 'error');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (isOutOfDeliveryRange) {
      showToast(
        `Maaf, lokasi Anda di luar area layanan kami (maksimal ${RADIUS_MAKSIMAL_KM} Km). Pesanan tidak dapat diproses.`,
        'error'
      );
      return;
    }

    if (distance <= 0 && mapsUrl.trim() === '') {
      showToast('Harap isi Titik Lokasi Google Maps atau lacak GPS terlebih dahulu agar ongkir dapat dihitung.', 'warning');
      return;
    }

    onCheckout({
      nama,
      wa,
      alamat,
      catatan,
      mapsUrl,
      paymentMethod,
      distance,
      ongkir,
    });
  };

  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center custom-shadow">
        <ShoppingBasket className="w-16 h-16 text-slate-200 mx-auto mb-3 animate-bounce" />
        <p className="font-extrabold text-slate-800 text-sm">Keranjang Belanja Anda Kosong</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Sembako terbaik dan bumbu dapur segar sudah menunggu untuk dipesan.
        </p>
        <button
          type="button"
          onClick={onNavigateToHome}
          className="bg-emerald-500 text-white font-extrabold text-xs px-6 py-3 rounded-xl mt-4 inline-block hover:bg-emerald-600 uppercase tracking-wider transition"
        >
          Mulai Belanja Sembako
        </button>
      </div>
    );
  }

  // Calculations
  let totalItem = 0;
  let totalWeight = 0;
  let subtotalPrice = 0;

  cart.forEach((item) => {
    const variant = variants.find((v) => v.id === item.variant_id);
    if (!variant) return;
    totalItem += item.qty;
    totalWeight += (variant.berat || 0) * item.qty;
    const price = variant.harga_promo > 0 ? variant.harga_promo : variant.harga;
    subtotalPrice += price * item.qty;
  });

  const grandTotal = subtotalPrice + ongkir;

  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
        <ShoppingBasket className="w-6 h-6 text-emerald-600" /> Keranjang Belanja Anda
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {cart.map((item) => {
            const variant = variants.find((v) => v.id === item.variant_id);
            if (!variant) return null;

            const prod = products.find((p) => isVariantOfProduct(variant, p));
            if (!prod) return null;

            const currentPrice = variant.harga_promo > 0 ? variant.harga_promo : variant.harga;
            const subtotal = currentPrice * item.qty;

            return (
              <div key={item.variant_id} className="bg-white border border-slate-100 rounded-3xl p-4 flex gap-4 custom-shadow relative">
                <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100">
                  <img
                    src={prod.foto || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80'}
                    className="w-full h-full object-cover"
                    alt={prod.nama_produk}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/300x300/e2e8f0/64748b?text=Produk';
                    }}
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs line-clamp-1 pr-6 leading-tight tracking-tight">
                      {prod.nama_produk}
                    </h4>
                    <span className="text-[9px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded-lg mt-1 inline-block">
                      {variant.nama_varian}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-black text-emerald-600">Rp {formatRupiah(currentPrice)}</span>

                    <div className="flex items-center gap-1.5 border border-slate-100 rounded-xl p-1 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(variant.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 shadow-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-slate-700">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(variant.id, 1)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 shadow-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveItem(variant.id)}
                  className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 h-fit sticky top-20 custom-shadow">
          <h3 className="font-extrabold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-500" /> Rincian Pengiriman & Pembayaran
          </h3>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Barang</span>
              <span className="font-bold text-slate-800">{totalItem} Pcs</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Berat</span>
              <span className="font-bold text-slate-800">
                {totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)} Kg` : `${totalWeight} Gram`}
              </span>
            </div>

            {distance > 0 && (
              <div className="flex justify-between text-xs text-slate-600">
                <span>Jarak Pengiriman</span>
                <span className={`font-bold ${isOutOfDeliveryRange ? 'text-red-500' : 'text-slate-800'}`}>
                  {distance.toFixed(2)} Km
                </span>
              </div>
            )}

            {isOutOfDeliveryRange && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold rounded-xl p-3 leading-relaxed">
                Maaf, lokasi Anda di luar area layanan kami (maksimal {RADIUS_MAKSIMAL_KM} Km dari toko).
                Pesanan tidak dapat diproses untuk jarak ini.
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-600">
              <span>Biaya Pengantaran</span>
              <span className={ongkir === 0 && !isOutOfDeliveryRange ? 'font-bold text-emerald-600' : 'font-bold text-slate-800'}>
                {isOutOfDeliveryRange ? '-' : ongkir === 0 ? 'Gratis' : `Rp ${formatRupiah(ongkir)}`}
              </span>
            </div>

            <div className="flex justify-between text-sm font-black text-emerald-600 border-t border-dashed border-slate-100 pt-3">
              <span>Total Pembayaran</span>
              <span className="text-base">Rp {formatRupiah(grandTotal)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Nama Penerima
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
                className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Nomor WhatsApp Aktif
              </label>
              <input
                type="tel"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                placeholder="Contoh: 081234567..."
                required
                className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Alamat Lengkap Pengiriman
              </label>
              <textarea
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                required
                rows={2}
                placeholder="Nama Jalan, Blok, RT/RW, Desa, Kecamatan..."
                className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1 text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span>Titik Lokasi Google Maps (Rekomendasi)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={mapsUrl}
                  onChange={(e) => {
                    setMapsUrl(e.target.value);
                    handleMapsUrlParse(e.target.value);
                  }}
                  placeholder="https://maps.google.com/..."
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-semibold"
                />
                <button
                  type="button"
                  onClick={handleLacakGps}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold px-3 py-2 rounded-xl flex items-center justify-center text-xs whitespace-nowrap border border-emerald-200 transition"
                >
                  <Locate className="w-4 h-4 mr-1" /> Lacak GPS
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Rumah warna hijau depan Musholla"
                className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-semibold"
              />
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-1 gap-2">
                {storeSettings.payment_cod_active !== false && (
                  <label className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_method"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <HandCoins className="w-4 h-4 text-emerald-500" /> Bayar di Tempat (COD)
                      </span>
                    </div>
                  </label>
                )}

                {storeSettings.payment_qris_active && (
                  <label className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_method"
                        value="qris"
                        checked={paymentMethod === 'qris'}
                        onChange={() => setPaymentMethod('qris')}
                        className="text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-emerald-500" /> Scan QRIS Statis
                      </span>
                    </div>
                  </label>
                )}

                {storeSettings.payment_dana_active && (
                  <label className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_method"
                        value="dana"
                        checked={paymentMethod === 'dana'}
                        onChange={() => setPaymentMethod('dana')}
                        className="text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-emerald-500" /> Dompet DANA
                      </span>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {paymentMethod === 'cod' && (
              <div className="bg-slate-50 rounded-2xl p-3.5 text-xs space-y-2 border border-slate-100 shadow-inner">
                <div className="flex items-center gap-1.5 text-slate-700 font-extrabold text-xs">
                  <HandCoins className="w-4 h-4 text-emerald-600" />
                  <span>Instruksi Pembayaran Tunai (COD):</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  {storeSettings.payment_cod_note || 'Harap siapkan uang tunai pas saat kurir mengantar pesanan Anda.'}
                </p>
              </div>
            )}

            {paymentMethod === 'qris' && (
              <div className="bg-slate-50 rounded-2xl p-3.5 text-xs space-y-2 border border-slate-100 shadow-inner text-center">
                <div className="flex items-center gap-1.5 text-slate-700 font-extrabold text-xs text-left mb-1">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>Scan QRIS Resmi Asyifa Mart:</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold text-left mb-2">
                  Silakan simpan gambar QRIS di bawah ini untuk dipindai melalui aplikasi e-wallet Anda:
                </p>
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-100 shadow-xs max-w-[160px] mx-auto">
                  <img
                    src={storeSettings.payment_qris_image}
                    className="w-full h-auto object-contain rounded-lg"
                    alt="QRIS Barcode"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/150x150/10b981/ffffff?text=QRIS+Toko';
                    }}
                  />
                  <a
                    href={storeSettings.payment_qris_image || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] font-black text-emerald-600 uppercase mt-2 hover:underline"
                  >
                    Unduh Barcode
                  </a>
                </div>
              </div>
            )}

            {paymentMethod === 'dana' && (
              <div className="bg-slate-50 rounded-2xl p-3.5 text-xs space-y-2 border border-slate-100 shadow-inner">
                <div className="flex items-center gap-1.5 text-slate-700 font-extrabold text-xs">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>Transfer Instan Rekening DANA:</span>
                </div>
                <div className="text-slate-600 space-y-1 mt-2">
                  <p className="text-[10px] font-semibold">Kirim pembayaran saldo DANA Anda ke nomor resmi berikut:</p>
                  <p className="font-mono text-sm font-black bg-white px-3 py-2 rounded-xl border border-slate-100 text-emerald-600 text-center select-all tracking-wider">
                    {storeSettings.payment_dana_number || '-'}
                  </p>
                  <p className="text-[9px] text-slate-400 text-center">
                    Atas Nama Rekening: <span className="font-extrabold text-slate-700">{storeSettings.payment_dana_name || '-'}</span>
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isOutOfDeliveryRange}
              className={`w-full font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition duration-150 text-xs uppercase tracking-wider mt-4 ${
                isOutOfDeliveryRange
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{isOutOfDeliveryRange ? 'Di Luar Area Layanan' : 'Kirim Pesanan ke WhatsApp'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
