import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { JenisSyaratSertifikat, Kegiatan, SyaratSertifikat } from "@/types/kegiatan";

export class KegiatanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KegiatanError";
  }
}

function kegiatanRef(id: string) {
  return doc(db, "kegiatan", id);
}

function isJenisSyarat(value: unknown): value is JenisSyaratSertifikat {
  return value === "nilai_minimum" || value === "manual_admin";
}

const KODE_PATTERN = /^[A-Z0-9-]+$/;

/**
 * Menyusun nomor serial sertifikat (§10, docs/arsitektur.md) — beda dari
 * id dokumen (tetap auto), supaya admin bisa memilih kode yang enak dibaca
 * tanpa mengubah rujukan yang sudah ada ke kegiatan itu.
 */
export function normalizeKodeKegiatan(kode: string): string {
  const normalized = kode.trim().toUpperCase().replace(/\s+/g, "-");
  if (!normalized || !KODE_PATTERN.test(normalized)) {
    throw new KegiatanError(
      "Kode kegiatan hanya boleh berisi huruf, angka, dan tanda hubung (mis. DIKLAT-2026)."
    );
  }
  return normalized;
}

/**
 * Unik hanya di antara kegiatan yang belum diarsipkan — kegiatan lama yang
 * diarsipkan boleh "mewariskan" kodenya ke kegiatan baru.
 */
async function kodeSudahDipakai(kode: string, excludeId?: string): Promise<boolean> {
  const snapshot = await getDocs(
    query(collection(db, "kegiatan"), where("kode", "==", kode), where("isArchived", "==", false))
  );
  return snapshot.docs.some((item) => item.id !== excludeId);
}

function mapSyaratSertifikat(value: unknown): SyaratSertifikat {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    jenis: isJenisSyarat(data.jenis) ? data.jenis : "manual_admin",
    nilaiMinimum: typeof data.nilaiMinimum === "number" ? data.nilaiMinimum : 0,
  };
}

export function mapKegiatan(id: string, data: DocumentData): Kegiatan {
  return {
    id,
    kode: typeof data.kode === "string" ? data.kode : "",
    judul: typeof data.judul === "string" ? data.judul : "",
    deskripsi: typeof data.deskripsi === "string" ? data.deskripsi : "",
    dibukaPada: typeof data.dibukaPada === "string" ? data.dibukaPada : null,
    ditutupPada: typeof data.ditutupPada === "string" ? data.ditutupPada : null,
    isPublished: typeof data.isPublished === "boolean" ? data.isPublished : false,
    isArchived: typeof data.isArchived === "boolean" ? data.isArchived : false,
    syaratSertifikat: mapSyaratSertifikat(data.syaratSertifikat),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
  };
}

export interface KegiatanWriteInput {
  kode: string;
  judul: string;
  deskripsi: string;
  dibukaPada: string | null;
  ditutupPada: string | null;
  syaratSertifikat: SyaratSertifikat;
}

/**
 * Mengembalikan kode ternormalisasi supaya pemanggil (create/update) tidak
 * perlu menormalkan dua kali.
 */
async function validasiKegiatan(input: KegiatanWriteInput, excludeId?: string): Promise<string> {
  if (!input.judul.trim()) {
    throw new KegiatanError("Judul kegiatan wajib diisi.");
  }
  if (
    input.syaratSertifikat.jenis === "nilai_minimum" &&
    !(input.syaratSertifikat.nilaiMinimum > 0)
  ) {
    throw new KegiatanError(
      'Nilai minimum wajib lebih dari 0 kalau syarat sertifikat "nilai minimum".'
    );
  }
  if (input.dibukaPada && input.ditutupPada && input.dibukaPada > input.ditutupPada) {
    throw new KegiatanError("Tanggal buka tidak boleh setelah tanggal tutup.");
  }

  const kode = normalizeKodeKegiatan(input.kode);
  if (await kodeSudahDipakai(kode, excludeId)) {
    throw new KegiatanError(
      "Kode kegiatan ini sudah dipakai kegiatan lain yang belum diarsipkan."
    );
  }
  return kode;
}

export async function getKegiatanById(id: string): Promise<Kegiatan | null> {
  const snapshot = await getDoc(kegiatanRef(id));
  if (!snapshot.exists()) {
    return null;
  }
  return mapKegiatan(id, snapshot.data());
}

export async function createKegiatan(
  input: KegiatanWriteInput,
  actorId: string
): Promise<Kegiatan> {
  const kode = await validasiKegiatan(input);
  const ref = doc(collection(db, "kegiatan"));
  const now = new Date().toISOString();
  const record: Kegiatan = {
    id: ref.id,
    kode,
    judul: input.judul.trim(),
    deskripsi: input.deskripsi.trim(),
    dibukaPada: input.dibukaPada,
    ditutupPada: input.ditutupPada,
    isPublished: false,
    isArchived: false,
    syaratSertifikat: input.syaratSertifikat,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  };
  await setDoc(ref, record);
  return record;
}

export async function updateKegiatan(
  id: string,
  input: KegiatanWriteInput,
  actorId: string
): Promise<void> {
  const kode = await validasiKegiatan(input, id);
  await updateDoc(kegiatanRef(id), {
    kode,
    judul: input.judul.trim(),
    deskripsi: input.deskripsi.trim(),
    dibukaPada: input.dibukaPada,
    ditutupPada: input.ditutupPada,
    syaratSertifikat: input.syaratSertifikat,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

export async function setKegiatanPublished(
  id: string,
  isPublished: boolean,
  actorId: string
): Promise<void> {
  await updateDoc(kegiatanRef(id), {
    isPublished,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

/**
 * TIDAK ADA hapus permanen untuk kegiatan — riwayat sertifikat mungkin
 * perlu diverifikasi bertahun kemudian (§4, docs/arsitektur.md).
 * Mengarsipkan menyembunyikan, bukan menghapus.
 */
export async function setKegiatanArchived(
  id: string,
  isArchived: boolean,
  actorId: string
): Promise<void> {
  await updateDoc(kegiatanRef(id), {
    isArchived,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}
