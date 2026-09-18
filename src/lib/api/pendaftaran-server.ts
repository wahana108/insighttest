import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { normalkanAmbangKeterlibatan } from "@/lib/atestasi-pernyataan";
import type { AmbangKeterlibatan, KategoriModul, ModeAmbangKeterlibatan } from "@/types/kegiatan";
import type { ModulSnapshotItem } from "@/types/pendaftaran";

export interface DataIdentitasProfil {
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

export interface TulisanBalikIdentitasPendaftaran {
  namaLengkap?: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
  identitasBelumLengkap: false;
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function isModeAmbangKeterlibatan(value: unknown): value is ModeAmbangKeterlibatan {
  return value === "persen" || value === "menit";
}

/**
 * Sama seperti mapAmbangKeterlibatan() di src/lib/services/modul.ts (tidak
 * bisa dipakai bersama — itu memakai firebase/firestore klien, ini Admin
 * SDK server) — migrasi ambangKreditPersen lama ke { mode, nilai } baru
 * (Slice 7.3), supaya modul lama tidak jadi tak terbaca saat pendaftaran
 * membekukan snapshotnya.
 */
function ambangKeterlibatanUntukSnapshot(
  value: unknown,
  dataLegacy: Record<string, unknown>
): AmbangKeterlibatan {
  if (typeof value === "object" && value !== null) {
    const data = value as Record<string, unknown>;
    if (isModeAmbangKeterlibatan(data.mode) && typeof data.nilai === "number") {
      return { mode: data.mode, nilai: data.nilai };
    }
  }
  if (typeof dataLegacy.ambangKreditPersen === "number") {
    return { mode: "persen", nilai: dataLegacy.ambangKreditPersen };
  }
  return { mode: "persen", nilai: 90 };
}

/**
 * KA-5 (docs/arsitektur.md): cuplikan modul kegiatan PADA SAAT pendaftaran
 * dibuat — bukan rujukan hidup. SATU implementasi, dipakai SAMA oleh
 * POST /api/pendaftaran (mandiri, Slice 3.3) dan jalur impor daftar hadir
 * (Slice 6.2) — kedua jalur TIDAK BOLEH diam-diam berbeda perilaku
 * pembekuan, itulah yang coba dihindari KA-5 sejak awal. Dipanggil di
 * dalam transaksi pemanggil (tx di sini adalah transaksi pendaftaran itu
 * sendiri), supaya modulSnapshot konsisten dengan pembacaan lain dalam
 * transaksi yang sama.
 */
export async function buatModulSnapshot(
  kegiatanRef: DocumentReference,
  tx: Transaction
): Promise<ModulSnapshotItem[]> {
  const modulSnap = await tx.get(kegiatanRef.collection("modul"));
  return modulSnap.docs.map((modulDoc) => {
    const data = modulDoc.data();
    const evaluasi =
      typeof data.evaluasi === "object" && data.evaluasi !== null
        ? (data.evaluasi as Record<string, unknown>)
        : null;
    const atestasi =
      typeof data.atestasi === "object" && data.atestasi !== null
        ? (data.atestasi as Record<string, unknown>)
        : null;
    const durasiDetik =
      atestasi && typeof atestasi.durasiDetik === "number" ? atestasi.durasiDetik : null;
    return {
      modulId: modulDoc.id,
      judul: typeof data.judul === "string" ? data.judul : "",
      kategori: isKategoriModul(data.kategori) ? data.kategori : "evaluasi",
      wajib: typeof data.wajib === "boolean" ? data.wajib : true,
      nilaiMinimum:
        evaluasi && typeof evaluasi.nilaiMinimum === "number" ? evaluasi.nilaiMinimum : null,
      ambangKeterlibatan: atestasi
        ? normalkanAmbangKeterlibatan(
            ambangKeterlibatanUntukSnapshot(atestasi.ambangKeterlibatan, atestasi),
            durasiDetik
          ).ambang
        : null,
      targetSkor:
        atestasi && typeof atestasi.targetSkor === "number" ? atestasi.targetSkor : null,
      durasiDetik,
    };
  });
}

/**
 * Slice "lengkapi-sendiri" (6f) — SATU helper bersama, dipanggil dari POST
 * /api/attempt dan POST /api/modul/dibuka SAAT putuskanIdentitasPendaftaran()
 * menyatakan LOLOS dan pendaftaran.identitasBelumLengkap masih true. Ini
 * TULIS BALIK dari users/{uid} ke pendaftaran/{id} — perlu karena rekap CSV
 * (src/app/api/admin/rekap/[kegiatanId]/route.ts) membaca nama dan institusi
 * dari dokumen pendaftaran (salinan BEKU saat mendaftar/diimpor), BUKAN dari
 * profil hidup — tanpa tulis balik ini, baris yang diimpor dengan data
 * kosong akan SELAMANYA kosong di rekap walau peserta sudah melengkapi
 * profilnya. Sertifikat TIDAK terpengaruh sama sekali oleh tulis balik ini:
 * ia mengambil namaLengkap dari pendaftaran juga, tapi namaLengkap SUDAH
 * SELALU terisi sejak impor (hanya institusi/nomorIdentitas/noTelepon yang
 * boleh kosong lewat 'lengkapi_sendiri') — sertifikat tidak pernah menampilkan
 * institusi, jadi tidak ada apa pun untuk "diperbaiki" di sana.
 *
 * PENTING (jebakan yang sudah beberapa kali menggigit di proyek ini):
 * update() dengan field disebut SATU PER SATU — BUKAN set() non-merge.
 * Dokumen pendaftaran memuat modulSnapshot, nomorUrut, hasilModul,
 * referensiDibuka, sumber, dan field lain yang TIDAK disebut di sini; set()
 * non-merge akan MENGHAPUS semuanya, menyisakan hanya field yang dituliskan.
 */
export async function tulisBalikIdentitasPendaftaran(
  pendaftaranRef: DocumentReference,
  profil: DataIdentitasProfil
): Promise<void> {
  await pendaftaranRef.update({ ...susunTulisanBalikIdentitasPendaftaran(profil) });
}

/**
 * Fungsi murni — diekstrak dari tulisBalikIdentitasPendaftaran() di atas
 * supaya bisa diuji tanpa Firestore.
 *
 * PAGAR: namaLengkap HANYA disertakan kalau profil.namaLengkap.trim() TIDAK
 * kosong — kalau kosong, field itu TIDAK ADA SAMA SEKALI di objek update()
 * (bukan ditulis ""). namaLengkap di dokumen pendaftaran adalah yang
 * DICETAK SERTIFIKAT (src/lib/api/sertifikat-server.ts:372-378 membacanya
 * dari pendaftaran, bukan dari profil hidup) — kalau profil users/{uid}
 * kebetulan belum/tidak terisi namanya saat tulis balik ini terjadi, nama
 * yang SUDAH BENAR di pendaftaran (diisi wajib saat mendaftar/diimpor)
 * TIDAK BOLEH ikut terhapus hanya karena profil belum sinkron. JANGAN
 * "dirapikan" balik jadi field tunggal `namaLengkap: profil.namaLengkap` —
 * itulah persis bug yang pagar ini mencegah.
 *
 * institusi/nomorIdentitas/noTelepon TETAP ditulis apa adanya termasuk
 * saat kosong — mengosongkannya memang mencerminkan maksud peserta yang
 * sedang melengkapi profilnya, bukan data yang hilang tanpa sengaja.
 */
export function susunTulisanBalikIdentitasPendaftaran(
  profil: DataIdentitasProfil
): TulisanBalikIdentitasPendaftaran {
  return {
    ...(profil.namaLengkap.trim() ? { namaLengkap: profil.namaLengkap } : {}),
    institusi: profil.institusi,
    nomorIdentitas: profil.nomorIdentitas,
    noTelepon: profil.noTelepon,
    identitasBelumLengkap: false,
  };
}
