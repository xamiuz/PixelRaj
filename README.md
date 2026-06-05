# PixelRaj - Premium Pixel Art Editor 🎨

PixelRaj adalah platform editor *pixel art* kolaboratif berbasis web yang didesain secara modern dan interaktif. Dibangun dengan ekosistem **Svelte + Vite** untuk performa instan (tanpa *lag* saat memproses grid piksel dalam jumlah besar) serta ditenagai oleh **Supabase** untuk sinkronisasi menggambar *real-time* dengan seniman lain di seluruh dunia.

## ✨ Fitur Unggulan

* **Antarmuka Premium & Dinamis:** Desain UI/UX kelas atas ala *glassmorphism* dan animasi interaktif pada mode *desktop* maupun *mobile*.
* **Kolaborasi Real-Time:** Gambar secara bersamaan di kanvas yang sama berkat fitur *Broadcast* WebSocket dari Supabase.
* **Fitur Alat (Tools) Lengkap:**
  * ✏️ **Pencil & Eraser:** Alat gambar dasar dengan akurasi vektor 1:1 tanpa *blur/anti-aliasing*.
  * 🪣 **Paint Bucket (Fill):** Mewarnai area tertutup dengan algoritma *flood-fill* instan.
  * 📏 **Shape Tools:** Menggambar Garis, Persegi, dan Lingkaran secara presisi.
* **Sistem Manajemen Proyek:** Simpan ke *cloud* atau ekspor ke berkas biner `.bin` khusus PixelRaj. Terdapat fitur *password-protection* (Proteksi Kata Sandi) untuk proyek premium.
* **Fitur Animasi (Animator Panel):** Buat animasi *frame-by-frame* dan langsung saksikan *preview*-nya (mendukung pengaturan FPS & Onion Skinning).
* **Responsif Sepenuhnya:** Tampilan Kanvas dan *tools* yang disesuaikan (*mobile-friendly*) untuk layar sentuh Android/iOS.

## 🚀 Panduan Memulai Cepat (Lokal)

1. **Pasang Dependensi:**
   Pastikan Anda telah memasang [Node.js](https://nodejs.org/). Di terminal Anda, jalankan:
   ```bash
   npm install
   ```

2. **Pengaturan Database Supabase:**
   * Buat proyek baru di [Supabase](https://supabase.com).
   * Salin skrip dari berkas `supabase_setup.sql` dan eksekusi pada *SQL Editor* Supabase Anda untuk membuat tabel dan fungsi keamanan dasar (RLS).
   * Dapatkan `URL` dan `anon_key` Supabase Anda.

3. **Konfigurasi Lingkungan (.env):**
   Buat berkas `.env` di *root* proyek (sejajar dengan `package.json`) dan isi kredensial Anda:
   ```env
   VITE_SUPABASE_URL=URL_SUPABASE_ANDA
   VITE_SUPABASE_ANON_KEY=ANON_KEY_SUPABASE_ANDA
   ```

4. **Jalankan *Development Server*:**
   ```bash
   npm run dev
   ```
   Buka peramban (*browser*) Anda ke alamat `http://localhost:5173`.

## 🛡️ Keamanan (Security)

Sistem ini dirancang tanpa server (*serverless*) secara langsung dengan akses langsung ke *database* via Supabase. Keamanan terjamin melalui:
* **Row Level Security (RLS):** Kebijakan pembatasan modifikasi dan akses data per kanvas/proyek.
* **Validasi *Payload* Otomatis:** Menangkal injeksi dengan ukuran *grid* ketat (contoh: persis 4096 piksel untuk 64x64).

## 🌍 Cara *Deploy* (Publikasi)

Proyek ini teroptimasi penuh untuk dideploy di **Vercel**.
Hanya perlu menggunakan Vercel CLI atau sambungkan *repository* Github ini ke *dashboard* Vercel:
```bash
npx vercel --prod
```
Pastikan Anda sudah menempelkan *Environment Variables* (Supabase URL & Key) di pengaturan proyek Vercel Anda.

---
**Dibuat dengan ❤️ untuk Seniman Piksel**