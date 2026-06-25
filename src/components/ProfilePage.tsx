import React, { useState } from 'react';
import { User, Locate, MapPin, ExternalLink } from 'lucide-react';
import { User as UserType } from '../types';

interface ProfilePageProps {
  currentUser: UserType | null;
  onLogin: (email: string) => Promise<void>;
  onRegister: (data: {
    nama: string;
    email: string;
    whatsapp: string;
    alamat: string;
    mapsUrl: string;
  }) => Promise<void>;
  onLogout: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  onLogin,
  onRegister,
  onLogout,
  showToast,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  
  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWa, setRegWa] = useState('');
  const [regAlamat, setRegAlamat] = useState('');
  const [regMaps, setRegMaps] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    await onLogin(loginEmail.trim());
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regWa.trim() || !regAlamat.trim()) {
      showToast('Harap isi semua kolom wajib!', 'warning');
      return;
    }
    await onRegister({
      nama: regName.trim(),
      email: regEmail.trim(),
      whatsapp: regWa.trim(),
      alamat: regAlamat.trim(),
      mapsUrl: regMaps.trim(),
    });
  };

  const handleLacakGps = () => {
    if (navigator.geolocation) {
      showToast('Melacak koordinat GPS handphone Anda...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setRegMaps(`https://www.google.com/maps?q=${lat},${lon}`);
          showToast('Koordinat GPS berhasil diperoleh!', 'success');
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

  if (currentUser) {
    const initial = currentUser.nama ? currentUser.nama.charAt(0).toUpperCase() : 'U';
    const dateFormatted = currentUser.created_at
      ? new Date(currentUser.created_at).toLocaleDateString('id-ID')
      : '-';

    return (
      <div className="max-w-md mx-auto bg-white border border-slate-100 rounded-3xl p-6 custom-shadow space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500 text-white text-lg font-black flex items-center justify-center">
            {initial}
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">{currentUser.nama}</h3>
            <p className="text-xs text-slate-400">{currentUser.email}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">No. WhatsApp Terdaftar</span>
            <span className="font-bold text-slate-800">{currentUser.whatsapp || '-'}</span>
          </div>
          <div className="flex flex-col text-xs gap-1 py-1 border-t border-b border-slate-50">
            <span className="text-slate-500">Alamat Terdaftar</span>
            <span className="font-bold text-slate-800 leading-relaxed">
              {currentUser.alamat || 'Belum melengkapi alamat'}
            </span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <span className="text-slate-500">Titik Koordinat GPS</span>
            <span className="font-bold text-emerald-600">
              {currentUser.google_maps ? (
                <a
                  href={currentUser.google_maps}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Lihat Peta
                </a>
              ) : (
                '-'
              )}
            </span>
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-slate-500">Terdaftar Sejak</span>
            <span className="font-bold text-slate-800">{dateFormatted}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-4 rounded-xl text-xs transition"
        >
          Log Out Akun
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white border border-slate-100 rounded-3xl p-6 custom-shadow">
      <div className="flex justify-around mb-6 border-b border-slate-100 pb-1">
        <button
          type="button"
          onClick={() => setAuthTab('login')}
          className={`font-bold pb-2 px-4 text-xs ${
            authTab === 'login' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-400'
          }`}
        >
          Masuk
        </button>
        <button
          type="button"
          onClick={() => setAuthTab('register')}
          className={`font-semibold pb-2 px-4 text-xs ${
            authTab === 'register' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-400'
          }`}
        >
          Daftar
        </button>
      </div>

      {authTab === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Email Pengguna</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              placeholder="Contoh: user@asyifamart.com"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 text-xs bg-slate-50"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs transition"
          >
            Masuk Akun
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 text-xs bg-slate-50 font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Email Aktif</label>
            <input
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 text-xs bg-slate-50 font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">No. WhatsApp</label>
            <input
              type="tel"
              value={regWa}
              onChange={(e) => setRegWa(e.target.value)}
              required
              placeholder="Contoh: 0812345..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 text-xs bg-slate-50 font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Alamat Lengkap</label>
            <textarea
              value={regAlamat}
              onChange={(e) => setRegAlamat(e.target.value)}
              required
              rows={2}
              placeholder="Nama Jalan, RT/RW, Blok, Desa, Kecamatan..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500 text-xs bg-slate-50 font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1 text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Titik Lokasi Google Maps</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={regMaps}
                onChange={(e) => setRegMaps(e.target.value)}
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
          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs transition"
          >
            Daftar Akun Baru
          </button>
        </form>
      )}
    </div>
  );
};
