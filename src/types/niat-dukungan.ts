/**
 * Slice "niat-dukungan" (6b) — niat_dukungan/{kegiatanId}__{uid}, koleksi
 * SERVER-ONLY (firestore.rules: allow read, write: if false). Satu
 * dokumen = satu pengajuan formulir dukungan seorang peserta untuk satu
 * kegiatan; id deterministik (lihat idNiatDukungan(), src/lib/niat-dukungan.ts)
 * supaya "sudah pernah mengisi atau belum" dijawab dengan SATU pembacaan
 * dokumen, bukan query.
 */

/**
 * 'tercatat' (Slice "urutan-dukungan" 6c) — status AWAL kalau kegiatan
 * TIDAK mensyaratkan persetujuan (dukungan.perluPersetujuan false): dokumen
 * sudah ada, kode BELUM PERNAH dicoba dikirim, peserta boleh memanggil POST
 * /api/dukungan/kirim-kode sendiri.
 *
 * 'menunggu' (Slice "persetujuan-dukungan" 6e) — status AWAL kalau
 * dukungan.perluPersetujuan true: POST /api/dukungan/kirim-kode MENOLAK
 * (403) selama status masih ini — kode hanya bisa dikirim admin/panitia
 * lewat POST /api/dukungan/setujui, setelah mencocokkan dengan daftar
 * donatur. Satu-satunya jalan keluar dari 'menunggu' adalah 'terkirim'
 * (lewat /setujui) — tidak pernah otomatis berubah sendiri.
 *
 * 'terkirim'/'gagal' hanya ditulis POST /api/dukungan/kirim-kode, POST
 * /api/dukungan/setujui, dan POST /api/dukungan/admin (yang masih mengirim
 * langsung saat membuat) — kode baru dibaca/dikirim di sana, tidak lagi
 * saat formulir pertama kali disimpan.
 */
export type StatusNiatDukungan = "tercatat" | "menunggu" | "terkirim" | "gagal";

/**
 * 'sendiri' — dibuat lewat POST /api/dukungan/niat oleh peserta sendiri.
 * 'admin' — dibuat lewat POST /api/dukungan/admin oleh admin/panitia atas
 * nama peserta yang tidak mengisi formulir sendiri (mis. tidak ada akun
 * saat menyumbang, dicocokkan manual dari daftar donatur Saweria).
 */
export type DibuatOlehNiatDukungan = "sendiri" | "admin";

export interface NiatDukungan {
  id: string;
  kegiatanId: string;
  uid: string;
  /** Alamat akun peserta SAAT dokumen ini dibuat — bukan dibaca ulang live, KA-6-ish (jejak, bukan rujukan hidup). */
  email: string;
  /** Nama yang dipakai peserta di Saweria — bisa beda dari nama akun, itu sebabnya field terpisah dari namaLengkap profil. */
  namaDipakai: string;
  nominal: number | null;
  catatan: string;
  dibuatPada: string;
  dibuatOleh: DibuatOlehNiatDukungan;
  status: StatusNiatDukungan;
  /** Kosong kalau status 'tercatat' atau 'terkirim'. Berbahasa Indonesia, TIDAK PERNAH memuat BREVO_API_KEY (sama aturan dengan src/lib/email/brevo.ts). */
  alasanGagal: string;
  dikirimPada: string | null;
  /** Berapa kali kode berhasil dikirim ke alamat ini lewat POST /api/dukungan/kirim-kode (Slice 6c) — bukan berapa kali formulir diisi. */
  jumlahKirim: number;
}
