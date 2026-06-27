// qzTray.ts
//
// Lapisan tipis di atas library `qz-tray` untuk:
// 1. Connect ke QZ Tray (software yang HARUS sudah terinstall & berjalan
//    di laptop/PC admin — https://qz.io/download/). QZ Tray bertindak
//    sebagai jembatan antara browser (yang tidak bisa akses port USB/Serial
//    secara langsung) dan printer thermal fisik.
// 2. List printer yang terdeteksi oleh OS (driver Windows/Mac/Linux).
// 3. Kirim data biner mentah (ESC/POS) ke printer yang dipilih.
//
// CATATAN PENTING soal sertifikat (signing):
// Tanpa sertifikat digital QZ Tray berbayar, browser akan tetap bisa connect
// dan print, TAPI setiap sesi koneksi akan memunculkan dialog "Allow/Block"
// di sisi aplikasi QZ Tray (bukan di web). Ini normal untuk pemakaian dasar/
// toko kecil. Untuk auto-print tanpa dialog apapun, toko perlu beli sertifikat
// signing dari QZ Industries dan setel qz.security.setCertificatePromise(...)
// & setSignaturePromise(...) — di luar lingkup modul ini, lihat README_PRINTER.md.

import qz from 'qz-tray';

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) return;
  // Tanpa sertifikat: gunakan promise resolver kosong/placeholder.
  // QZ Tray akan menampilkan dialog konfirmasi manual di sisi software-nya.
  qz.security.setCertificatePromise((resolve: (v: string) => void) => {
    resolve('');
  });
  qz.security.setSignaturePromise(() => (resolve: (v: string) => void) => {
    resolve('');
  });
  isConfigured = true;
}

export type QzConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Pastikan koneksi WebSocket ke QZ Tray aktif. Aman dipanggil berulang kali —
 * kalau sudah terhubung, langsung resolve tanpa connect ulang.
 */
export async function connectQzTray(): Promise<void> {
  ensureConfigured();
  if (qz.websocket.isActive()) return;
  await qz.websocket.connect();
}

export function disconnectQzTray(): Promise<void> {
  if (!qz.websocket.isActive()) return Promise.resolve();
  return qz.websocket.disconnect();
}

export function isQzConnected(): boolean {
  try {
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

/**
 * Ambil daftar nama printer yang terdeteksi sistem operasi (lewat driver
 * printer yang sudah terinstall di OS — sama seperti printer yang muncul
 * di dialog print biasa).
 */
export async function listPrinters(): Promise<string[]> {
  await connectQzTray();
  const printers = await qz.printers.find();
  // qz.printers.find() bisa mengembalikan string tunggal kalau hanya 1 printer
  return Array.isArray(printers) ? printers : [printers];
}

export async function getDefaultPrinter(): Promise<string | null> {
  await connectQzTray();
  try {
    const def = await qz.printers.getDefault();
    return def || null;
  } catch {
    return null;
  }
}

/**
 * Kirim byte ESC/POS mentah ke printer thermal yang dipilih.
 * `printerName` harus salah satu hasil dari listPrinters().
 */
export async function printRawEscPos(printerName: string, bytes: Uint8Array): Promise<void> {
  if (!printerName) {
    throw new Error('Nama printer belum dipilih. Buka Pengaturan > Printer Thermal untuk memilih printer.');
  }
  await connectQzTray();

  const config = qz.configs.create(printerName, {
    rasterize: false, // kirim sebagai raw command, bukan rasterisasi gambar
  });

  // qz-tray menerima base64 untuk data biner via tipe 'raw' + format 'base64'
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const data = [
    {
      type: 'raw',
      format: 'command',
      flavor: 'base64',
      data: base64,
    },
  ];

  await qz.print(config, data);
}
