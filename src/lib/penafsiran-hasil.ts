/**
 * Slice "penafsiran-hasil" (docs/kickoff.md §R, SLICE 5) — fungsi murni
 * saja di sini. Dipakai HANYA oleh /kegiatan/[id] untuk peserta yang SUDAH
 * TERDAFTAR (lihat komentar Kegiatan.penafsiranHasil, src/types/kegiatan.ts,
 * untuk daftar tempat yang SENGAJA TIDAK memanggil ini: /s/[kode], cetak
 * sertifikat, rekap admin).
 */

/**
 * Baris tetap dari KODE, bukan dari data — admin/panitia bisa menambah
 * keterangan sendiri di penafsiranHasil, tapi tidak bisa menghilangkan
 * baris ini karena ia tidak pernah tersimpan di Firestore sama sekali.
 */
export const DISCLAIMER_PENAFSIRAN_HASIL =
  "Hasil ini bersifat eksperimental dan bukan asesmen klinis.";

/**
 * null berarti fitur mati — penafsiranHasil kosong atau hanya berisi
 * spasi, TERMASUK kegiatan lama tanpa field ini sama sekali (mapKegiatan()
 * membacanya sebagai "" lewat KA-1, sampai ke sini sudah tidak bisa
 * dibedakan dari "sengaja dikosongkan admin" — dan memang tidak perlu
 * dibedakan, keduanya berarti "jangan tampilkan apa-apa").
 *
 * Render HASIL fungsi ini sebagai teks biasa (whitespace-pre-line) di
 * pemanggil — TIDAK PERNAH sebagai HTML (lihat komentar di
 * src/app/kegiatan/[id]/page.tsx).
 */
export function susunPenafsiranHasil(penafsiranHasil: string): string | null {
  const teks = penafsiranHasil.trim();
  if (!teks) {
    return null;
  }
  return `${DISCLAIMER_PENAFSIRAN_HASIL}\n\n${teks}`;
}
