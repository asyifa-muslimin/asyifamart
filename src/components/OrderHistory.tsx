import React from 'react';
import { Receipt, Printer, ExternalLink } from 'lucide-react';
import { Order } from '../types';

interface OrderHistoryProps {
  orders: Order[];
  onPrintReceipt: (orderId: number) => void;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => Promise<boolean>;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({
  orders,
  onPrintReceipt,
  notificationPermission,
  onRequestNotificationPermission,
}) => {
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Selesai':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Baru':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Dibatalkan':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  };

  const formatAddressWithMap = (address: string) => {
    if (!address) return '-';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = address.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg mt-1 w-fit"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Peta Kurir
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderNotificationBanner = () => {
    if (notificationPermission === 'granted') {
      return (
        <div className="bg-emerald-50/50 border border-emerald-150 rounded-3xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white p-2 rounded-xl flex items-center justify-center">
              <span className="text-sm">🔔</span>
            </div>
            <div>
              <h4 className="font-black text-slate-800 text-[11px] leading-none">Notifikasi Pesanan Aktif</h4>
              <p className="text-[10px] text-slate-500 mt-1">Anda akan menerima pemberitahuan instan saat status pesanan berubah.</p>
            </div>
          </div>
          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2.5 py-1 rounded-full border border-emerald-200">
            AKTIF
          </span>
        </div>
      );
    }

    if (notificationPermission === 'denied') {
      return (
        <div className="bg-rose-50 border border-rose-150 rounded-3xl p-4 flex items-center gap-3 shadow-xs">
          <div className="bg-rose-500 text-white p-2 rounded-xl flex items-center justify-center">
            <span className="text-sm">🔕</span>
          </div>
          <div>
            <h4 className="font-black text-slate-800 text-[11px] leading-none">Notifikasi Diblokir</h4>
            <p className="text-[10px] text-slate-500 mt-1">
              Silakan aktifkan izin notifikasi di setelan browser Anda untuk mendapatkan info pesanan real-time.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white border border-emerald-100 rounded-3xl p-5 shadow-xs space-y-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-bl-full pointer-events-none" />
        
        <div className="flex items-start gap-3.5">
          <div className="bg-emerald-500 text-white p-2.5 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <span className="text-base">🔔</span>
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-slate-800 text-xs tracking-tight">Aktifkan Notifikasi Status Pesanan!</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dapatkan info real-time saat pesanan Anda dikemas, <strong className="text-emerald-600 font-bold">Sedang Dikirim 🚚</strong>, atau telah selesai.
            </p>
          </div>
        </div>
        
        <button
          type="button"
          onClick={onRequestNotificationPermission}
          className="w-full text-[11px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 rounded-2xl transition duration-150 shadow-md shadow-emerald-500/15 flex items-center justify-center gap-1.5"
        >
          Aktifkan Sekarang
        </button>
      </div>
    );
  };

  if (orders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {renderNotificationBanner()}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center custom-shadow">
          <Receipt className="w-16 h-16 text-slate-200 mx-auto mb-3" />
          <p className="font-extrabold text-slate-800 text-sm">Belum Ada Transaksi</p>
          <p className="text-xs text-slate-400 mt-1">Anda belum melakukan pemesanan sembako apapun.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mb-6 flex items-center gap-2">
        <Receipt className="w-6 h-6 text-emerald-600" /> Riwayat Belanja Anda
      </h2>

      {renderNotificationBanner()}

      {orders.map((order) => (
        <div key={order.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <p className="text-[9px] text-slate-400 font-bold">
                {order.created_at ? new Date(order.created_at).toLocaleDateString('id-ID') : '-'}
              </p>
              <h4 className="font-black text-slate-800 text-xs mt-0.5">{order.kode_order}</h4>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPrintReceipt(order.id)}
                className="text-[10px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-100 transition flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Struk
              </button>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${getStatusStyle(order.status)}`}>
                {order.status}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-slate-500">
            <div className="leading-relaxed">
              <span className="text-slate-400 font-semibold block mb-0.5">Alamat Pengantaran:</span>
              <div className="font-bold text-slate-700 whitespace-pre-line">
                {formatAddressWithMap(order.alamat)}
              </div>
            </div>
            <p className="pt-2 border-t border-slate-50">
              Total Belanja: <span className="font-black text-emerald-600 text-xs">Rp {formatRupiah(order.total)}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
