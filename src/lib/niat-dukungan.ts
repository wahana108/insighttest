import type { HasilKeputusanKuota } from "@/lib/kuota-peserta";
import { kolomTambahanUntukFormulir } from "@/lib/services/impor-hadir";
import type { FormulirPeserta } from "@/types/kegiatan";
import type {
  DibuatOlehNiatDukungan,
  NiatDukungan,
  StatusNiatDukungan,
} from "@/types/niat-dukungan";

/**
 * Slice "niat-dukungan" (6b, diperbaiki di 6c) — fungsi murni saja di sini,
 * tidak ada akses Firestore/jaringan (sama pola dengan
 * src/lib/akses-kegiatan.ts). I/O sesungguhnya ada di POST
 * /api/dukungan/{niat,kirim-kode,admin} dan GET
 * /api/admin/kegiatan/[kegiatanId]/dukungan.
 */

const OK_KUOTA: HasilKeputusanKuota = { ok: true, pesan: null };

export const BATAS_NIAT_PER_HARI = 5;
export const PESAN_BATAS_NIAT_TERCAPAI =
  "Anda sudah mengisi 5 formulir dukungan hari ini. Coba lagi besok.";

/**
 * Batas 5/hari pada POST /api/dukungan/niat. Sejak Slice "urutan-dukungan"
 * (6c) route itu TIDAK LAGI mengirim email sama sekali (lihat komentar di
 * sana) — batas ini sekarang melindungi kuota TULIS Firestore (pembuatan
 * dokumen niat_dukungan) dari SATU akun yang mengisi formulir di banyak
 * kegiatan sekaligus, BUKAN lagi kuota Brevo (itu urusan
 * putuskanBatasKirimKodeHarian-nya sendiri di POST /api/dukungan/kirim-kode,
 * yang justru TIDAK diekstrak jadi fungsi murni terpisah — lihat komentar
 * di route itu). TIDAK menggantikan pembatasan satu-kali-per-kegiatan
 * (niat_dukungan/{kegiatanId}__{uid} sudah ada — dicek terpisah oleh
 * pemanggil lewat .exists sebelum sampai ke fungsi ini) — keduanya berlaku
 * bersamaan, independen satu sama lain.
 *
 * jumlahSaatIni: jumlah dokumen niat_dukungan yang SUDAH dibuat hari ini
 * untuk akun ini (dibaca pemanggil dari kuota_email/{tanggal}, field
 * `dukunganNiat_${uid}` — lihat komentar di firestore.rules
 * match /kuota_email/{tanggal}), SEBELUM percobaan yang sedang diputuskan
 * ini. Sama pola dengan putuskanBatasHarian()/putuskanKuotaKegiatan()
 * (src/lib/kuota-peserta.ts) dan putuskanBatasPemakaianKode()
 * (src/lib/akses-kegiatan.ts).
 */
export function putuskanBatasNiatHarian(jumlahSaatIni: number): HasilKeputusanKuota {
  if (jumlahSaatIni >= BATAS_NIAT_PER_HARI) {
    return { ok: false, pesan: PESAN_BATAS_NIAT_TERCAPAI };
  }
  return OK_KUOTA;
}

export const BATAS_DUKUNGAN_ADMIN_PER_HARI = 20;
export const PESAN_BATAS_DUKUNGAN_ADMIN_TERCAPAI =
  "Anda sudah membuat 20 catatan dukungan hari ini. Coba lagi besok.";

/**
 * Batas 20/hari pada POST /api/dukungan/admin — tanpa ini SATU akun admin
 * bisa mengirim email lewat Brevo tanpa henti (route itu sebelum Slice
 * "urutan-dukungan" 6c tidak punya batas apa pun). jumlahSaatIni: jumlah
 * catatan yang SUDAH dibuat admin/panitia ini hari ini (dibaca pemanggil
 * dari kuota_email/{tanggal}, field `dukunganAdmin_${uid}` — uid ADMIN yang
 * memanggil, bukan uid peserta yang dibuatkan catatan), SEBELUM percobaan
 * ini. Sama pola dengan putuskanBatasNiatHarian() di atas.
 */
export function putuskanBatasDukunganAdminHarian(jumlahSaatIni: number): HasilKeputusanKuota {
  if (jumlahSaatIni >= BATAS_DUKUNGAN_ADMIN_PER_HARI) {
    return { ok: false, pesan: PESAN_BATAS_DUKUNGAN_ADMIN_TERCAPAI };
  }
  return OK_KUOTA;
}

/**
 * Slice "persetujuan-dukungan" (6e) — status AWAL dokumen niat_dukungan
 * saat POST /api/dukungan/niat membuatnya (dan HANYA di situ — dokumen
 * yang sudah ada tidak pernah dibuat ulang lewat sini). Murni dari
 * dukungan.perluPersetujuan kegiatan ini; diekstrak jadi fungsi murni
 * (dipakai satu baris di route itu) supaya bisa diuji tanpa Firestore,
 * sama pola dengan putuskan*() lain di berkas ini.
 */
export function tentukanStatusAwalNiat(perluPersetujuan: boolean): StatusNiatDukungan {
  return perluPersetujuan ? "menunggu" : "tercatat";
}

/**
 * ID dokumen DETERMINISTIK untuk niat_dukungan/{id} — "sudah pernah mengisi
 * atau belum" dijawab dengan SATU pembacaan dokumen (tx.get()/doc().get()),
 * bukan query — hemat kuota baca Spark, dan tidak ada bentuk query yang
 * perlu diizinkan di firestore.rules (koleksinya sendiri sudah
 * `allow read, write: if false` tanpa kecuali).
 *
 * Separator "__" (dua garis bawah) aman dari tabrakan: baik ID dokumen
 * Firestore auto-generate maupun uid Firebase Auth memakai alfabet base62
 * (huruf besar/kecil + angka) yang tidak pernah memuat garis bawah, jadi
 * kegiatanId dan uid tidak pernah bisa "menyatu" jadi kombinasi yang sama
 * dengan pasangan (kegiatanId, uid) yang berbeda.
 */
export function idNiatDukungan(kegiatanId: string, uid: string): string {
  return `${kegiatanId}__${uid}`;
}

function isStatusNiatDukungan(value: unknown): value is StatusNiatDukungan {
  return value === "tercatat" || value === "menunggu" || value === "terkirim" || value === "gagal";
}

function isDibuatOlehNiatDukungan(value: unknown): value is DibuatOlehNiatDukungan {
  return value === "sendiri" || value === "admin";
}

/**
 * Slice "csv-siap-impor" (6d) — satu baris niat_dukungan dipetakan jadi satu
 * baris CSV yang dimengerti importir peserta yang sudah ada
 * (uraiDaftarHadir(), src/lib/services/impor-hadir.ts). URUTAN dan JUMLAH
 * kolom di sini HARUS sama persis dengan headerTemplatImporCsv(formulirPeserta)
 * untuk formulirPeserta yang SAMA — importir membaca kolom berdasarkan
 * POSISI, bukan nama, jadi kolom asing/tertukar akan membuatnya salah baca.
 *
 * niat_dukungan TIDAK PERNAH mengumpulkan institusi/nomorIdentitas/noTelepon
 * (lihat NiatDukungan, src/types/niat-dukungan.ts) — kolom itu SELALU
 * dikosongkan di sini, apa pun isinya di formulirPeserta kegiatan ini.
 * DIPUTUSKAN (bukan diakali dengan data karangan): kalau kegiatan
 * mewajibkan salah satunya, baris ini akan tertandai 'data_wajib_kurang'
 * saat ditempel ke Impor peserta — mekanisme yang SUDAH ADA di
 * tandaiBarisImpor() ("kolomnya ADA di baris ini tapi KOSONG, isi
 * nilainya"), bukan kegagalan diam-diam — admin mengisinya manual di
 * spreadsheet sebelum mengimpor sungguhan.
 */
export function petakanNiatDukunganKeBarisImpor(
  item: Pick<NiatDukungan, "email" | "namaDipakai">,
  formulirPeserta: FormulirPeserta
): string[] {
  const kolomTambahan = kolomTambahanUntukFormulir(formulirPeserta);
  return [item.email, item.namaDipakai, ...kolomTambahan.map(() => "")];
}

/**
 * Dipetakan dari DocumentData Admin SDK mentah (dipakai GET
 * /api/admin/kegiatan/[kegiatanId]/dukungan) — bukan client SDK, koleksi
 * ini server-only. KA-1: field yang tidak ada dibaca sebagai default yang
 * aman, tidak melempar.
 */
export function mapNiatDukungan(id: string, data: Record<string, unknown>): NiatDukungan {
  return {
    id,
    kegiatanId: typeof data.kegiatanId === "string" ? data.kegiatanId : "",
    uid: typeof data.uid === "string" ? data.uid : "",
    email: typeof data.email === "string" ? data.email : "",
    namaDipakai: typeof data.namaDipakai === "string" ? data.namaDipakai : "",
    nominal: typeof data.nominal === "number" ? data.nominal : null,
    catatan: typeof data.catatan === "string" ? data.catatan : "",
    dibuatPada: typeof data.dibuatPada === "string" ? data.dibuatPada : "",
    dibuatOleh: isDibuatOlehNiatDukungan(data.dibuatOleh) ? data.dibuatOleh : "sendiri",
    status: isStatusNiatDukungan(data.status) ? data.status : "gagal",
    alasanGagal: typeof data.alasanGagal === "string" ? data.alasanGagal : "",
    dikirimPada: typeof data.dikirimPada === "string" ? data.dikirimPada : null,
    jumlahKirim: typeof data.jumlahKirim === "number" ? data.jumlahKirim : 0,
  };
}
