import type { HasilKeputusanKuota } from "@/lib/kuota-peserta";
import type {
  DibuatOlehNiatDukungan,
  NiatDukungan,
  StatusNiatDukungan,
} from "@/types/niat-dukungan";

/**
 * Slice "niat-dukungan" (6b) — fungsi murni saja di sini, tidak ada akses
 * Firestore/jaringan (sama pola dengan src/lib/akses-kegiatan.ts). I/O
 * sesungguhnya ada di POST /api/dukungan/{niat,kirim-ulang,admin} dan GET
 * /api/admin/kegiatan/[kegiatanId]/dukungan.
 */

const OK_KUOTA: HasilKeputusanKuota = { ok: true, pesan: null };

export const BATAS_NIAT_PER_HARI = 5;
export const PESAN_BATAS_NIAT_TERCAPAI =
  "Anda sudah mengisi 5 formulir dukungan hari ini. Coba lagi besok.";

/**
 * Batas 5/hari pada POST /api/dukungan/niat — melindungi kuota Brevo dan
 * kuota tulis Firestore dari SATU akun yang mengisi formulir di banyak
 * kegiatan sekaligus. TIDAK menggantikan pembatasan satu-kali-per-kegiatan
 * (niat_dukungan/{kegiatanId}__{uid} sudah ada — dicek terpisah oleh
 * pemanggil lewat .exists sebelum sampai ke fungsi ini) — keduanya berlaku
 * bersamaan, independen satu sama lain.
 *
 * jumlahSaatIni: jumlah pengisian yang SUDAH tercatat TERKIRIM hari ini
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
  return value === "terkirim" || value === "gagal";
}

function isDibuatOlehNiatDukungan(value: unknown): value is DibuatOlehNiatDukungan {
  return value === "sendiri" || value === "admin";
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
