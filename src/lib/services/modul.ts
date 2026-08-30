import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  KategoriModul,
  KonfigurasiEvaluasi,
  ModulKegiatan,
  PemilihanSoal,
} from "@/types/kegiatan";

export class ModulError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModulError";
  }
}

function modulCollection(kegiatanId: string) {
  return collection(db, "kegiatan", kegiatanId, "modul");
}

function modulRef(kegiatanId: string, modulId: string) {
  return doc(db, "kegiatan", kegiatanId, "modul", modulId);
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function mapPemilihanSoal(value: unknown): PemilihanSoal {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    mode: data.mode === "acak" ? "acak" : "tetap",
    soalIds: Array.isArray(data.soalIds)
      ? data.soalIds.filter((item): item is string => typeof item === "string")
      : [],
    topikKode: typeof data.topikKode === "string" ? data.topikKode : null,
    jumlah: typeof data.jumlah === "number" ? data.jumlah : null,
  };
}

function mapEvaluasi(value: unknown): KonfigurasiEvaluasi | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  return {
    pemilihanSoal: mapPemilihanSoal(data.pemilihanSoal),
    nilaiMinimum: typeof data.nilaiMinimum === "number" ? data.nilaiMinimum : 0,
    maksPercobaan: typeof data.maksPercobaan === "number" ? data.maksPercobaan : 1,
    batasWaktuMenit: typeof data.batasWaktuMenit === "number" ? data.batasWaktuMenit : null,
    acakUrutanSoal: typeof data.acakUrutanSoal === "boolean" ? data.acakUrutanSoal : false,
  };
}

export function mapModul(id: string, data: DocumentData): ModulKegiatan {
  return {
    id,
    judul: typeof data.judul === "string" ? data.judul : "",
    kategori: isKategoriModul(data.kategori) ? data.kategori : "evaluasi",
    urutan: typeof data.urutan === "number" ? data.urutan : 0,
    wajib: typeof data.wajib === "boolean" ? data.wajib : true,
    evaluasi: mapEvaluasi(data.evaluasi),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
  };
}

export interface ModulWriteInput {
  judul: string;
  kategori: KategoriModul;
  urutan: number;
  wajib: boolean;
  evaluasi: KonfigurasiEvaluasi | null;
}

async function hitungSoalAktifDiTopik(topikKode: string): Promise<number> {
  const snapshot = await getDocs(
    query(
      collection(db, "soal"),
      where("topikKode", "==", topikKode),
      where("isActive", "==", true)
    )
  );
  return snapshot.size;
}

/**
 * Di slice ini hanya kategori 'evaluasi' yang punya UI dan aturan validasi
 * — 'referensi'/'atestasi' sudah masuk tipe tapi ditolak di sini sampai
 * UI-nya ada (docs/arsitektur.md §2).
 */
export async function validasiModul(input: ModulWriteInput): Promise<void> {
  if (!input.judul.trim()) {
    throw new ModulError("Judul modul wajib diisi.");
  }
  if (input.kategori !== "evaluasi") {
    throw new ModulError("Kategori referensi dan atestasi belum didukung di slice ini.");
  }
  if (!input.evaluasi) {
    throw new ModulError("Konfigurasi evaluasi wajib diisi untuk modul kategori evaluasi.");
  }

  const { pemilihanSoal, nilaiMinimum, maksPercobaan, batasWaktuMenit } = input.evaluasi;

  if (!Number.isFinite(nilaiMinimum) || nilaiMinimum < 0) {
    throw new ModulError("Nilai minimum tidak valid.");
  }
  if (!Number.isFinite(maksPercobaan) || maksPercobaan < 1) {
    throw new ModulError("Maks percobaan minimal 1.");
  }
  if (batasWaktuMenit !== null && (!Number.isFinite(batasWaktuMenit) || batasWaktuMenit < 1)) {
    throw new ModulError("Batas waktu, kalau diisi, minimal 1 menit.");
  }

  if (pemilihanSoal.mode === "tetap") {
    if (pemilihanSoal.soalIds.length < 1) {
      throw new ModulError("Mode tetap butuh minimal 1 soal yang dipilih.");
    }
  } else {
    if (!pemilihanSoal.topikKode) {
      throw new ModulError("Mode acak butuh topik.");
    }
    if (!pemilihanSoal.jumlah || pemilihanSoal.jumlah < 1) {
      throw new ModulError("Mode acak butuh jumlah soal minimal 1.");
    }
    const tersedia = await hitungSoalAktifDiTopik(pemilihanSoal.topikKode);
    if (pemilihanSoal.jumlah > tersedia) {
      throw new ModulError(
        `Jumlah soal (${pemilihanSoal.jumlah}) melebihi banyaknya soal aktif di topik itu (${tersedia}).`
      );
    }
  }
}

export async function getModulList(kegiatanId: string): Promise<ModulKegiatan[]> {
  const snapshot = await getDocs(modulCollection(kegiatanId));
  return snapshot.docs.map((item) => mapModul(item.id, item.data()));
}

export async function createModul(
  kegiatanId: string,
  input: ModulWriteInput,
  actorId: string
): Promise<ModulKegiatan> {
  await validasiModul(input);
  const ref = doc(modulCollection(kegiatanId));
  const now = new Date().toISOString();
  const record: ModulKegiatan = {
    id: ref.id,
    judul: input.judul.trim(),
    kategori: input.kategori,
    urutan: input.urutan,
    wajib: input.wajib,
    evaluasi: input.evaluasi,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  };
  await setDoc(ref, record);
  return record;
}

export async function updateModul(
  kegiatanId: string,
  modulId: string,
  input: ModulWriteInput,
  actorId: string
): Promise<void> {
  await validasiModul(input);
  await updateDoc(modulRef(kegiatanId, modulId), {
    judul: input.judul.trim(),
    kategori: input.kategori,
    urutan: input.urutan,
    wajib: input.wajib,
    evaluasi: input.evaluasi,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

/**
 * Modul boleh dihapus permanen (tidak seperti kegiatan/topik/soal) — belum
 * ada peserta yang bisa bergantung padanya di slice ini; pendaftaran baru
 * menyimpan snapshot modul mulai tahap 3 berikutnya (KA-5).
 */
export async function deleteModul(kegiatanId: string, modulId: string): Promise<void> {
  await deleteDoc(modulRef(kegiatanId, modulId));
}
