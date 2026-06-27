// migrate-photos-to-storage.mjs
//
// Skrip migrasi SEKALI JALAN: memindahkan foto yang masih tersimpan sebagai
// base64 di kolom database (products.foto, banners.gambar,
// store_settings.payment_qris_image) ke Supabase Storage, lalu mengganti
// nilai kolom tersebut jadi URL publik.
//
// SYARAT SEBELUM MENJALANKAN:
// 1. Bucket Storage "product-photos" sudah dibuat di Dashboard Supabase
//    (Storage -> New bucket -> nama "product-photos" -> centang "Public bucket").
// 2. Jalankan dari root folder project: `node migrate-photos-to-storage.mjs`
//    (butuh Node.js 18+ untuk dukungan fetch/Buffer bawaan).
//
// Skrip ini AMAN dijalankan berulang kali — foto yang sudah berupa URL
// (bukan base64) akan dilewati begitu saja, tidak diunggah ulang.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://otttejogcuuvhfbesjac.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dHRlam9nY3V1dmhmYmVzamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzM5NDQsImV4cCI6MjA5NzI0OTk0NH0.jdo5RfNOhRhJP3_J3_jiQZgStwmWmT_UyXBLz2fIYlk';

const BUCKET = 'product-photos';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function isBase64Image(str) {
  return typeof str === 'string' && str.startsWith('data:');
}

function base64ToBuffer(dataUrl) {
  const matches = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!matches) return null;
  const mime = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = mime.split('/')[1]?.split('+')[0] || 'jpg';
  return { buffer, mime, ext };
}

async function uploadBase64ToStorage(dataUrl, filenamePrefix) {
  const parsed = base64ToBuffer(dataUrl);
  if (!parsed) return null;

  const filePath = `${filenamePrefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}.${parsed.ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, parsed.buffer, { contentType: parsed.mime, upsert: false });

  if (uploadError) {
    console.error(`  Gagal upload ${filenamePrefix}:`, uploadError.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || null;
}

async function migrateProducts() {
  console.log('\n=== Migrasi foto produk (tabel products) ===');
  const { data: products, error } = await supabase.from('products').select('id, nama_produk, foto');
  if (error) {
    console.error('Gagal mengambil data products:', error.message);
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const product of products || []) {
    if (!isBase64Image(product.foto)) {
      skipped++;
      continue;
    }

    console.log(`Mengunggah foto untuk: ${product.nama_produk} (id=${product.id})...`);
    const publicUrl = await uploadBase64ToStorage(product.foto, `product_${product.id}`);

    if (publicUrl) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ foto: publicUrl })
        .eq('id', product.id);

      if (updateError) {
        console.error(`  Gagal update kolom foto untuk id=${product.id}:`, updateError.message);
      } else {
        console.log(`  OK -> ${publicUrl}`);
        migrated++;
      }
    }
  }

  console.log(`Selesai: ${migrated} foto dimigrasikan, ${skipped} sudah berupa URL (dilewati).`);
}

async function migrateBanners() {
  console.log('\n=== Migrasi foto banner (tabel banners) ===');
  const { data: banners, error } = await supabase.from('banners').select('id, judul, gambar');
  if (error) {
    console.error('Gagal mengambil data banners:', error.message);
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const banner of banners || []) {
    if (!isBase64Image(banner.gambar)) {
      skipped++;
      continue;
    }

    console.log(`Mengunggah banner: ${banner.judul} (id=${banner.id})...`);
    const publicUrl = await uploadBase64ToStorage(banner.gambar, `banner_${banner.id}`);

    if (publicUrl) {
      const { error: updateError } = await supabase
        .from('banners')
        .update({ gambar: publicUrl })
        .eq('id', banner.id);

      if (updateError) {
        console.error(`  Gagal update kolom gambar untuk id=${banner.id}:`, updateError.message);
      } else {
        console.log(`  OK -> ${publicUrl}`);
        migrated++;
      }
    }
  }

  console.log(`Selesai: ${migrated} banner dimigrasikan, ${skipped} sudah berupa URL (dilewati).`);
}

async function migrateStoreSettingsQris() {
  console.log('\n=== Migrasi gambar QRIS (tabel store_settings) ===');
  const { data: settingsRows, error } = await supabase.from('store_settings').select('id, payment_qris_image');
  if (error) {
    console.error('Gagal mengambil data store_settings:', error.message);
    return;
  }

  for (const row of settingsRows || []) {
    if (!isBase64Image(row.payment_qris_image)) {
      console.log('QRIS sudah berupa URL atau kosong, dilewati.');
      continue;
    }

    console.log(`Mengunggah gambar QRIS (id=${row.id})...`);
    const publicUrl = await uploadBase64ToStorage(row.payment_qris_image, `qris_${row.id}`);

    if (publicUrl) {
      const { error: updateError } = await supabase
        .from('store_settings')
        .update({ payment_qris_image: publicUrl })
        .eq('id', row.id);

      if (updateError) {
        console.error('  Gagal update payment_qris_image:', updateError.message);
      } else {
        console.log(`  OK -> ${publicUrl}`);
      }
    }
  }
}

async function main() {
  console.log('Memulai migrasi foto base64 -> Supabase Storage...');
  console.log(`Bucket tujuan: "${BUCKET}"`);
  console.log('Pastikan bucket ini sudah dibuat & public di Dashboard Supabase sebelum lanjut.\n');

  await migrateProducts();
  await migrateBanners();
  await migrateStoreSettingsQris();

  console.log('\nMigrasi selesai. Cek aplikasi untuk memastikan semua foto masih tampil dengan benar.');
}

main().catch((err) => {
  console.error('Migrasi gagal total:', err);
  process.exit(1);
});
