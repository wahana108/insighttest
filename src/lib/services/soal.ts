import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { getTopikByKode } from "@/lib/services/topik";
import type { KunciSoal, OpsiSoal, Soal, TingkatSoal } from "@/types/soal";

export class SoalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SoalError";
  }
}

/**
 * Untuk deteksi duplikat — bukan disimpan, hanya dibandingkan saat itu juga.
 */
export function normalisasiTeks(teks: string): string {
  return teks.trim().replace(/\s+/g, " ");
}

function isTingkat(value: unknown): value is TingkatSoal {
  return value === "mudah" || value === "sedang" || value === "sulit";
}

function mapOpsi(value: unknown): OpsiSoal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      label: typeof item.label === "string" ? item.label : "",
    }));
}

export function mapSoal(id: string, data: DocumentData): Soal {
  return {
    id,
    teks: typeof data.teks === "string" ? data.teks : "",
    tipe: "pilihan_ganda",
    topikKode: typeof data.topikKode === "string" ? data.topikKode : "",
    tingkat: isTingkat(data.tingkat) ? data.tingkat : "sedang",
    opsi: mapOpsi(data.opsi),
    isActive: typeof data.isActive === "boolean" ? data.isActive : true,
    // Soal lama tidak punya field ini sama sekali — string kosong, bukan
    // galat (KA-1). Lihat komentar Soal.dibuatOleh di src/types/soal.ts.
    dibuatOleh: typeof data.dibuatOleh === "string" ? data.dibuatOleh : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
  };
}

export function mapKunciSoal(data: DocumentData): KunciSoal {
  return {
    opsiBenarId: typeof data.opsiBenarId === "string" ? data.opsiBenarId : "",
    pembahasan: typeof data.pembahasan === "string" ? data.pembahasan : "",
  };
}

export interface SoalWriteInput {
  teks: string;
  topikKode: string;
  tingkat: TingkatSoal;
  opsi: OpsiSoal[];
  opsiBenarId: string;
  pembahasan: string;
}

/**
 * Dipakai bersama oleh form manual (/admin/soal) dan importer massal (slice
 * 2.3) — satu tempat untuk aturan minimal soal yang valid.
 */
export async function validasiSoal(input: SoalWriteInput): Promise<void> {
  const teks = input.teks.trim();
  if (!teks) {
    throw new SoalError("Teks soal wajib diisi.");
  }
  if (!Array.isArray(input.opsi) || input.opsi.length < 2) {
    throw new SoalError("Soal butuh minimal 2 opsi.");
  }
  if (input.opsi.some((opsi) => !opsi.label.trim())) {
    throw new SoalError("Semua opsi harus punya label.");
  }
  const opsiIds = input.opsi.map((opsi) => opsi.id);
  if (new Set(opsiIds).size !== opsiIds.length) {
    throw new SoalError("ID opsi tidak boleh duplikat.");
  }
  if (!input.opsiBenarId || !opsiIds.includes(input.opsiBenarId)) {
    throw new SoalError("Tandai tepat satu opsi sebagai jawaban benar.");
  }
  if (!input.topikKode) {
    throw new SoalError("Topik wajib dipilih.");
  }

  const topik = await getTopikByKode(input.topikKode);
  if (!topik) {
    throw new SoalError("Topik tidak ditemukan.");
  }
  if (!topik.isActive) {
    throw new SoalError("Topik ini nonaktif — pilih topik lain.");
  }
}

export interface BuildSoalWriteContext {
  actorId: string;
  /** Diisi saat menyunting soal yang sudah ada; kosongkan untuk soal baru. */
  id?: string;
  createdAt?: string;
  createdBy?: string;
  /**
   * Diisi saat menyunting soal yang sudah ada (dari Soal.dibuatOleh yang
   * sudah tersimpan) — TIDAK PERNAH dari actorId saat menyunting, supaya
   * kepemilikan tidak bisa dialihkan (Slice 8.2 §2). Kosongkan untuk soal
   * baru — barulah jatuh ke actorId (pembuatnya).
   */
  dibuatOleh?: string;
  isActive?: boolean;
}

/**
 * Menerima writeBatch dari luar dan menambahkan tulisan ke 'soal' DAN
 * 'kunci_soal' sekaligus, dengan ID dokumen yang sama untuk keduanya —
 * pasangan deterministik (KA-3, docs/arsitektur.md). Tidak melakukan
 * commit; pemanggil yang commit, supaya importer massal (slice 2.3) bisa
 * menumpuk banyak soal dalam satu batch/commit.
 *
 * dibuatOleh DITULIS DUA KALI, di 'soal' DAN di 'kunci_soal' (bukan cuma di
 * 'soal') — sengaja, bukan kelalaian. firestore.rules untuk kunci_soal
 * butuh tahu siapa pemiliknya TANPA get() lintas dokumen ke 'soal', karena
 * kedua dokumen ini SELALU ditulis bersamaan dalam satu writeBatch — dan
 * terverifikasi lewat emulator (Slice 8.2) bahwa get() ke dokumen lain
 * dalam writeBatch yang sama TIDAK melihat tulisan yang belum ter-commit
 * itu (berlaku baik untuk dokumen baru maupun dokumen yang sudah ada
 * sebelumnya), sehingga rule berbasis get() akan SELALU gagal untuk
 * pasangan ini. Menyalin dibuatOleh ke kunci_soal menghindari itu sama
 * sekali. Satu fungsi ini satu-satunya penulis keduanya, jadi kedua salinan
 * tidak pernah bisa tidak sinkron.
 */
export function buildSoalWrite(
  batch: WriteBatch,
  input: SoalWriteInput,
  ctx: BuildSoalWriteContext
): { id: string; soal: Soal; kunci: KunciSoal } {
  const id = ctx.id ?? doc(collection(db, "soal")).id;
  const now = new Date().toISOString();
  const dibuatOleh = ctx.dibuatOleh ?? ctx.actorId;

  const soal: Soal = {
    id,
    teks: input.teks.trim(),
    tipe: "pilihan_ganda",
    topikKode: input.topikKode,
    tingkat: input.tingkat,
    opsi: input.opsi.map((opsi) => ({ id: opsi.id, label: opsi.label.trim() })),
    isActive: ctx.isActive ?? true,
    dibuatOleh,
    createdAt: ctx.createdAt ?? now,
    createdBy: ctx.createdBy ?? ctx.actorId,
    updatedAt: now,
    updatedBy: ctx.actorId,
  };

  const kunci: KunciSoal = {
    opsiBenarId: input.opsiBenarId,
    pembahasan: input.pembahasan.trim(),
  };

  batch.set(doc(db, "soal", id), soal);
  batch.set(doc(db, "kunci_soal", id), { ...kunci, dibuatOleh });

  return { id, soal, kunci };
}

export async function getSoalById(id: string): Promise<Soal | null> {
  const snapshot = await getDoc(doc(db, "soal", id));
  if (!snapshot.exists()) {
    return null;
  }
  return mapSoal(id, snapshot.data());
}

export async function getKunciSoal(soalId: string): Promise<KunciSoal | null> {
  const snapshot = await getDoc(doc(db, "kunci_soal", soalId));
  if (!snapshot.exists()) {
    return null;
  }
  return mapKunciSoal(snapshot.data());
}

/**
 * Soal dan kuncinya harus tersimpan atomik — writeBatch di sini menjamin
 * semua atau tidak sama sekali.
 */
export async function createSoal(input: SoalWriteInput, actorId: string): Promise<Soal> {
  await validasiSoal(input);
  const batch = writeBatch(db);
  const { soal } = buildSoalWrite(batch, input, { actorId });
  await batch.commit();
  return soal;
}

export async function updateSoal(
  id: string,
  input: SoalWriteInput,
  actorId: string
): Promise<Soal> {
  await validasiSoal(input);
  const existing = await getSoalById(id);
  if (!existing) {
    throw new SoalError("Soal tidak ditemukan.");
  }

  const batch = writeBatch(db);
  const { soal } = buildSoalWrite(batch, input, {
    actorId,
    id,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    // Dipertahankan APA ADANYA — termasuk string kosong untuk soal lama
    // tanpa pemilik. Menyunting tidak pernah mengklaim kepemilikan.
    dibuatOleh: existing.dibuatOleh,
    isActive: existing.isActive,
  });
  await batch.commit();
  return soal;
}

/**
 * TIDAK ADA hapus permanen — soal yang dihapus akan meninggalkan rujukan
 * yatim di kegiatan yang sudah memakainya (KA-6). Nonaktifkan lewat isActive,
 * sama seperti topik.
 */
export async function setSoalActive(id: string, isActive: boolean, actorId: string): Promise<void> {
  await updateDoc(doc(db, "soal", id), {
    isActive,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

/**
 * Bandingkan teks yang dinormalkan terhadap soal lain di topik yang sama.
 * Hanya untuk peringatan di UI — tidak memblokir penyimpanan.
 */
export async function cekDuplikatTeks(
  topikKode: string,
  teks: string,
  excludeId?: string
): Promise<boolean> {
  const target = normalisasiTeks(teks);
  if (!target || !topikKode) {
    return false;
  }
  const snapshot = await getDocs(
    query(collection(db, "soal"), where("topikKode", "==", topikKode))
  );
  return snapshot.docs.some((item) => {
    if (excludeId && item.id === excludeId) {
      return false;
    }
    const data = item.data();
    const existingTeks = typeof data.teks === "string" ? data.teks : "";
    return normalisasiTeks(existingTeks) === target;
  });
}
