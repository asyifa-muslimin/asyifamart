-- Migration: tambah kolom konfigurasi printer thermal ke store_settings
-- Aman dijalankan di database yang SUDAH ADA datanya (tidak memakai DROP TABLE).
-- Jalankan di Supabase SQL Editor.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS printer_thermal_nama VARCHAR(255),
  ADD COLUMN IF NOT EXISTS printer_auto_print_aktif BOOLEAN NOT NULL DEFAULT FALSE;
