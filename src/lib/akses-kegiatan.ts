import { statusJendelaKegiatan } from "@/lib/kegiatan-jendela";
import type { HasilKeputusanKuota } from "@/lib/kuota-peserta";
import type { CaraMasukKegiatan, Kegiatan } from "@/types/kegiatan";
import type { StatusNiatDukungan } from "@/types/niat-dukungan";

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
const OK_KUOTA: HasilKeputusanKuota = { ok: true, pesan: null };

export const PESAN_HANYA_ADMIN =
  "Kegiatan ini hanya menerima peserta lewat pendaftaran oleh admin. Hubungi panitia kalau Anda seharusnya sudah terdaftar.";
export const PESAN_KODE_SALAH = "Kode akses salah atau belum diisi.";
export const PESAN_KODE_BATAS_PEMAKAIAN_TERCAPAI = "Kode ini sudah mencapai batas pemakaiannya.";
export const PESAN_WAJIB_CATATAN_DUKUNGAN =
  "Kode ini baru berlaku setelah Anda mengisi formulir dukungan pada kegiatan ini.";
export const PESAN_MENUNGGU_PERSETUJUAN_DUKUNGAN =
  "Permintaan Anda pada kegiatan ini belum disetujui admin.";

/**
 * Slice "niat-dukungan" (6b), diperluas Slice "persetujuan-dukungan" (6e) —
 * dukungan.wajibCatatan (src/types/kegiatan.ts) false berarti tak ada syarat
 * tambahan (BAWAAN, sama pola dengan kodeMaksPakai/kuotaPeserta): kode yang
 * benar SUDAH CUKUP, perilaku persis seperti sebelum Slice 6b — tidak ada
 * perubahan sama sekali.
 *
 * wajibCatatan true berarti kode yang benar TIDAK CUKUP — juga wajib ada
 * dokumen niat_dukungan/{kegiatanId}__{uid} (idNiatDukungan(),
 * src/lib/niat-dukungan.ts). statusCatatan null berarti dokumen itu belum
 * ada sama sekali (diperiksa pemanggil, POST /api/pendaftaran, lewat SATU
 * pembacaan di dalam transaksi pendaftaran yang sama) — dioper ke sini
 * sebagai status murni (bukan boolean punyaCatatan seperti sebelum 6e)
 * supaya fungsi ini bisa membedakan "belum mengisi" dari "sudah mengisi
 * tapi belum disetujui" tanpa menyentuh Firestore sendiri.
 *
 * perluPersetujuan (dukungan.perluPersetujuan) menaikkan syaratnya: kalau
 * true, statusCatatan HARUS 'terkirim' — status 'menunggu' (kode belum
 * dikonfirmasi admin lewat POST /api/dukungan/setujui) TIDAK CUKUP, walau
 * dokumennya sudah ada. Kalau perluPersetujuan false (bawaan), status
 * 'tercatat' pun sudah cukup, sama seperti sebelum Slice 6e.
 */
export function putuskanCatatanDukunganWajib(params: {
  wajibCatatan: boolean;
  perluPersetujuan: boolean;
  statusCatatan: StatusNiatDukungan | null;
}): HasilKeputusanKuota {
  if (!params.wajibCatatan) {
    return OK_KUOTA;
  }
  if (params.statusCatatan === null) {
    return { ok: false, pesan: PESAN_WAJIB_CATATAN_DUKUNGAN };
  }
  if (params.perluPersetujuan && params.statusCatatan !== "terkirim") {
    return { ok: false, pesan: PESAN_MENUNGGU_PERSETUJUAN_DUKUNGAN };
  }
  return OK_KUOTA;
}

/**
 * Slice "kode-akses-terukur" — kode akses dipakai bersama satu periode dan
 * bisa beredar lebih luas dari yang dimaksud (grup pesan, bukan cuma
 * pesan terima kasih Saweria satu orang). kodeMaksPakai 0 berarti tak
 * terbatas (BAWAAN, sama seperti kuotaPeserta/batasHarian di
 * kuota-peserta.ts). jumlahDipakaiBaru adalah jumlah pemakaian kode ini
 * yang AKAN tercatat kalau pendaftaran ini diterima (jumlah tersimpan di
 * kegiatan_kode/{kegiatanId} + 1, dibaca pemanggil DI DALAM transaksi
 * pendaftaran yang sama — jebakan 5.0c yang sama seperti jumlahHariIniBaru
 * di POST /api/pendaftaran).
 *
 * Pesannya SENGAJA beda dari PESAN_KODE_SALAH: kodenya memang benar,
 * batas pemakaiannya yang habis — orangnya berhak tahu bedanya supaya
 * tidak mengira dirinya salah ketik.
 */
export function putuskanBatasPemakaianKode(
  kodeMaksPakai: number,
  jumlahDipakaiBaru: number
): HasilKeputusanKuota {
  if (kodeMaksPakai <= 0) {
    return OK_KUOTA;
  }
  if (jumlahDipakaiBaru > kodeMaksPakai) {
    return { ok: false, pesan: PESAN_KODE_BATAS_PEMAKAIAN_TERCAPAI };
  }
  return OK_KUOTA;
}

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
  /**
   * Slice "kode-akses-terukur" — hanya relevan untuk caraMasuk 'kode',
   * diabaikan untuk 'terbuka'/'hanya_admin' (sama seperti hasilBatasHarian
   * yang selalu dioper pemanggil apa pun caraMasuk-nya).
   */
  hasilBatasPemakaianKode: HasilKeputusanKuota;
  /**
   * Slice "niat-dukungan" (6b) — hanya relevan untuk caraMasuk 'kode', sama
   * seperti hasilBatasPemakaianKode di atas. Lihat putuskanCatatanDukunganWajib().
   */
  hasilCatatanDukungan: HasilKeputusanKuota;
}): KeputusanAksesMandiri {
  const {
    caraMasuk,
    kodeDimasukkan,
    kodeTersimpan,
    hasilKuotaKegiatan,
    hasilBatasHarian,
    hasilBatasPemakaianKode,
    hasilCatatanDukungan,
  } = params;

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
    // Kode cocok TAPI belum mengisi formulir dukungan yang diwajibkan —
    // dicek SEBELUM batas pemakaian/kuota: ini soal KELAYAKAN memakai kode
    // ini sama sekali, sejenis dengan "kode salah", bukan soal kode ini
    // sudah habis/acaranya penuh.
    if (!hasilCatatanDukungan.ok) {
      return { ok: false, pesan: hasilCatatanDukungan.pesan, status: 403 };
    }
    // Kode cocok TAPI sudah mencapai batas pemakaiannya — beda dari kode
    // salah, dicek SEBELUM kuota kegiatan supaya pesannya paling tepat.
    if (!hasilBatasPemakaianKode.ok) {
      return { ok: false, pesan: hasilBatasPemakaianKode.pesan, status: 409 };
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
