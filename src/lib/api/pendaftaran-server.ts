import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { normalkanAmbangKeterlibatan } from "@/lib/atestasi-pernyataan";
import type { AmbangKeterlibatan, KategoriModul, ModeAmbangKeterlibatan } from "@/types/kegiatan";
import type { ModulSnapshotItem } from "@/types/pendaftaran";

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
