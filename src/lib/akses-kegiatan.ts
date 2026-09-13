import { statusJendelaKegiatan } from "@/lib/kegiatan-jendela";
import type { HasilKeputusanKuota } from "@/lib/kuota-peserta";
import type { CaraMasukKegiatan, Kegiatan } from "@/types/kegiatan";

/**
 * Slice "akses-kegiatan" (docs/kickoff.md §R, SLICE 4) — fungsi murni saja
 * di sini, tidak ada akses Firestore. I/O sesungguhnya (baca kegiatan_kode,
 * baca parameter/global) ada di POST /api/pendaftaran dan Route Handler
 * kode-akses, yang memakai keputusan dari fungsi-fungsi ini.
 */

/**
 * Dokumen kegiatan lama tidak punya field caraMasuk sama sekali —
 * diperlakukan 'terbuka' (perilaku yang sudah ada sebelum slice ini),
 * bukan galat. Dipakai baik oleh mapKegiatan() (klien) maupun Route Handler
 * pendaftaran (server, data mentah Admin SDK).
 */
export function mapCaraMasuk(value: unknown): CaraMasukKegiatan {
  return value === "kode" || value === "hanya_admin" ? value : "terbuka";
}

/**
 * Kode akses diketik ulang manusia dari pesan terima kasih Saweria — bisa
 * datang berspasi di ujung atau huruf kecil. Pola SAMA PERSIS dengan
 * normalisasiKodeVerifikasi() (src/lib/kode-verifikasi.ts, Slice 9.3a):
 * trim, buang tanda hubung, huruf besar — supaya kode yang benar tidak
 * pernah ditolak hanya karena cara mengetiknya.
 */
export function normalisasiKodeAkses(kode: string): string {
  return kode.trim().replace(/-/g, "").toUpperCase();
}

export interface KeputusanAksesMandiri {
  ok: boolean;
  pesan: string | null;
  /**
   * Kode status HTTP yang cocok untuk penolakan ini — dipilih di sini
   * (bukan di Route Handler) supaya status dan pesan tidak pernah
   * disimpulkan terpisah dan bisa diam-diam tidak sinkron. 200 kalau ok
   * true (Route Handler mengabaikannya di jalur sukses).
   */
  status: number;
}

const OK: KeputusanAksesMandiri = { ok: true, pesan: null, status: 200 };

export const PESAN_HANYA_ADMIN =
  "Kegiatan ini hanya menerima peserta lewat pendaftaran oleh admin. Hubungi panitia kalau Anda seharusnya sudah terdaftar.";
export const PESAN_KODE_SALAH = "Kode akses salah atau belum diisi.";

/**
 * SATU-SATUNYA tempat yang memutuskan apakah pendaftaran MANDIRI (bukan
 * impor admin — itu tidak pernah lewat sini, lihat komentar 'hanya_admin')
 * boleh diteruskan. kuotaPeserta kegiatan (hasilKuotaKegiatan) SELALU
 * ditegakkan apa pun caraMasuk-nya — "kapasitas kegiatan adalah janji
 * tentang acaranya, dan itu tidak dijual kepada siapa pun" (docs/kickoff.md
 * §R). batasPendaftaranBaruPerHari (hasilBatasHarian) HANYA ditegakkan
 * untuk 'terbuka' — pemegang kode akses yang benar melewatinya, karena
 * batas harian melindungi infrastruktur dan penyumbang sedang ikut
 * menanggungnya (bukan berarti mereka menyerobot kapasitas acara).
 *
 * kodeTersimpan null berarti kegiatan_kode/{id} belum pernah diisi admin —
 * diperlakukan sama seperti kode salah (tidak ada kode yang bisa cocok).
 */
export function putuskanAksesMandiri(params: {
  caraMasuk: CaraMasukKegiatan;
  kodeDimasukkan: string;
  kodeTersimpan: string | null;
  hasilKuotaKegiatan: HasilKeputusanKuota;
  hasilBatasHarian: HasilKeputusanKuota;
}): KeputusanAksesMandiri {
  const { caraMasuk, kodeDimasukkan, kodeTersimpan, hasilKuotaKegiatan, hasilBatasHarian } = params;

  if (caraMasuk === "hanya_admin") {
    return { ok: false, pesan: PESAN_HANYA_ADMIN, status: 403 };
  }

  if (caraMasuk === "kode") {
    const dimasukkanNormal = normalisasiKodeAkses(kodeDimasukkan);
    const cocok =
      kodeTersimpan !== null &&
      dimasukkanNormal !== "" &&
      dimasukkanNormal === normalisasiKodeAkses(kodeTersimpan);
    if (!cocok) {
      return { ok: false, pesan: PESAN_KODE_SALAH, status: 403 };
    }
    // Kode cocok — lewati batas harian, TETAP terikat kuota kegiatan.
    if (!hasilKuotaKegiatan.ok) {
      return { ok: false, pesan: hasilKuotaKegiatan.pesan, status: 409 };
    }
    return OK;
  }

  // 'terbuka' — termasuk kegiatan lama tanpa field caraMasuk sama sekali
  // (pemanggil sudah memetakannya lewat mapCaraMasuk() sebelum sampai sini).
  if (!hasilKuotaKegiatan.ok) {
    return { ok: false, pesan: hasilKuotaKegiatan.pesan, status: 409 };
  }
  if (!hasilBatasHarian.ok) {
    return { ok: false, pesan: hasilBatasHarian.pesan, status: 429 };
  }
  return OK;
}

/**
 * JADWAL PUBLIKASI (TAHAP B butir 3) — dipakai HANYA oleh katalog /kegiatan
 * untuk MENYEMBUNYIKAN, bukan oleh use-kegiatan-list.ts (hook itu dipakai
 * juga oleh /beranda untuk mencocokkan judul kegiatan yang peserta SUDAH
 * terdaftar di dalamnya — kegiatan itu harus tetap muncul di sana walau
 * jendelanya sudah lewat atau caraMasuk 'hanya_admin'). Kegiatan yang belum
 * diterbitkan TIDAK dicek di sini — pemanggil (katalog) sudah memfilter
 * isPublished lewat query Firestore-nya sendiri.
 */
export function bolehTampilDiKatalog(
  kegiatan: Pick<Kegiatan, "dibukaPada" | "ditutupPada" | "caraMasuk">,
  now: Date = new Date()
): boolean {
  if (kegiatan.caraMasuk === "hanya_admin") {
    return false;
  }
  return statusJendelaKegiatan(kegiatan, now) === "terbuka";
}
