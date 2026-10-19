// Element (block) definitions for the admin: picker info, form fields and defaults, plus normalisation of
// submitted props. One schema drives both the server-side validation and the generated forms in the admin.
import { sanitizeBlockText } from './sanitize.js';
import { LINK_TYPES, ICONS, waNumber } from '../blocks.js';
import { FONTS } from '../global.js';

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const numIn = (v, min, max, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Math.min(max, Math.max(min, Math.round(Number(v) * 10) / 10)) : d);
const hex = (v, d = '') => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : d);

const ICON_OPTS = Object.keys(ICONS).filter((k) => !['x', 'copy'].includes(k));
const TRACK = [['none', 'Tidak dilacak'], ['Lead', 'Lead'], ['Contact', 'Contact (chat)'], ['CompleteRegistration', 'Complete Registration'], ['InitiateCheckout', 'Mulai checkout'], ['AddToCart', 'Tambah ke keranjang'], ['Purchase', 'Pembelian'], ['ViewContent', 'Lihat konten']];
const ALIGN = [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']];

// Shared box fields (spacing + background) appended to most blocks.
const BOX = [
  { k: 'bg', t: 'color', label: 'Warna latar', optional: true, group: 'Tampilan' },
  { k: 'pt', t: 'number', label: 'Jarak atas', min: 0, max: 200, d: 12, unit: 'px', group: 'Tampilan' },
  { k: 'pb', t: 'number', label: 'Jarak bawah', min: 0, max: 200, d: 12, unit: 'px', group: 'Tampilan' },
  { k: 'px', t: 'number', label: 'Jarak samping', min: 0, max: 60, d: 16, unit: 'px', group: 'Tampilan' },
];

export const BLOCKS = {
  // ---- A. konten dasar
  text: { label: 'Teks', cat: 'Konten', icon: 'type', desc: 'Paragraf, judul, daftar — tanpa coding.', fields: [
    { k: 'html', t: 'rich', label: 'Isi teks', d: '<p>Tulis teks di sini…</p>' },
    { k: 'size', t: 'number', label: 'Ukuran huruf', min: 8, max: 48, d: 14, unit: 'px' },
    { k: 'align', t: 'select', label: 'Rata', options: ALIGN, d: 'left' },
    { k: 'color', t: 'color', label: 'Warna teks', optional: true },
    { k: 'font', t: 'font', label: 'Font', optional: true },
    { k: 'lineHeight', t: 'number', label: 'Jarak baris', min: 1, max: 2.4, step: 0.1, d: 1.5 },
    ...BOX] },
  button: { label: 'Tombol', cat: 'Konten', icon: 'button', desc: 'Ajakan klik: WhatsApp, CS Rotator, link, scroll.', fields: [
    { k: 'label', t: 'text', label: 'Teks tombol', max: 80, d: 'Chat Admin Sekarang' },
    { k: 'link', t: 'link', label: 'Tujuan', d: { type: 'wa', phone: '', message: 'Halo kak, saya mau tanya' } },
    { k: 'style', t: 'select', label: 'Gaya', options: [['fill', 'Penuh'], ['outline', 'Garis'], ['soft', 'Lembut']], d: 'fill' },
    { k: 'size', t: 'select', label: 'Ukuran', options: [['xs', 'Sangat kecil'], ['s', 'Kecil'], ['m', 'Sedang'], ['l', 'Besar']], d: 'l' },
    { k: 'width', t: 'select', label: 'Lebar', options: [['auto', 'Sesuai teks'], ['full', 'Penuh']], d: 'full' },
    { k: 'align', t: 'select', label: 'Posisi', options: ALIGN, d: 'center' },
    { k: 'icon', t: 'icon', label: 'Ikon', d: 'wa', none: true },
    { k: 'iconPos', t: 'select', label: 'Posisi ikon', options: [['left', 'Kiri'], ['right', 'Kanan']], d: 'left' },
    { k: 'color', t: 'color', label: 'Warna tombol', d: '#25d366' },
    { k: 'textColor', t: 'color', label: 'Warna teks', d: '#ffffff' },
    { k: 'radius', t: 'number', label: 'Sudut', min: 0, max: 40, d: 12, unit: 'px' },
    { k: 'anim', t: 'select', label: 'Animasi', options: [['none', 'Tanpa'], ['pulse', 'Berdenyut'], ['shake', 'Bergoyang']], d: 'none' },
    { k: 'track', t: 'select', label: 'Event iklan saat diklik', options: TRACK, d: 'Contact', group: 'Tracking' },
    ...BOX] },
  spacer: { label: 'Ruang Kosong', cat: 'Konten', icon: 'spacer', desc: 'Jarak kosong di antara bagian.', fields: [
    { k: 'h', t: 'number', label: 'Tinggi', min: 2, max: 400, d: 24, unit: 'px' },
    { k: 'bg', t: 'color', label: 'Warna latar', optional: true }] },
  divider: { label: 'Garis', cat: 'Konten', icon: 'divider', desc: 'Garis pemisah.', fields: [
    { k: 'style', t: 'select', label: 'Gaya', options: [['solid', 'Utuh'], ['dashed', 'Putus-putus'], ['dotted', 'Titik-titik']], d: 'solid' },
    { k: 'thickness', t: 'number', label: 'Tebal', min: 1, max: 8, d: 1, unit: 'px' },
    { k: 'width', t: 'number', label: 'Panjang', min: 10, max: 100, d: 100, unit: '%' },
    { k: 'color', t: 'color', label: 'Warna', d: '#e5d9da' },
    ...BOX] },
  quote: { label: 'Quote', cat: 'Konten', icon: 'quote', desc: 'Kutipan atau kata-kata pelanggan.', fields: [
    { k: 'text', t: 'textarea', label: 'Kutipan', max: 600, d: '“Kutipan yang menginspirasi.”' },
    { k: 'author', t: 'text', label: 'Nama / sumber', max: 120, d: '' },
    { k: 'style', t: 'select', label: 'Gaya', options: [['bar', 'Garis samping'], ['card', 'Kartu'], ['big', 'Besar']], d: 'bar' },
    { k: 'align', t: 'select', label: 'Rata', options: ALIGN, d: 'left' },
    { k: 'accent', t: 'color', label: 'Warna aksen', d: '#e3262f' },
    { k: 'color', t: 'color', label: 'Warna teks', optional: true },
    ...BOX] },

  // ---- B. media
  video: { label: 'Video YouTube', cat: 'Media', icon: 'video', desc: 'Diputar setelah diklik (halaman tetap cepat).', fields: [
    { k: 'url', t: 'text', label: 'Link YouTube', max: 300, d: '', hint: 'contoh: https://youtu.be/xxxxxxxxxxx' },
    { k: 'title', t: 'text', label: 'Judul', max: 120, d: 'Video' },
    { k: 'ratio', t: 'select', label: 'Bentuk', options: [['16:9', 'Lebar 16:9'], ['9:16', 'Tegak 9:16 (Shorts)'], ['4:5', 'Portrait 4:5'], ['1:1', 'Kotak 1:1']], d: '16:9' },
    { k: 'start', t: 'number', label: 'Mulai di detik', min: 0, max: 36000, d: 0 },
    ...BOX] },
  gallery: { label: 'Galeri Gambar', cat: 'Media', icon: 'gallery', desc: 'Kumpulan foto, bisa diperbesar.', fields: [
    { k: 'images', t: 'images', label: 'Gambar', max: 30, d: [] },
    { k: 'cols', t: 'select', label: 'Kolom', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], d: '2' },
    { k: 'gap', t: 'number', label: 'Jarak antar gambar', min: 0, max: 24, d: 6, unit: 'px' },
    { k: 'radius', t: 'number', label: 'Sudut', min: 0, max: 30, d: 8, unit: 'px' },
    { k: 'zoom', t: 'toggle', label: 'Klik untuk memperbesar', d: true },
    ...BOX] },
  imagetext: { label: 'Gambar + Teks', cat: 'Media', icon: 'imagetext', desc: 'Foto berdampingan dengan teks.', fields: [
    { k: 'image', t: 'image', label: 'Gambar', d: null },
    { k: 'html', t: 'rich', label: 'Teks', d: '<p><strong>Judul</strong></p><p>Penjelasan singkat.</p>' },
    { k: 'layout', t: 'select', label: 'Posisi gambar', options: [['top', 'Atas'], ['left', 'Kiri'], ['right', 'Kanan'], ['bottom', 'Bawah']], d: 'left' },
    { k: 'imgWidth', t: 'number', label: 'Lebar gambar (kiri/kanan)', min: 20, max: 70, d: 40, unit: '%' },
    { k: 'size', t: 'number', label: 'Ukuran huruf', min: 8, max: 32, d: 14, unit: 'px' },
    { k: 'align', t: 'select', label: 'Rata teks', options: ALIGN, d: 'left' },
    { k: 'color', t: 'color', label: 'Warna teks', optional: true },
    ...BOX] },

  banner: { label: 'Banner + Teks', cat: 'Media', icon: 'banner', desc: 'Gambar dengan judul & tombol asli di atasnya. Judul terbaca Google.', fields: [
    { k: 'image', t: 'image', label: 'Gambar latar', d: null },
    { k: 'eyebrow', t: 'text', label: 'Teks kecil di atas judul', max: 120, d: '' },
    { k: 'title', t: 'textarea', label: 'Judul (Enter = baris baru)', max: 200, d: 'Judul banner' },
    { k: 'text', t: 'textarea', label: 'Keterangan (opsional)', max: 400, d: '' },
    { k: 'descBold', t: 'toggle', label: 'Keterangan tebal', d: false },
    { k: 'font', t: 'font', label: 'Font', optional: true },
    { k: 'color', t: 'color', label: 'Warna teks', d: '#111111' },
    { k: 'titleSize', t: 'number', label: 'Ukuran judul', min: 6, max: 48, d: 14, step: 0.1, unit: 'px' },
    { k: 'eyebrowSize', t: 'number', label: 'Ukuran teks kecil', min: 5, max: 24, d: 8, step: 0.1, unit: 'px' },
    { k: 'titleLh', t: 'number', label: 'Jarak baris judul', min: 0.8, max: 2, step: 0.05, d: 1.2 },
    { k: 'gap', t: 'number', label: 'Jarak teks kecil ke judul', min: 0, max: 30, step: 0.1, d: 2, unit: 'px' },
    { k: 'align', t: 'select', label: 'Rata', options: ALIGN, d: 'left' },
    { k: 'button', t: 'group', label: 'Tombol', fields: [
      { k: 'label', t: 'text', label: 'Teks tombol (kosong = tanpa tombol)', max: 80 }, { k: 'link', t: 'link', label: 'Tujuan' },
      { k: 'style', t: 'select', label: 'Gaya', options: [['fill', 'Penuh'], ['outline', 'Garis'], ['soft', 'Lembut']] },
      { k: 'size', t: 'select', label: 'Ukuran', options: [['xs', 'Sangat kecil'], ['s', 'Kecil'], ['m', 'Sedang'], ['l', 'Besar']] },
      { k: 'color', t: 'color', label: 'Warna tombol' }, { k: 'textColor', t: 'color', label: 'Warna teks' },
      { k: 'radius', t: 'number', label: 'Sudut', min: 0, max: 40, unit: 'px' },
      { k: 'icon', t: 'icon', label: 'Ikon', none: true }, { k: 'iconPos', t: 'select', label: 'Posisi ikon', options: [['left', 'Kiri'], ['right', 'Kanan']] },
      { k: 'track', t: 'select', label: 'Event iklan saat diklik', options: TRACK }],
    d: { label: '', link: { type: 'none' }, style: 'outline', size: 'xs', color: '#111111', textColor: '#ffffff', radius: 4, icon: 'none', iconPos: 'right', track: 'none' } },
    { k: 'x', t: 'number', label: 'Teks: dari kiri', min: 0, max: 95, step: 0.1, d: 6, unit: '%', group: 'Posisi' },
    { k: 'y', t: 'number', label: 'Teks: dari atas', min: 0, max: 95, step: 0.1, d: 30, unit: '%', group: 'Posisi' },
    { k: 'w', t: 'number', label: 'Lebar area teks', min: 10, max: 100, step: 0.1, d: 55, unit: '%', group: 'Posisi' },
    { k: 'bx', t: 'number', label: 'Tombol: dari kiri', min: 0, max: 95, step: 0.1, d: 6, unit: '%', group: 'Posisi' },
    { k: 'by', t: 'number', label: 'Tombol: dari atas', min: 0, max: 98, step: 0.1, d: 75, unit: '%', group: 'Posisi' },
    { k: 'bg', t: 'color', label: 'Warna latar', optional: true, group: 'Tampilan' },
    { k: 'pt', t: 'number', label: 'Jarak atas', min: 0, max: 200, d: 0, unit: 'px', group: 'Tampilan' },
    { k: 'pb', t: 'number', label: 'Jarak bawah', min: 0, max: 200, d: 0, unit: 'px', group: 'Tampilan' },
    { k: 'px', t: 'number', label: 'Jarak samping', min: 0, max: 60, d: 0, unit: 'px', group: 'Tampilan' }] },

  // ---- C. jualan & kepercayaan
  faq: { label: 'FAQ', cat: 'Jualan', icon: 'faq', desc: 'Pertanyaan yang bisa dibuka-tutup.', fields: [
    { k: 'title', t: 'text', label: 'Judul', max: 120, d: 'Pertanyaan yang Sering Ditanyakan' },
    { k: 'items', t: 'items', label: 'Pertanyaan', max: 40, add: 'Tambah pertanyaan', fields: [
      { k: 'q', t: 'text', label: 'Pertanyaan', max: 200 }, { k: 'a', t: 'rich', label: 'Jawaban' }],
    d: [{ q: 'Apa itu Spencer’s MealBlend?', a: '<p>Jawaban singkat di sini.</p>' }] },
    { k: 'openFirst', t: 'toggle', label: 'Pertanyaan pertama terbuka', d: false },
    { k: 'style', t: 'select', label: 'Gaya', options: [['line', 'Garis'], ['box', 'Kotak']], d: 'line' },
    { k: 'headBg', t: 'color', label: 'Warna latar pertanyaan (gaya Kotak)', optional: true, showIf: ['style', 'box'] },
    { k: 'headColor', t: 'color', label: 'Warna teks pertanyaan (gaya Kotak)', optional: true, showIf: ['style', 'box'] },
    { k: 'size', t: 'number', label: 'Ukuran huruf', min: 10, max: 24, d: 14, unit: 'px' },
    { k: 'accent', t: 'color', label: 'Warna aksen', d: '#e3262f' },
    { k: 'color', t: 'color', label: 'Warna teks', optional: true },
    ...BOX] },
  testimonial: { label: 'Testimoni', cat: 'Jualan', icon: 'testi', desc: 'Kartu ulasan pelanggan dengan bintang.', fields: [
    { k: 'title', t: 'text', label: 'Judul', max: 120, d: 'Kata Mereka' },
    { k: 'items', t: 'items', label: 'Testimoni', max: 30, add: 'Tambah testimoni', fields: [
      { k: 'name', t: 'text', label: 'Nama', max: 80 }, { k: 'role', t: 'text', label: 'Kota / keterangan', max: 80 },
      { k: 'text', t: 'textarea', label: 'Isi', max: 600 }, { k: 'rating', t: 'number', label: 'Bintang', min: 0, max: 5, d: 5 },
      { k: 'photo', t: 'image', label: 'Foto (opsional)' }],
    d: [{ name: 'Nama Pelanggan', role: 'Surabaya', text: 'Ceritakan pengalaman pelanggan di sini.', rating: 5, photo: null }] },
    { k: 'layout', t: 'select', label: 'Tampilan', options: [['slider', 'Geser (slider)'], ['list', 'Daftar'], ['grid', '2 kolom']], d: 'slider' },
    { k: 'cardColor', t: 'color', label: 'Warna kartu', d: '#ffffff' },
    { k: 'textColor', t: 'color', label: 'Warna teks', d: '#2b1a1a' },
    { k: 'starColor', t: 'color', label: 'Warna bintang', d: '#f5a623' },
    ...BOX] },
  countdown: { label: 'Countdown Timer', cat: 'Jualan', icon: 'timer', desc: 'Hitung mundur — bisa otomatis ikut promo.', fields: [
    { k: 'mode', t: 'select', label: 'Berakhir', options: [['promo', 'Ikut tanggal selesai promo aktif'], ['date', 'Tanggal sendiri']], d: 'promo' },
    { k: 'end', t: 'datetime', label: 'Tanggal & jam selesai (WIB)', showIf: ['mode', 'date'] },
    { k: 'label', t: 'text', label: 'Teks di atas', max: 120, d: 'Promo berakhir dalam' },
    { k: 'expired', t: 'select', label: 'Setelah habis', options: [['hide', 'Sembunyikan'], ['text', 'Tampilkan teks']], d: 'hide' },
    { k: 'expiredText', t: 'text', label: 'Teks setelah habis', max: 120, d: 'Promo sudah berakhir', showIf: ['expired', 'text'] },
    { k: 'boxColor', t: 'color', label: 'Warna kotak', d: '#e3262f' },
    { k: 'textColor', t: 'color', label: 'Warna angka', d: '#ffffff' },
    { k: 'labelColor', t: 'color', label: 'Warna teks', d: '#2b1a1a' },
    ...BOX] },
  features: { label: 'Daftar Fitur', cat: 'Jualan', icon: 'list', desc: 'Keunggulan produk dengan ikon.', fields: [
    { k: 'title', t: 'text', label: 'Judul', max: 120, d: '' },
    { k: 'items', t: 'items', label: 'Poin', max: 24, add: 'Tambah poin', fields: [
      { k: 'icon', t: 'icon', label: 'Ikon' }, { k: 'title', t: 'text', label: 'Judul', max: 100 }, { k: 'text', t: 'text', label: 'Keterangan', max: 200 }],
    d: [{ icon: 'check', title: 'Tanpa gula tambahan', text: '' }, { icon: 'leaf', title: 'Bahan alami pilihan', text: '' }, { icon: 'shield', title: 'Halal & BPOM', text: '' }] },
    { k: 'cols', t: 'select', label: 'Kolom', options: [['1', '1'], ['2', '2']], d: '1' },
    { k: 'iconColor', t: 'color', label: 'Warna ikon', d: '#e3262f' },
    { k: 'iconBg', t: 'color', label: 'Latar ikon', d: '#fdeef0' },
    { k: 'color', t: 'color', label: 'Warna teks', optional: true },
    ...BOX] },
  copytext: { label: 'Copy Teks', cat: 'Jualan', icon: 'copytext', desc: 'Kode voucher dengan tombol Salin.', fields: [
    { k: 'label', t: 'text', label: 'Teks di atas', max: 120, d: 'Pakai kode voucher ini:' },
    { k: 'code', t: 'text', label: 'Kode / teks yang disalin', max: 200, d: 'MEALBLEND10' },
    { k: 'buttonLabel', t: 'text', label: 'Teks tombol', max: 30, d: 'Salin' },
    { k: 'accent', t: 'color', label: 'Warna aksen', d: '#e3262f' },
    ...BOX] },
  bank: { label: 'Daftar Rekening', cat: 'Jualan', icon: 'bank', desc: 'Nomor rekening dengan tombol Salin.', fields: [
    { k: 'title', t: 'text', label: 'Judul', max: 120, d: 'Transfer ke rekening resmi' },
    { k: 'items', t: 'items', label: 'Rekening', max: 10, add: 'Tambah rekening', fields: [
      { k: 'bank', t: 'text', label: 'Bank', max: 40 }, { k: 'number', t: 'text', label: 'Nomor rekening', max: 40 }, { k: 'holder', t: 'text', label: 'Atas nama', max: 80 }],
    d: [{ bank: 'BCA', number: '', holder: '' }] },
    { k: 'note', t: 'text', label: 'Catatan', max: 200, d: '' },
    { k: 'accent', t: 'color', label: 'Warna aksen', d: '#e3262f' },
    ...BOX] },

  distributors: { label: 'Daftar Distributor', cat: 'Jualan', icon: 'pin', desc: 'Distributor resmi per kota + kotak cari. Datanya dari menu Distributor.', fields: [
    { k: 'title', t: 'text', label: 'Judul', max: 120, d: '', hint: 'Isi daftar diatur di menu Distributor, bukan di sini.' },
    { k: 'search', t: 'toggle', label: 'Tampilkan kotak cari', d: true },
    { k: 'placeholder', t: 'text', label: 'Teks di kotak cari', max: 80, d: 'Cari kota atau provinsi…', showIf: ['search', true] },
    { k: 'group', t: 'select', label: 'Susunan', options: [['province', 'Per provinsi'], ['city', 'Kota saja (A–Z)']], d: 'province' },
    { k: 'emptyText', t: 'text', label: 'Pesan jika tidak ditemukan', max: 160, d: 'Belum ada distributor di daerah itu.' },
    { k: 'emptyLabel', t: 'text', label: 'Teks link bantuan', max: 40, d: 'Tanya admin' },
    { k: 'emptyLink', t: 'link', label: 'Link bantuan', d: { type: 'none' } },
    { k: 'size', t: 'number', label: 'Ukuran huruf', min: 8, max: 20, d: 11, unit: 'px' },
    { k: 'accent', t: 'color', label: 'Warna ikon +/−', d: '#000000' },
    { k: 'color', t: 'color', label: 'Warna teks', optional: true },
    ...BOX] },

  // ---- D. konversi
  floatwa: { label: 'Tombol WA Melayang', cat: 'Konversi', icon: 'wa', desc: 'Tombol WhatsApp di pojok layar.', fields: [
    { k: 'link', t: 'link', label: 'Tujuan', only: ['wa', 'rotator'], d: { type: 'wa', phone: '', message: 'Halo kak, saya mau tanya' } },
    { k: 'label', t: 'text', label: 'Teks (opsional)', max: 40, d: 'Chat Admin' },
    { k: 'position', t: 'select', label: 'Posisi', options: [['right', 'Kanan bawah'], ['left', 'Kiri bawah']], d: 'right' },
    { k: 'bottom', t: 'number', label: 'Jarak dari bawah', min: 8, max: 160, d: 20, unit: 'px' },
    { k: 'showAfter', t: 'number', label: 'Muncul setelah scroll', min: 0, max: 3000, d: 300, unit: 'px' },
    { k: 'color', t: 'color', label: 'Warna', d: '#25d366' },
    { k: 'track', t: 'select', label: 'Event iklan saat diklik', options: TRACK, d: 'Contact', group: 'Tracking' }] },
  popup: { label: 'Popup Promo', cat: 'Konversi', icon: 'popup', desc: 'Jendela promo yang muncul otomatis.', fields: [
    { k: 'image', t: 'image', label: 'Gambar', d: null },
    { k: 'title', t: 'text', label: 'Judul', max: 120, d: 'Promo Spesial Hari Ini' },
    { k: 'html', t: 'rich', label: 'Teks', d: '<p>Diskon khusus untuk kamu.</p>' },
    { k: 'button', t: 'group', label: 'Tombol', fields: [
      { k: 'label', t: 'text', label: 'Teks tombol', max: 80 }, { k: 'link', t: 'link', label: 'Tujuan' },
      { k: 'color', t: 'color', label: 'Warna tombol' }, { k: 'textColor', t: 'color', label: 'Warna teks' },
      { k: 'track', t: 'select', label: 'Event iklan', options: TRACK }],
    d: { label: 'Ambil Promo', link: { type: 'wa', phone: '', message: '' }, color: '#e3262f', textColor: '#ffffff', track: 'Lead' } },
    { k: 'trigger', t: 'select', label: 'Muncul', options: [['delay', 'Setelah beberapa detik'], ['scroll', 'Setelah scroll'], ['exit', 'Saat mau keluar (desktop)']], d: 'delay' },
    { k: 'delay', t: 'number', label: 'Detik', min: 0, max: 120, d: 5, showIf: ['trigger', 'delay'] },
    { k: 'scroll', t: 'number', label: 'Persen scroll', min: 5, max: 100, d: 50, unit: '%', showIf: ['trigger', 'scroll'] },
    { k: 'frequency', t: 'select', label: 'Seberapa sering', options: [['session', 'Sekali per kunjungan'], ['day', 'Sekali sehari'], ['always', 'Setiap buka halaman']], d: 'session' },
    { k: 'bg', t: 'color', label: 'Warna kartu', d: '#ffffff' }] },
};

/** Default props for a new block. */
export function blockDefaults(kind) {
  const out = {};
  for (const f of BLOCKS[kind].fields) if (f.d !== undefined) out[f.k] = structuredClone(f.d);
  return out;
}

// ---------------------------------------------------------------- normalisation
const ytId = (v) => {
  const s = String(v || '').trim();
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || s.match(/^([\w-]{11})$/);
  return m ? m[1] : '';
};

export function normalizeLink(v, only) {
  const l = v && typeof v === 'object' ? v : {};
  let type = LINK_TYPES.includes(l.type) ? l.type : 'none';
  if (only && type !== 'none' && !only.includes(type)) type = only[0];
  const out = { type };
  if (type === 'page') out.page = clip(l.page, 80).toLowerCase();
  if (type === 'url') out.url = /^https?:\/\//i.test(clip(l.url, 1000)) ? clip(l.url, 1000) : clip(l.url, 1000) ? `https://${clip(l.url, 990).replace(/^\/+/, '')}` : '';
  if (type === 'section') out.section = clip(l.section, 64).toLowerCase();
  if (type === 'wa' || type === 'tel') out.phone = waNumber(l.phone) ? clip(l.phone, 30) : clip(l.phone, 30).replace(/[^\d+\s-]/g, '');
  if (type === 'wa' || type === 'rotator') out.message = clip(l.message, 500);
  if (type === 'rotator') out.rotator = clip(l.rotator, 40).toLowerCase();
  if (type === 'email') { out.email = clip(l.email, 200); out.subject = clip(l.subject, 200); }
  if (type === 'file') out.file = /^\/uploads\/files\/[\w.-]+\.pdf$/.test(l.file || '') ? l.file : '';
  return out;
}
const imageIn = (v) => {
  if (!v || typeof v !== 'object' || !/^\/uploads\/[\w./-]+$/.test(v.src || '') || String(v.src).includes('..')) return null;
  const out = { src: v.src, iw: numIn(v.iw, 1, 20000, 0), ih: numIn(v.ih, 1, 20000, 0), alt: clip(v.alt, 300) };
  if (v.ext && /^(webp|png|jpe?g|gif|avif)$/i.test(v.ext)) out.ext = v.ext;
  return out;
};

function normField(f, v) {
  switch (f.t) {
    case 'text': return clip(v ?? f.d ?? '', f.max || 200);
    case 'textarea': return clip(v ?? f.d ?? '', f.max || 2000);
    case 'rich': return sanitizeBlockText(v ?? f.d ?? '');
    case 'number': return numIn(v, f.min ?? 0, f.max ?? 1000, f.d ?? 0);
    case 'color': return f.optional ? hex(v, '') : hex(v, f.d || '#000000');
    case 'select': { const ok = f.options.map((o) => o[0]); const s = String(v ?? ''); return ok.includes(s) ? s : (f.d ?? ok[0]); }
    case 'toggle': return v === undefined ? Boolean(f.d) : v === true || v === 'true';
    case 'font': return Object.hasOwn(FONTS, v) ? v : '';
    case 'icon': return ICON_OPTS.includes(v) ? v : f.none && (v === 'none' || v === '') ? 'none' : (f.d || 'check');
    case 'link': return normalizeLink(v ?? f.d, f.only);
    case 'image': return imageIn(v);
    case 'images': return (Array.isArray(v) ? v : []).map(imageIn).filter(Boolean).slice(0, f.max || 30);
    case 'datetime': { const s = clip(v, 25); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s.length === 16 ? `${s}:00+07:00` : s)) ? (s.length === 16 ? `${s}:00+07:00` : s) : ''; }
    case 'items': return (Array.isArray(v) ? v : []).slice(0, f.max || 30).map((it) => normGroup(f.fields, it && typeof it === 'object' ? it : {}));
    case 'group': return normGroup(f.fields, v && typeof v === 'object' ? v : f.d || {});
    default: return undefined;
  }
}
function normGroup(fields, obj) {
  const out = {};
  for (const f of fields) {
    const val = normField(f, obj[f.k]);
    if (val !== undefined) out[f.k] = val;
  }
  return out;
}

/** Clean props for a block kind; derived fields (YouTube id) are added here. */
export function normalizeBlock(kind, props) {
  const def = BLOCKS[kind];
  if (!def) throw new Error('unknown block');
  const out = normGroup(def.fields, props && typeof props === 'object' ? props : {});
  if (kind === 'video') out.yt = ytId(out.url);
  if (kind === 'gallery' || kind === 'features') out.cols = Number(out.cols);
  return out;
}

/** Schema for the admin forms (no functions). */
export const blockSchema = () => Object.fromEntries(Object.entries(BLOCKS).map(([k, v]) => [k, { label: v.label, cat: v.cat, icon: v.icon, desc: v.desc, fields: v.fields }]));
export const blockMeta = { icons: ICON_OPTS, paths: Object.fromEntries(ICON_OPTS.map((k) => [k, ICONS[k]])), fonts: FONTS, tracks: TRACK };
