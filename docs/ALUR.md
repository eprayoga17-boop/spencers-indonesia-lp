# Alur Sistem — Spencer's Indonesia Landing Page

Dokumen ini menjelaskan semua alur **Pengunjung (User)** dan **Admin** dalam bentuk flowchart.
Diagram ditulis dengan Mermaid, jadi langsung tampil sebagai gambar di GitHub.

Daftar isi

1. [Gambaran sistem](#1-gambaran-sistem)
2. [Alur pengunjung membuka landing page](#2-alur-pengunjung-membuka-landing-page)
3. [Alur data kunjungan (Laporan)](#3-alur-data-kunjungan-laporan)
4. [Alur login, sesi & logout admin](#4-alur-login-sesi--logout-admin)
5. [Peta menu admin](#5-peta-menu-admin)
6. [Alur Halaman: daftar, template, arsip](#6-alur-halaman-daftar-template-arsip)
7. [Alur editor halaman (draft → Simpan)](#7-alur-editor-halaman-draft--simpan)
8. [Alur upload gambar & HTML](#8-alur-upload-gambar--html)
9. [Alur Promo (draft → Publish)](#9-alur-promo-draft--publish)
10. [Aturan promo mana yang tampil](#10-aturan-promo-mana-yang-tampil)
11. [Alur Laporan & Dashboard](#11-alur-laporan--dashboard)
12. [Alur deploy (GitHub → Vercel)](#12-alur-deploy-github--vercel)

---

## 1. Gambaran sistem

```mermaid
flowchart LR
  V(["Pengunjung (HP)"]) -->|"buka link landing page"| CDN["Vercel CDN<br/>gambar, CSS, JS"]
  V -->|"halaman + beacon /t"| APP["Server Express<br/>(Vercel Function)"]
  A(["Admin"]) -->|"/admin"| APP
  APP <-->|"halaman, draft, promo,<br/>sesi, laporan, log"| R[("Upstash Redis")]
  APP <-->|"gambar upload baru"| BL[("Vercel Blob")]
  CDN -.->|"gambar bawaan repo"| V
  APP -.->|"opsional"| GA["Google Analytics 4"]
```

| Bagian | Isi |
| --- | --- |
| Landing page | `/{slug}`, contoh `/slimmealsolutionmintidn2`. Mobile-first, lebar desain 320 unit. |
| Admin | `/admin` → Dashboard, Laporan, Halaman, Promo, Logout. |
| Penyimpanan | Lokal: folder `data/` + `public/uploads/`. Di Vercel: Redis (data) + Blob (gambar baru). |

---

## 2. Alur pengunjung membuka landing page

```mermaid
flowchart TD
  S(["Pengunjung klik link<br/>(iklan, WhatsApp, Instagram)"]) --> R0{"Alamat = / ?"}
  R0 -->|ya| HOME["Redirect 302 ke halaman utama"] --> P
  R0 -->|tidak| P{"Halaman dengan slug<br/>ini ada?"}
  P -->|tidak| RD{"Ada redirect lama<br/>(slug pernah diganti)?"}
  RD -->|ya| R301["Redirect 301 ke slug baru"] --> P
  RD -->|tidak| E404["404 Halaman tidak ditemukan"]
  P -->|ya| G["Ambil pengaturan Global<br/>(lebar, font, favicon, GA4)"]
  G --> PR["Cek promo yang aktif sekarang<br/>(lihat bagian 10)"]
  PR --> RENDER["Render halaman:<br/>bagian gambar/HTML + bagian PROMO<br/>(banner, bar merah, badge)"]
  RENDER --> SHOW(["Halaman tampil di HP"])
  SHOW --> I{"Interaksi pengunjung"}
  I -->|"geser slider"| SL["Slider berpindah"]
  I -->|"tap video"| YT["Video YouTube dimuat<br/>(youtube-nocookie, baru saat di-tap)"]
  I -->|"tap tombol WhatsApp/link"| WA(["Buka WhatsApp / link tujuan"])
  I -->|"scroll"| SC["Bagian yang terlihat dicatat"]
  SHOW -.-> B["Beacon kunjungan (lihat bagian 3)"]
  SL -.-> B
  YT -.-> B
  WA -.-> B
  SC -.-> B
```

Catatan

- Bagian yang **disembunyikan** di admin tidak dikirim ke pengunjung.
- Halaman tidak memakai cookie. GA4 hanya aktif jika Measurement ID diisi di tab Global.

---

## 3. Alur data kunjungan (Laporan)

```mermaid
flowchart TD
  L(["Halaman selesai dimuat"]) --> GPC{"Browser mengirim<br/>Global Privacy Control?"}
  GPC -->|ya| NO(["Tidak dicatat"])
  GPC -->|tidak| ADM{"Dibuka dari admin,<br/>preview, atau link Coba di HP?"}
  ADM -->|ya| NO
  ADM -->|tidak| PV["POST /t (page view)"]
  PV --> BOT{"Bot / crawler?"}
  BOT -->|ya| NO
  BOT -->|tidak| HASH["ID pengunjung = hash(salt harian + IP + browser)<br/>IP asli tidak disimpan"]
  HASH --> GEO["Negara & provinsi dari header Vercel<br/>Perangkat, OS, browser, sumber (referrer)"]
  GEO --> SAVE[("Simpan ke log harian<br/>(WIB, disimpan 400 hari)")]
  L --> ENG["Saat pengunjung pergi / pindah tab:<br/>POST /t/e"]
  ENG --> ENG2["Isi: bagian yang dilihat, lama per bagian,<br/>klik (jenis + posisi) — tanpa teks/ketikan"]
  ENG2 --> BOT
```

---

## 4. Alur login, sesi & logout admin

```mermaid
flowchart TD
  O(["Buka /admin/..."]) --> HS{"Sudah punya sesi aktif?"}
  HS -->|ya| IN(["Masuk ke halaman yang dituju"])
  HS -->|tidak| LG["Halaman login<br/>(alamat tujuan disimpan di ?next=)"]
  LG --> F["Isi email + password → Masuk"]
  F --> OR{"Origin sama?<br/>Rate limit 20x / 15 menit / IP"}
  OR -->|tidak| X1(["Ditolak"])
  OR -->|ya| LK{"Akun+IP sedang dikunci?<br/>(5x salah → kunci 15 menit)"}
  LK -->|ya| X2["Pesan: coba lagi 15 menit"] --> LG
  LK -->|tidak| PW{"Email & password benar?"}
  PW -->|tidak| X3["Pesan umum:<br/>Email atau password salah<br/>(dicatat di log)"] --> LG
  PW -->|ya| SES["Buat sesi baru + token CSRF<br/>cookie HttpOnly, SameSite=Strict, Secure"]
  SES --> NX["Kembali ke alamat tujuan (hanya /admin/...)"] --> IN
  IN --> USE{"Aktivitas admin"}
  USE -->|"diam 28 menit"| WARN["Peringatan: sesi berakhir 2 menit lagi"]
  WARN -->|"Tetap masuk"| IN
  WARN -->|"diam terus / Keluar"| END(["Sesi berakhir → ke halaman login,<br/>lalu kembali ke halaman terakhir"])
  USE -->|"8 jam sejak login"| END
  USE -->|"klik Logout"| LO{"Ada draft yang belum disimpan?"}
  LO -->|ya| CF["Konfirmasi keluar"] --> OUT
  LO -->|tidak| OUT(["Sesi dihapus di server → halaman login"])
```

---

## 5. Peta menu admin

```mermaid
flowchart LR
  ADM(["Admin Spencer's Indonesia"]) --> D["Dashboard"]
  ADM --> L["Laporan"]
  ADM --> H["Halaman"]
  ADM --> P["Promo"]
  ADM --> X["Logout"]
  ADM --> T["Toggle Terang / Gelap"]
  D --> D1["KPI: pengunjung, tayangan,<br/>klik WhatsApp, konversi"]
  D --> D2["Grafik tren + perangkat + sumber"]
  D --> D3["Info singkat promo yang berjalan"]
  L --> L1["Ringkasan: filter tanggal/halaman,<br/>peta provinsi, CSV"]
  L --> L2["Per Bagian: funnel + klik + heatmap"]
  L --> L3["Log Aktivitas (audit)"]
  H --> H1["Daftar halaman, cari, buat dari template"]
  H --> H2["Editor halaman"]
  P --> P1["Daftar promo + timeline"]
  P --> P2["Edit promo → Publish"]
```

Titik oranye di menu Halaman berarti ada draft halaman yang belum disimpan. Titik oranye di menu Promo berarti ada draft promo yang belum dipublish.

---

## 6. Alur Halaman: daftar, template, arsip

```mermaid
flowchart TD
  H(["Menu Halaman"]) --> LIST["Daftar halaman<br/>(sampul otomatis, kategori, cari)"]
  LIST --> A{"Aksi"}
  A -->|"Buka"| ED(["Editor halaman (bagian 7)"])
  A -->|"Statistik"| ST(["Laporan → Per Bagian halaman ini"])
  A -->|"Lihat live"| LV(["Buka halaman di tab baru"])
  A -->|"Halaman baru"| NEW["Pilih template<br/>(kosong atau salin halaman lain)"]
  NEW --> SL{"Slug valid & belum dipakai?"}
  SL -->|tidak| NEW
  SL -->|ya| CP["Halaman baru dibuat"] --> ED
  A -->|"Arsipkan"| AR["Halaman dihapus dari live<br/>(riwayat tetap disimpan)"]
  AR --> ARL["Daftar Arsip"]
  ARL -->|"Pulihkan"| LIST
```

---

## 7. Alur editor halaman (draft → Simpan)

```mermaid
flowchart TD
  E(["Buka editor"]) --> DR["Draft dibuka<br/>(salinan kerja, live belum berubah)"]
  DR --> UI["Kiri: tab Konten / Desain / SEO / Global / Riwayat<br/>Kanan: preview iPhone 11"]
  UI --> ACT{"Aksi admin"}

  ACT -->|"Klik bagian di daftar"| AN1["Preview scroll ke bagian itu<br/>+ highlight oranye"]
  ACT -->|"Klik bagian di preview"| AN2["Daftar scroll ke bagian itu"]
  ACT -->|"Drag bagian"| ORD["Urutan berubah"]
  ACT -->|"Klik kanan bagian"| CTX["Cut / Copy / Sembunyikan / Perlihatkan /<br/>Rename / Hapus (dengan konfirmasi)"]
  ACT -->|"Tambah bagian"| UP(["Upload gambar / HTML (bagian 8)"])
  ACT -->|"Tab Desain"| DS["Lebar, background, font, sampul,<br/>Ekspor / Impor kode halaman"]
  ACT -->|"Tab SEO"| SEO["Judul, deskripsi, keyword,<br/>slug (link), indexing"]
  ACT -->|"Tab Global"| GL["Lebar & font semua halaman,<br/>favicon, GA4"]
  ACT -->|"Drag badge promo"| BD["Posisi badge per halaman"]
  ACT -->|"Coba di HP"| QR["QR code + link 1 jam<br/>untuk melihat draft di HP asli"]

  AN1 & AN2 & ORD & CTX & DS & SEO & GL & BD --> STEP["Setiap perubahan = 1 langkah draft"]
  STEP --> UR{"Undo / Redo?"}
  UR -->|ya| STEP
  UR -->|tidak| SAVE{"Klik Simpan?"}
  SAVE -->|"belum"| UI
  SAVE -->|"Buang draft"| DISC["Draft kembali sama dengan live"] --> UI
  SAVE -->|ya| SNAP["Versi live lama disimpan ke Riwayat<br/>(maks. 50 versi)"]
  SNAP --> SLUG{"Slug diganti?"}
  SLUG -->|ya| RED["Link lama otomatis redirect 301"] --> LIVE
  SLUG -->|tidak| LIVE(["Halaman live terbarui"])

  UI -->|"Pindah menu sidebar<br/>saat ada draft"| GUARD{"Konfirmasi:<br/>tinggalkan draft?"}
  GUARD -->|"tetap di sini"| UI
  GUARD -->|"tinggalkan"| OUT(["Draft tetap tersimpan,<br/>bisa dilanjutkan nanti"])

  UI -->|"Tab Riwayat"| HIS["Daftar versi + aktivitas halaman"]
  HIS -->|"Muat ke draft"| DR
```

Editor juga menampilkan peringatan jika promo yang aktif belum punya banner atau badge.

---

## 8. Alur upload gambar & HTML

```mermaid
flowchart TD
  U(["Tambah / ganti bagian"]) --> T{"Jenis"}
  T -->|"Gambar"| IMG["File JPG/PNG/WebP/GIF/AVIF<br/>maks. 15 MB, banyak gambar = slider"]
  IMG --> CHK{"Benar-benar gambar?<br/>(dibuka ulang oleh sharp,<br/>SVG / file palsu ditolak)"}
  CHK -->|tidak| ERR["Pesan error"]
  CHK -->|ya| ENC["Resize maks. 1440 px,<br/>konversi WebP + AVIF,<br/>data EXIF/GPS dibuang"]
  ENC --> ST[("Simpan:<br/>lokal public/uploads<br/>atau Vercel Blob")]
  T -->|"HTML"| H["Kode HTML / file .html"]
  H --> SAN["Sanitasi: script, iframe, form,<br/>on* handler, javascript: dibuang<br/>YouTube → player klik-untuk-putar<br/>CSS dikunci ke bagian itu saja"]
  SAN --> FIT["Dibungkus agar pas lebar layar<br/>(tidak bisa menutupi halaman)"]
  ST --> DRAFT(["Masuk ke draft"])
  FIT --> DRAFT
```

---

## 9. Alur Promo (draft → Publish)

```mermaid
flowchart TD
  P(["Menu Promo"]) --> TL["Timeline promo<br/>(peringatan jika ada hari tanpa promo)"]
  TL --> A{"Aksi"}
  A -->|"Promo baru"| K{"Jenis promo"}
  K -->|"Insidentil<br/>(1.1, 2.2, 10.10, Natal, Idul Fitri)"| INS["Aktifkan dengan toggle manual<br/>ATAU isi durasi tanggal"]
  K -->|"Regular<br/>(14 Day, PayDay)"| REG["Hanya durasi tanggal<br/>(tidak ada toggle)"]
  A -->|"Edit promo"| EDIT
  INS --> EDIT["Isi: nama, banner (link statis),<br/>badge, teks bar merah"]
  REG --> EDIT
  EDIT --> DR["Tersimpan sebagai DRAFT promo<br/>(titik oranye di menu Promo)"]
  DR --> PB{"Klik Publish?"}
  PB -->|"Buang draft"| TL
  PB -->|"belum"| TL
  PB -->|ya| LIVE(["Langsung berlaku di SEMUA halaman"])
  LIVE --> RENDER["Bagian PROMO di tiap halaman<br/>terisi banner + bar merah + badge<br/>(posisi badge diatur per halaman di editor)"]
```

---

## 10. Aturan promo mana yang tampil

Hanya **satu** promo yang tampil pada satu waktu. Urutannya dicek dari atas ke bawah:

```mermaid
flowchart TD
  NOW(["Setiap kali halaman dibuka<br/>(waktu WIB)"]) --> M{"Ada promo Insidentil<br/>dengan toggle AKTIF?"}
  M -->|ya| SM(["Tampilkan promo insidentil itu"])
  M -->|tidak| SI{"Ada promo Insidentil<br/>yang tanggalnya berlaku hari ini?"}
  SI -->|ya| SS(["Tampilkan promo insidentil itu"])
  SI -->|tidak| SR{"Ada promo Regular<br/>yang tanggalnya berlaku hari ini?"}
  SR -->|ya| RR(["Tampilkan promo regular itu"])
  SR -->|tidak| NONE(["Tidak ada promo:<br/>bagian PROMO disembunyikan"])
```

Jadi jika promo Insidentil diaktifkan, promo Regular otomatis tidak tampil (statusnya menjadi *tertimpa*).

---

## 11. Alur Laporan & Dashboard

```mermaid
flowchart TD
  L(["Menu Laporan"]) --> F["Pilih rentang tanggal<br/>(7 / 14 / 30 / 90 hari / pilih tanggal) + halaman"]
  F --> TAB{"Tab"}
  TAB -->|Ringkasan| R1["Pengunjung, tayangan, klik WhatsApp, konversi<br/>tren harian, perangkat, OS, browser,<br/>sumber, peta provinsi + daftar"]
  R1 --> CSV(["Unduh CSV"])
  TAB -->|"Per Bagian"| R2["Funnel: % pengunjung yang sampai ke tiap bagian,<br/>lama dilihat, jumlah klik per jenis"]
  R2 --> HM["Klik bagian → heatmap klik<br/>di atas tampilan halaman live"]
  TAB -->|"Log"| R3["Log aktivitas admin:<br/>login, gagal login, simpan, publish<br/>(300 catatan terakhir, disimpan 90 hari)"]
  DB(["Dashboard"]) --> D1["Versi ringkas Laporan (7 hari terakhir)"]
  DB --> D2["Promo yang sedang berjalan + sisa waktu"]
  SAMPLE["Data contoh"] -.->|"bisa dimuat / dihapus<br/>dari Laporan"| R1
```

---

## 12. Alur deploy (GitHub → Vercel)

```mermaid
flowchart TD
  DEV(["Perubahan kode di laptop"]) --> GIT["git push ke GitHub (branch main)"]
  GIT --> VB["Vercel build otomatis:<br/>npm install + vercel-build<br/>(bundel isi awal data/)"]
  VB --> DEP["Deploy baru online"]
  DEP --> FIRST{"Redis masih kosong?<br/>(deploy pertama)"}
  FIRST -->|ya| SEED["Isi awal halaman, promo, global,<br/>redirect disalin ke Redis"]
  FIRST -->|tidak| KEEP["Data admin di Redis tetap<br/>(tidak tertimpa oleh deploy)"]
  SEED --> ON(["Situs + admin online"])
  KEEP --> ON
```

Penting

- Setelah online, **konten diubah lewat admin**, bukan lewat file `data/` di repo. Deploy ulang tidak menimpa isi Redis.
- Variabel rahasia (`ADMIN_USERS`, `EXPORT_SECRET`, token Redis/Blob) hanya ada di pengaturan Environment Variables Vercel, tidak di GitHub.
