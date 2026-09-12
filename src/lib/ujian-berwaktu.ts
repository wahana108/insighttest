/**
 * Slice "ujian-berwaktu" (docs/kickoff.md §R, SLICE 3) — LAPIS KERAS saja di
 * sini: fungsi murni yang membandingkan waktu server saat jawaban tiba
 * dengan ditutupPada kegiatan. TIDAK ADA hubungannya dengan batasWaktuMenit
 * per-modul (attempt.kadaluarsaPada, mekanisme lama yang sudah ada) — itu
 * jam per-attempt, ini jendela kegiatan. Dua "kedaluwarsa" yang berbeda,
 * SENGAJA dijaga terpisah supaya tidak tercampur.
 */

/**
 * Kelonggaran jaringan (BUKAN celah kecurangan yang sengaja dilebarkan) —
 * kiriman terakhir sebelum ditutupPada bisa tertunda beberapa detik di
 * jaringan lambat/genting sebelum tiba di server. Tanpa ini, peserta jujur
 * yang menekan "Kirim" tepat waktu bisa tercatat kedaluwarsa hanya karena
 * latensi jaringan, bukan karena terlambat mengerjakan.
 */
export const KELONGGARAN_JARINGAN_DETIK = 60;

export interface HasilPeriksaJendelaUjian {
  kedaluwarsa: boolean;
}

/**
 * ditutupPada null berarti kegiatan tanpa batas waktu — TIDAK PERNAH
 * kedaluwarsa, berapa pun waktuKirim-nya. batasWaktuMenit modul TIDAK
 * pernah jadi parameter di sini SENGAJA — fungsi ini murni tentang jendela
 * KEGIATAN, independen dari timer per-modul mana pun.
 */
export function periksaJendelaUjian(
  ditutupPada: Date | null,
  waktuKirim: Date
): HasilPeriksaJendelaUjian {
  if (!ditutupPada) {
    return { kedaluwarsa: false };
  }
  const batasDenganKelonggaran = new Date(
    ditutupPada.getTime() + KELONGGARAN_JARINGAN_DETIK * 1000
  );
  return { kedaluwarsa: waktuKirim > batasDenganKelonggaran };
}
