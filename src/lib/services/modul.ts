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
import { normalkanAmbangKeterlibatan } from "@/lib/atestasi-pernyataan";
import { db } from "@/lib/firebase/client";
import { periksaUrlAtestasi } from "@/lib/validasi-url-atestasi";
import { ekstrakYoutubeId } from "@/lib/youtube";
import type {
  AmbangKeterlibatan,
  KategoriModul,
  KonfigurasiAtestasi,
  KonfigurasiEvaluasi,
  KonfigurasiReferensi,
  ModeAmbangKeterlibatan,
  ModulKegiatan,
  PemilihanSoal,
  TipeReferensi,
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

function isTipeReferensi(value: unknown): value is TipeReferensi {
  return value === "youtube" || value === "tautan" || value === "teks";
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

function mapReferensi(value: unknown): KonfigurasiReferensi | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  if (!isTipeReferensi(data.tipe)) {
    return null;
  }
  return {
    tipe: data.tipe,
    sumber: typeof data.sumber === "string" ? data.sumber : "",
    deskripsi: typeof data.deskripsi === "string" ? data.deskripsi : "",
  };
}

function isModeAmbangKeterlibatan(value: unknown): value is ModeAmbangKeterlibatan {
  return value === "persen" || value === "menit";
}

/**
 * Slice 7.3: ambangKreditPersen (angka tunggal) diganti ambangKeterlibatan
 * (mode + nilai). Modul lama yang masih menyimpan ambangKreditPersen
 * dipetakan ke { mode: 'persen', nilai: <angka lama> } — jangan sampai
 * modul lama jadi tak terbaca. Modul yang tidak punya keduanya (harusnya
 * tidak terjadi untuk atestasi asli, tapi dijaga defensif) jatuh ke
 * default { mode: 'persen', nilai: 90 }.
 *
 * Slice 7.5: nilai MENTAH di sini bisa mustahil dievaluasi (persen tanpa
 * durasi diketahui — migrasi 7.3 di atas tidak pernah memeriksa durasi).
 * mapAtestasi() di bawah SELALU memanggil normalkanAmbangKeterlibatan()
 * pada hasil fungsi ini — jangan pernah memakai return value fungsi ini
 * langsung tanpa dinormalkan.
 */
function mapAmbangKeterlibatan(value: unknown, dataLegacy: Record<string, unknown>): AmbangKeterlibatan {
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

function mapAtestasi(value: unknown): KonfigurasiAtestasi | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  const durasiDetik = typeof data.durasiDetik === "number" ? data.durasiDetik : null;
  // Slice 7.5: ambangKeterlibatan mentah (di atas, bisa persen+durasi tidak
  // diketahui — bug migrasi 7.3) DINORMALKAN di sini, di titik baca —
  // supaya modul lama yang tersimpan mustahil dievaluasi otomatis
  // terkoreksi tanpa migrasi data, dan form admin (yang membaca lewat
  // getModulList()) melihat satuan yang benar plus tanda perlu ditinjau.
  const { ambang, dikoreksi } = normalkanAmbangKeterlibatan(
    mapAmbangKeterlibatan(data.ambangKeterlibatan, data),
    durasiDetik
  );
  return {
    sumberUrl: typeof data.sumberUrl === "string" ? data.sumberUrl : "",
    gameId: typeof data.gameId === "string" ? data.gameId : "",
    gameName: typeof data.gameName === "string" ? data.gameName : "",
    versi: typeof data.versi === "string" ? data.versi : "",
    durasiDetik,
    ambangKeterlibatan: ambang,
    ambangDikoreksi: dikoreksi,
    targetSkor: typeof data.targetSkor === "number" ? data.targetSkor : null,
    originDiizinkan: typeof data.originDiizinkan === "string" ? data.originDiizinkan : "",
    mintaNicknameCcl:
      typeof data.mintaNicknameCcl === "boolean" ? data.mintaNicknameCcl : false,
    diverifikasiPada:
      typeof data.diverifikasiPada === "string" ? data.diverifikasiPada : "",
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
    referensi: mapReferensi(data.referensi),
    atestasi: mapAtestasi(data.atestasi),
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
  referensi: KonfigurasiReferensi | null;
  atestasi: KonfigurasiAtestasi | null;
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
 * Ketiga kategori punya UI dan aturan validasi mulai slice ini.
 *
 * atestasi: gameId/gameName/versi/originDiizinkan/diverifikasiPada HANYA
 * bisa terisi lewat gerbang postMessage di form
 * (src/lib/verifikasi-atestasi-client.ts) — kalau salah satunya kosong di
 * sini, gerbang itu belum pernah lolos untuk konfigurasi yang sedang
 * dicoba disimpan, jadi ditolak. Ini pagar terakhir, bukan pengganti
 * gerbangnya — validasiModul() tidak menjalankan iframe/postMessage
 * sendiri (itu perlu DOM, tidak cocok di fungsi murni ini).
 */
export async function validasiModul(input: ModulWriteInput): Promise<void> {
  if (!input.judul.trim()) {
    throw new ModulError("Judul modul wajib diisi.");
  }

  if (input.kategori === "atestasi") {
    if (!input.atestasi) {
      throw new ModulError("Konfigurasi atestasi wajib diisi untuk modul kategori atestasi.");
    }
    const {
      sumberUrl,
      gameId,
      originDiizinkan,
      diverifikasiPada,
      ambangKeterlibatan,
      targetSkor,
    } = input.atestasi;
    if (!sumberUrl.trim()) {
      throw new ModulError("URL sumber wajib diisi untuk modul atestasi.");
    }
    const validasiUrl = periksaUrlAtestasi(sumberUrl);
    if (!validasiUrl.valid) {
      throw new ModulError(validasiUrl.alasan ?? "URL sumber tidak valid.");
    }
    if (!gameId || !originDiizinkan || !diverifikasiPada) {
      throw new ModulError(
        "Modul ini belum lolos gerbang verifikasi game — klik \"Verifikasi & simpan\" dan " +
          "tunggu CCL_READY sebelum menyimpan."
      );
    }
    // mode ditentukan OTOMATIS oleh gerbang verifikasi (lihat komentar di
    // KonfigurasiAtestasi) — hanya nilai yang divalidasi di sini, dengan
    // rentang wajar berbeda per satuan.
    if (!Number.isFinite(ambangKeterlibatan.nilai) || ambangKeterlibatan.nilai < 0) {
      throw new ModulError("Ambang keterlibatan harus angka 0 atau lebih.");
    }
    if (ambangKeterlibatan.mode === "persen" && ambangKeterlibatan.nilai > 100) {
      throw new ModulError("Ambang keterlibatan bermode persen harus di antara 0 dan 100.");
    }
    if (targetSkor !== null && (!Number.isFinite(targetSkor) || targetSkor < 0)) {
      throw new ModulError("Target skor, kalau diisi, harus angka 0 atau lebih.");
    }
    return;
  }

  if (input.kategori === "referensi") {
    if (!input.referensi) {
      throw new ModulError("Konfigurasi referensi wajib diisi untuk modul kategori referensi.");
    }
    const { tipe, sumber } = input.referensi;
    if (!sumber.trim()) {
      throw new ModulError("Sumber wajib diisi untuk modul referensi.");
    }
    if (tipe === "youtube" && !ekstrakYoutubeId(sumber.trim())) {
      throw new ModulError(
        "URL YouTube tidak dikenali — gunakan salah satu bentuk: youtu.be/{id}, " +
          "youtube.com/watch?v={id}, atau youtube.com/embed/{id}."
      );
    }
    if (tipe === "tautan") {
      let url: URL;
      try {
        url = new URL(sumber.trim());
      } catch {
        throw new ModulError("Sumber untuk tipe tautan harus berupa URL yang valid.");
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new ModulError("Sumber untuk tipe tautan harus berupa URL http/https.");
      }
    }
    return;
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
    referensi: input.referensi,
    atestasi: input.atestasi,
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
    referensi: input.referensi,
    atestasi: input.atestasi,
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
