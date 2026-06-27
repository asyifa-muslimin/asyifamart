// escpos.ts
//
// Builder perintah ESC/POS untuk printer thermal (mendukung lebar 58mm & 80mm).
// ESC/POS adalah bahasa perintah standar yang dipahami hampir semua printer
// struk thermal (Epson, Xprinter, EC Line, dll). Modul ini hanya menyusun
// array byte (Uint8Array) — pengiriman byte ke printer fisik dilakukan oleh
// qzTray.ts, bukan oleh modul ini.
//
// Referensi dasar perintah: https://reference.epson-biz.com/modules/ref_escpos/

import { Order, StoreSettings } from '../types';

// --- Perintah ESC/POS dasar ---
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40], // Reset printer ke kondisi awal
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_ON: [GS, 0x21, 0x11], // Lebar & tinggi 2x (untuk judul/total)
  DOUBLE_OFF: [GS, 0x21, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  FEED_LINE: [0x0a],
  CUT_PARTIAL: [GS, 0x56, 0x01], // Potong sebagian (sobek manual lebih mudah)
  CUT_FULL: [GS, 0x56, 0x00],
};

// Lebar struk dalam jumlah karakter font normal (font A, 12x24 / 9x17 dot)
const WIDTH_CHARS: Record<'58mm' | '80mm', number> = {
  '58mm': 32,
  '80mm': 48,
};

export class EscPosBuilder {
  private bytes: number[] = [];
  private width: number;

  constructor(lebar: '58mm' | '80mm' = '58mm') {
    this.width = WIDTH_CHARS[lebar] ?? 32;
    this.push(CMD.INIT);
  }

  private push(arr: number[]) {
    this.bytes.push(...arr);
  }

  private text(str: string) {
    // Encode sebagai bytes. Printer thermal umumnya pakai code page tertentu
    // (mis. CP437/CP1252); untuk karakter dasar ASCII + Rupiah, encoding UTF-8
    // sederhana sudah cukup untuk mayoritas printer modern (Xprinter, EC Line, dst).
    const encoder = new TextEncoder();
    this.bytes.push(...Array.from(encoder.encode(str)));
  }

  line(str = '') {
    this.text(str);
    this.push(CMD.FEED_LINE);
    return this;
  }

  divider(char = '-') {
    this.line(char.repeat(this.width));
    return this;
  }

  center(str: string) {
    this.push(CMD.ALIGN_CENTER);
    this.line(str);
    this.push(CMD.ALIGN_LEFT);
    return this;
  }

  bold(str: string) {
    this.push(CMD.BOLD_ON);
    this.line(str);
    this.push(CMD.BOLD_OFF);
    return this;
  }

  big(str: string) {
    this.push(CMD.DOUBLE_ON);
    this.push(CMD.BOLD_ON);
    this.line(str);
    this.push(CMD.BOLD_OFF);
    this.push(CMD.DOUBLE_OFF);
    return this;
  }

  // Dua kolom rata kiri-kanan dalam satu baris (mis. "Subtotal" ... "Rp 10.000")
  twoCols(left: string, right: string) {
    const space = Math.max(1, this.width - left.length - right.length);
    this.line(`${left}${' '.repeat(space)}${right}`);
    return this;
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) this.push(CMD.FEED_LINE);
    return this;
  }

  cut(partial = true) {
    this.push(partial ? CMD.CUT_PARTIAL : CMD.CUT_FULL);
    return this;
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  // QZ Tray menerima base64 untuk data biner mentah (raw command).
  toBase64(): string {
    const bytes = this.toBytes();
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
}

const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID').format(n);

/**
 * Susun struk ESC/POS lengkap dari satu Order + StoreSettings, format yang
 * sama dengan generateReceiptText() di AdminPanel tapi dikompilasi jadi
 * perintah biner ESC/POS asli (bold, center, cut) bukan sekadar teks polos.
 */
export function buildReceiptEscPos(order: Order, settings: StoreSettings): Uint8Array {
  const lebar = settings.struk_lebar || '58mm';
  const b = new EscPosBuilder(lebar);

  b.center(settings.nama_toko || 'TOKO');
  if (settings.struk_show_alamat !== false && settings.alamat) {
    b.center(settings.alamat);
  }
  if (settings.struk_show_kontak !== false && settings.whatsapp) {
    b.center(`WA: ${settings.whatsapp}`);
  }
  b.divider('=');

  if (settings.struk_header) {
    b.center(settings.struk_header);
    b.divider();
  }

  b.line(`Kode  : ${order.kode_order}`);
  b.line(`Nama  : ${order.nama_pembeli}`);
  if (settings.struk_show_waktu !== false) {
    b.line(`Waktu : ${new Date(order.created_at || new Date()).toLocaleString('id-ID')}`);
  }
  b.divider();

  let subtotal = 0;
  (order.items || []).forEach((item) => {
    const lineTotal = item.qty * item.harga;
    subtotal += lineTotal;
    b.line(`${item.nama_produk} (${item.nama_varian})`);
    b.twoCols(`${item.qty} x Rp ${formatRupiah(item.harga)}`, `Rp ${formatRupiah(lineTotal)}`);
  });

  b.divider();
  const ongkir = order.total - subtotal;
  if (ongkir > 0) {
    b.twoCols('Subtotal', `Rp ${formatRupiah(subtotal)}`);
    b.twoCols('Ongkir', `Rp ${formatRupiah(ongkir)}`);
    b.divider();
  }
  b.big(`TOTAL: Rp ${formatRupiah(order.total)}`);
  b.divider('=');

  if (settings.struk_footer) {
    b.center(settings.struk_footer);
  } else {
    b.center('Terima Kasih!');
  }

  b.feed(3);
  b.cut(true);

  return b.toBytes();
}
