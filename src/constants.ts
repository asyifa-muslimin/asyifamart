// Konstanta yang dipakai bersama oleh App.tsx dan komponen-komponennya.
// Dipisah ke file sendiri (bukan diekspor langsung dari App.tsx) supaya
// tidak terjadi circular import (App.tsx mengimpor AdminPanel.tsx/
// RewardsPage.tsx, dan kalau komponen itu balik mengimpor dari App.tsx,
// itu bisa bermasalah saat module dimuat duluan oleh bundler).

// Minimal koin yang dibutuhkan supaya sebuah hadiah bisa ditukar. Ini aturan
// per-hadiah (tiap hadiah punya biaya_koin masing-masing yang harus >= nilai
// ini), bukan saldo minimal global -- nilai ini cuma batas bawah saat admin
// membuat/mengedit hadiah baru, supaya tidak ada hadiah dengan biaya koin
// terlalu kecil/tidak masuk akal.
export const MINIMAL_KOIN_TUKAR = 25;
