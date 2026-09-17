/**
 * Slice "niat-dukungan" (6b) — niat_dukungan/{kegiatanId}__{uid}, koleksi
 * SERVER-ONLY (firestore.rules: allow read, write: if false). Satu
 * dokumen = satu pengajuan formulir dukungan seorang peserta untuk satu
 * kegiatan; id deterministik (lihat idNiatDukungan(), src/lib/niat-dukungan.ts)
 * supaya "sudah pernah mengisi atau belum" dijawab dengan SATU pembacaan
 * dokumen, bukan query.
 */

export type StatusNiatDukungan = "terkirim" | "gagal";

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
  /** Kosong kalau status 'terkirim'. Berbahasa Indonesia, TIDAK PERNAH memuat BREVO_API_KEY (sama aturan dengan src/lib/email/brevo.ts). */
  alasanGagal: string;
  dikirimPada: string | null;
  /** Berapa kali kode berhasil dikirim ke alamat ini (pengiriman awal + kirim ulang). */
  jumlahKirim: number;
}
