import type { Kegiatan } from "@/types/kegiatan";

export type StatusJendelaKegiatan = "belum_dibuka" | "terbuka" | "sudah_ditutup";

/**
 * dibukaPada/ditutupPada kosong berarti tanpa batas di sisi itu. Server
 * (POST /api/pendaftaran) menegakkan jendela yang sama saat benar-benar
 * mendaftar — fungsi ini hanya untuk tampilan.
 *
 * Slice "akses-kegiatan" §3 (docs/kickoff.md §R) MEMBALIK keputusan lama
 * di sini: katalog /kegiatan sekarang MENYEMBUNYIKAN kegiatan yang belum
 * dibuka/sudah lewat (lihat bolehTampilDiKatalog(), src/lib/akses-kegiatan.ts),
 * bukan menampilkannya dengan keterangan seperti sebelumnya — supaya admin
 * bisa menyiapkan beberapa edisi sekaligus dan masing-masing muncul sendiri
 * pada waktunya. Fungsi ini SENDIRI tidak berubah dan tetap dipakai di
 * /kegiatan/[id] (halaman detail SELALU menampilkan status jendela, bahkan
 * untuk peserta yang tertaut langsung ke kegiatan yang jendelanya sudah
 * lewat) — hanya PEMAKAINYA di katalog yang berubah perilaku.
 */
export function statusJendelaKegiatan(
  kegiatan: Pick<Kegiatan, "dibukaPada" | "ditutupPada">,
  now: Date = new Date()
): StatusJendelaKegiatan {
  if (kegiatan.dibukaPada && now < new Date(kegiatan.dibukaPada)) {
    return "belum_dibuka";
  }
  if (kegiatan.ditutupPada && now > new Date(kegiatan.ditutupPada)) {
    return "sudah_ditutup";
  }
  return "terbuka";
}
