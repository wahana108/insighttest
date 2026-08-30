import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Topik } from "@/types/topik";

export class TopikError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopikError";
  }
}

const KODE_PATTERN = /^[A-Z0-9-]+$/;

/**
 * ID dokumen = kode ternormalisasi — deterministik supaya firestore.rules
 * bisa exists()/get() tanpa query, dan kode ganda mustahil by construction
 * (KA-3, docs/arsitektur.md).
 */
export function normalizeKode(kode: string): string {
  const normalized = kode.trim().toUpperCase().replace(/\s+/g, "-");
  if (!normalized || !KODE_PATTERN.test(normalized)) {
    throw new TopikError(
      "Kode topik hanya boleh berisi huruf, angka, dan tanda hubung (mis. PENALARAN-DASAR)."
    );
  }
  return normalized;
}

function topikRef(kode: string) {
  return doc(db, "topik", kode);
}

/**
 * "KODE — Nama" — dipakai di mana pun topik ditampilkan untuk dipilih atau
 * di daftar, supaya kode (identitasnya) selalu terlihat walau nama dua
 * topik kebetulan sama.
 */
export function formatTopikLabel(topik: Pick<Topik, "kode" | "nama">): string {
  return `${topik.kode} — ${topik.nama}`;
}

export function mapTopik(kode: string, data: DocumentData): Topik {
  return {
    kode,
    nama: typeof data.nama === "string" ? data.nama : "",
    deskripsi: typeof data.deskripsi === "string" ? data.deskripsi : "",
    urutan: typeof data.urutan === "number" ? data.urutan : 0,
    isActive: typeof data.isActive === "boolean" ? data.isActive : true,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
  };
}

export async function getTopikByKode(kode: string): Promise<Topik | null> {
  const normalized = normalizeKode(kode);
  const snapshot = await getDoc(topikRef(normalized));
  if (!snapshot.exists()) {
    return null;
  }
  return mapTopik(normalized, snapshot.data());
}

export async function createTopik(
  input: { kode: string; nama: string; deskripsi: string; urutan: number },
  actorId: string
): Promise<Topik> {
  const kode = normalizeKode(input.kode);
  const nama = input.nama.trim();
  if (!nama) {
    throw new TopikError("Nama topik wajib diisi.");
  }

  const existing = await getTopikByKode(kode);
  if (existing) {
    throw new TopikError("Kode topik ini sudah dipakai.");
  }

  const now = new Date().toISOString();
  const record: Topik = {
    kode,
    nama,
    deskripsi: input.deskripsi.trim(),
    urutan: input.urutan,
    isActive: true,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  };

  await setDoc(topikRef(kode), record);
  return record;
}

/**
 * Kode dikunci sejak dibuat karena ia adalah ID dokumen — menyunting hanya
 * boleh menyentuh field selain kode.
 */
export async function updateTopik(
  kode: string,
  input: { nama: string; deskripsi: string; urutan: number },
  actorId: string
): Promise<void> {
  const normalized = normalizeKode(kode);
  const nama = input.nama.trim();
  if (!nama) {
    throw new TopikError("Nama topik wajib diisi.");
  }

  await updateDoc(topikRef(normalized), {
    nama,
    deskripsi: input.deskripsi.trim(),
    urutan: input.urutan,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

/**
 * TIDAK ADA hapus permanen — topik yang dihapus akan meninggalkan soal
 * yatim (bank soal merujuk topik lewat kode, KA-6). Nonaktifkan lewat
 * isActive sebagai gantinya.
 */
export async function setTopikActive(
  kode: string,
  isActive: boolean,
  actorId: string
): Promise<void> {
  const normalized = normalizeKode(kode);
  await updateDoc(topikRef(normalized), {
    isActive,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}
