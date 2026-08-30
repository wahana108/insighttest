import type { Kegiatan } from "@/types/kegiatan";

export type StatusJendelaKegiatan = "belum_dibuka" | "terbuka" | "sudah_ditutup";

/**
 * dibukaPada/ditutupPada kosong berarti tanpa batas di sisi itu. Dipakai di
 * /kegiatan dan /kegiatan/[id] supaya peserta melihat kegiatan yang belum
 * dibuka atau sudah ditutup (dengan keterangan), bukan disembunyikan diam-
 * diam — server (POST /api/pendaftaran) menegakkan jendela yang sama saat
 * benar-benar mendaftar.
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
