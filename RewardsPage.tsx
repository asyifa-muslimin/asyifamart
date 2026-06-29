import React from 'react';
import { Coins, Gift, PackageX, Clock, CheckCircle2, Truck, XCircle } from 'lucide-react';
import { Reward, RewardRedemption, User } from '../types';

interface RewardsPageProps {
  currentUser: User | null;
  rewards: Reward[];
  redemptions: RewardRedemption[];
  onRedeem: (reward: Reward) => void;
  onBackToHome: () => void;
}

const MINIMAL_KOIN_TUKAR = 100;

const formatRupiah = (num: number) => new Intl.NumberFormat('id-ID').format(num);

const statusBadge: Record<RewardRedemption['status'], { label: string; className: string; icon: React.ReactNode }> = {
  Menunggu: {
    label: 'Menunggu Diproses',
    className: 'bg-amber-50 text-amber-600 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  Diproses: {
    label: 'Sedang Diproses',
    className: 'bg-blue-50 text-blue-600 border-blue-200',
    icon: <Truck className="w-3 h-3" />,
  },
  Terkirim: {
    label: 'Hadiah Terkirim',
    className: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  Dibatalkan: {
    label: 'Dibatalkan',
    className: 'bg-red-50 text-red-600 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
  },
};

export const RewardsPage: React.FC<RewardsPageProps> = ({
  currentUser,
  rewards,
  redemptions,
  onRedeem,
  onBackToHome,
}) => {
  if (!currentUser) {
    return (
      <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl custom-shadow">
        <Coins className="w-16 h-16 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-bold">Masuk Akun untuk Lihat Koin Anda</p>
        <p className="text-xs text-slate-400 mt-1">Kumpulkan koin setiap belanja minimal Rp35.000.</p>
        <button
          type="button"
          onClick={onBackToHome}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl mt-4 inline-block uppercase tracking-wider transition"
        >
          Kembali Belanja
        </button>
      </div>
    );
  }

  const saldoKoin = currentUser.koin || 0;
  const aktifRewards = rewards.filter((r) => r.aktif);

  return (
    <div className="space-y-6">
      {/* Saldo Koin */}
      <div className="bg-gradient-to-tr from-amber-400 via-amber-500 to-orange-500 rounded-3xl p-6 text-white shadow-lg shadow-amber-500/20 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 opacity-20">
          <Coins className="w-32 h-32" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">Saldo Koin Anda</p>
        <h2 className="text-4xl font-black mt-1 flex items-center gap-2">
          {saldoKoin} <span className="text-lg font-bold opacity-80">koin</span>
        </h2>
        <p className="text-[11px] mt-2 opacity-90">
          Setiap belanja Rp35.000 = 1 koin. Tukar minimal {MINIMAL_KOIN_TUKAR} koin untuk hadiah menarik!
        </p>
      </div>

      {/* Katalog Hadiah */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 mb-3">
          <Gift className="w-4 h-4 text-emerald-600" /> Tukar Koin dengan Hadiah
        </h3>

        {aktifRewards.length === 0 ? (
          <div className="text-center py-10 bg-white border border-slate-100 rounded-2xl">
            <PackageX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-semibold">Belum ada hadiah yang tersedia saat ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {aktifRewards.map((reward) => {
              const cukupKoin = saldoKoin >= reward.biaya_koin;
              const stokHabis = reward.stok <= 0;
              const bisaDitukar = cukupKoin && !stokHabis;

              return (
                <div
                  key={reward.id}
                  className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs flex flex-col p-3"
                >
                  <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2">
                    <img
                      src={reward.foto || 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&w=300&q=80'}
                      className="w-full h-full object-cover"
                      alt={reward.nama_hadiah}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/300x300/e2e8f0/64748b?text=Hadiah';
                      }}
                    />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-xs line-clamp-2 min-h-[2.5rem] tracking-tight leading-tight">
                    {reward.nama_hadiah}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {stokHabis ? 'Stok habis' : `Stok: ${reward.stok}`}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5 mb-2">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-sm font-black text-amber-600">{reward.biaya_koin} koin</span>
                  </div>
                  <button
                    type="button"
                    disabled={!bisaDitukar}
                    onClick={() => onRedeem(reward)}
                    className={`mt-auto w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                      bisaDitukar
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {stokHabis ? 'Stok Habis' : bisaDitukar ? 'Tukar Sekarang' : 'Koin Kurang'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Riwayat Penukaran */}
      {redemptions.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-3">Riwayat Penukaran</h3>
          <div className="space-y-2.5">
            {redemptions.map((r) => {
              const badge = statusBadge[r.status];
              return (
                <div
                  key={r.id}
                  className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-800 text-xs">{r.nama_hadiah}</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-'} &middot; -{r.koin_terpakai} koin
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap ${badge.className}`}
                  >
                    {badge.icon} {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
