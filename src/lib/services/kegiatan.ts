import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
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
import { mapFormulirPeserta } from "@/lib/formulir-peserta";
import type {
  FormulirPeserta,
  JenisSyaratSertifikat,
  Kegiatan,
  PanitiaIzin,
  SyaratSertifikat,
  TemplateSertifikat,
} from "@/types/kegiatan";

export const TEMPLATE_SERTIFIKAT_KOSONG: TemplateSertifikat = {
  logoUrl: "",
  kopUrl: "",
  penandatanganNama: "",
  penandatanganJabatan: "",
  tandaTanganUrl: "",
  teksTambahan: "",
};

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
    wajibBukaReferensi:
      typeof data.wajibBukaReferensi === "boolean" ? data.wajibBukaReferensi : false,
    atestasiJadiSyarat:
      typeof data.atestasiJadiSyarat === "boolean" ? data.atestasiJadiSyarat : false,
    // Slice 6.3 — bawaan false SELALU, lihat komentar di types/kegiatan.ts.
    terbitkanKeikutsertaan:
      typeof data.terbitkanKeikutsertaan === "boolean" ? data.terbitkanKeikutsertaan : false,
  };
}

function mapTemplateSertifikat(value: unknown): TemplateSertifikat {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : "",
    kopUrl: typeof data.kopUrl === "string" ? data.kopUrl : "",
    penandatanganNama: typeof data.penandatanganNama === "string" ? data.penandatanganNama : "",
    penandatanganJabatan:
      typeof data.penandatanganJabatan === "string" ? data.penandatanganJabatan : "",
    tandaTanganUrl: typeof data.tandaTanganUrl === "string" ? data.tandaTanganUrl : "",
    teksTambahan: typeof data.teksTambahan === "string" ? data.teksTambahan : "",
  };
}

function normalizeTemplateSertifikat(t: TemplateSertifikat): TemplateSertifikat {
  return {
    logoUrl: t.logoUrl.trim(),
    kopUrl: t.kopUrl.trim(),
    penandatanganNama: t.penandatanganNama.trim(),
    penandatanganJabatan: t.penandatanganJabatan.trim(),
    tandaTanganUrl: t.tandaTanganUrl.trim(),
    teksTambahan: t.teksTambahan.trim(),
  };
}

function mapPanitiaUids(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function mapPanitiaIzinSatuOrang(value: unknown): PanitiaIzin {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    terbitkanSertifikat: data.terbitkanSertifikat === true,
    suntingKegiatan: data.suntingKegiatan === true,
  };
}

/**
 * Dokumen kegiatan lama tidak punya panitiaUids/panitiaIzin sama sekali
 * (Slice 8.1) — keduanya jatuh ke daftar/peta kosong, bukan galat. Kalau
 * salah satunya rusak atau tidak sinkron (mis. uid ada di panitiaUids tapi
 * tidak ada entri panitiaIzin-nya), izinPanitia() (src/lib/izin-panitia.ts)
 * yang memutuskan artinya — di sini cuma dipetakan apa adanya.
 */
function mapPanitiaIzin(value: unknown): Record<string, PanitiaIzin> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, PanitiaIzin> = {};
  for (const [uid, entry] of Object.entries(value as Record<string, unknown>)) {
    hasil[uid] = mapPanitiaIzinSatuOrang(entry);
  }
  return hasil;
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
    templateSertifikat: mapTemplateSertifikat(data.templateSertifikat),
    formulirPeserta: mapFormulirPeserta(data.formulirPeserta),
    panitiaUids: mapPanitiaUids(data.panitiaUids),
    panitiaIzin: mapPanitiaIzin(data.panitiaIzin),
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
  templateSertifikat: TemplateSertifikat;
  formulirPeserta: FormulirPeserta;
}

/**
 * Mengembalikan kode ternormalisasi supaya pemanggil (create/update) tidak
 * perlu menormalkan dua kali.
 *
 * `kodeSaatIni` (hanya untuk update, dari Kegiatan yang sudah dimuat
 * pemanggil — bukan baca tambahan): kalau kode yang disunting SAMA dengan
 * yang sudah tersimpan, kodeSudahDipakai() DILEWATI. Ini bukan cuma
 * optimasi — field "Kode" di /admin/kegiatan/[id] sengaja `disabled` untuk
 * panitia (hanya admin boleh mengubahnya), jadi bagi panitia kode yang
 * disunting SELALU sama dengan yang tersimpan. kodeSudahDipakai() adalah
 * query koleksi tanpa filter yang cocok dengan rule baca /kegiatan/{id}
 * (isPublished/panitiaUids) — Firestore menolak bentuk query itu untuk
 * siapa pun yang bukan admin, terlepas dari data aktualnya (query ditolak
 * berdasarkan BENTUKNYA, bukan hasilnya). Melewatinya saat kode tidak
 * berubah tidak melemahkan keunikan: kalau memang tidak berubah, ia sudah
 * lolos unik saat terakhir disimpan.
 */
async function validasiKegiatan(
  input: KegiatanWriteInput,
  excludeId?: string,
  kodeSaatIni?: string
): Promise<string> {
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
  if (kode !== kodeSaatIni && (await kodeSudahDipakai(kode, excludeId))) {
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
    templateSertifikat: normalizeTemplateSertifikat(input.templateSertifikat),
    formulirPeserta: input.formulirPeserta,
    panitiaUids: [],
    panitiaIzin: {},
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  };
  await setDoc(ref, record);
  return record;
}

/**
 * kodeSaatIni: Kegiatan.kode yang sudah dimuat pemanggil SEBELUM disunting
 * (lihat komentar validasiKegiatan()) — wajib disertakan supaya panitia
 * (yang tidak pernah benar-benar mengubah kode, field itu disabled untuk
 * mereka) tidak memicu query kodeSudahDipakai() yang ditolak rules.
 */
export async function updateKegiatan(
  id: string,
  input: KegiatanWriteInput,
  actorId: string,
  kodeSaatIni: string
): Promise<void> {
  const kode = await validasiKegiatan(input, id, kodeSaatIni);
  await updateDoc(kegiatanRef(id), {
    kode,
    judul: input.judul.trim(),
    deskripsi: input.deskripsi.trim(),
    dibukaPada: input.dibukaPada,
    ditutupPada: input.ditutupPada,
    syaratSertifikat: input.syaratSertifikat,
    templateSertifikat: normalizeTemplateSertifikat(input.templateSertifikat),
    formulirPeserta: input.formulirPeserta,
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

/**
 * Menunjuk panitia baru — menulis panitiaUids DAN panitiaIzin BERSAMAAN
 * (Slice 8.1, §2 kickoff.md), tidak pernah salah satu saja. Pemanggilnya
 * (halaman /admin/kegiatan/[id]) hanya boleh admin/superadmin — dijaga
 * firestore.rules (panitia tidak boleh menyentuh dua field ini sama
 * sekali), bukan cuma disembunyikan di UI.
 */
export async function tetapkanPanitia(
  kegiatanId: string,
  uid: string,
  izin: PanitiaIzin,
  actorId: string
): Promise<void> {
  await updateDoc(kegiatanRef(kegiatanId), {
    panitiaUids: arrayUnion(uid),
    [`panitiaIzin.${uid}`]: izin,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

/** Mengubah tiga saklar panitia yang SUDAH ditugaskan — panitiaUids tidak disentuh. */
export async function ubahIzinPanitia(
  kegiatanId: string,
  uid: string,
  izin: PanitiaIzin,
  actorId: string
): Promise<void> {
  await updateDoc(kegiatanRef(kegiatanId), {
    [`panitiaIzin.${uid}`]: izin,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}

/** Mencabut panitia — menghapus dari panitiaUids DAN panitiaIzin bersamaan. */
export async function cabutPanitia(
  kegiatanId: string,
  uid: string,
  actorId: string
): Promise<void> {
  await updateDoc(kegiatanRef(kegiatanId), {
    panitiaUids: arrayRemove(uid),
    [`panitiaIzin.${uid}`]: deleteField(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
}
