/**
 * Kode verifikasi sertifikat SELALU disimpan dalam bentuk kanonik: huruf
 * besar A-Z dan angka 0-9 saja, tanpa tanda hubung (lihat
 * ALFABET_KODE_VERIFIKASI di src/lib/api/sertifikat-server.ts). Pencarian
 * Firestore (`where('kodeVerifikasi', '==', ...)`) sama persis huruf demi
 * huruf — tidak ada operator "tanpa peduli besar-kecil". Kode yang diketik
 * ulang manusia (dari kertas, QR, atau diketik langsung di bilah alamat)
 * bisa datang huruf kecil, berspasi di ujung, atau bertanda hubung kalau
 * orang membaca kelompok karakternya seolah nomor seri berkelompok —
 * fungsi ini menormalkan bentuk yang MASUK, tepat sebelum dicocokkan,
 * supaya sertifikat asli tidak pernah dilaporkan "tidak ditemukan" hanya
 * karena cara mengetiknya.
 *
 * TIDAK PERNAH dipakai untuk menulis ulang kodeVerifikasi yang sudah
 * tersimpan (KA-6, docs/arsitektur.md) — hanya untuk kode yang baru masuk
 * dari pengguna, di titik PENCOCOKAN (query Firestore), bukan di titik
 * input (kotak isian) — orang bisa saja mengetik /s/{kode} langsung di
 * bilah alamat, jadi normalisasi harus berlaku di mana pun pencocokan itu
 * terjadi, bukan hanya di satu formulir.
 */
export function normalisasiKodeVerifikasi(kode: string): string {
  return kode.trim().replace(/-/g, "").toUpperCase();
}
