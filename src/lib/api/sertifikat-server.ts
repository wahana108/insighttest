import { randomInt } from "node:crypto";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { evaluasiKelayakan } from "@/lib/sertifikat-syarat";
import type { JenisSyaratSertifikat, KategoriModul } from "@/types/kegiatan";
import type { HasilModul, ModulSnapshotItem } from "@/types/pendaftaran";
import type { ItemSertifikat, Sertifikat, SertifikatDetail, StatusSertifikat } from "@/types/sertifikat";

export class SertifikatRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SertifikatRouteError";
    this.status = status;
  }
}

const ALFABET_KODE_VERIFIKASI = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function buatKodeVerifikasi(): string {
  let hasil = "";
  for (let i = 0; i < 10; i += 1) {
    hasil += ALFABET_KODE_VERIFIKASI[randomInt(ALFABET_KODE_VERIFIKASI.length)];
  }
  return hasil;
}

/**
 * Acak, bukan diturunkan dari serial atau id apa pun — tidak boleh bisa
 * ditebak. Dicek unik terhadap sertifikat yang sudah ada; 36^10 kemungkinan
 * membuat tabrakan nyaris mustahil, tapi tetap dicek, bukan diasumsikan.
 */
export async function buatKodeVerifikasiUnik(db: Firestore): Promise<string> {
  for (let percobaan = 0; percobaan < 5; percobaan += 1) {
    const kandidat = buatKodeVerifikasi();
    const existing = await db
      .collection("sertifikat")
      .where("kodeVerifikasi", "==", kandidat)
      .limit(1)
      .get();
    if (existing.empty) {
      return kandidat;
    }
  }
  throw new SertifikatRouteError(500, "Gagal membuat kode verifikasi unik, coba lagi.");
}

export function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
}

export function mapItemsSertifikat(value: unknown): ItemSertifikat[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      modulId: typeof item.modulId === "string" ? item.modulId : "",
      judul: typeof item.judul === "string" ? item.judul : "",
      skor: typeof item.skor === "number" ? item.skor : 0,
      lulus: typeof item.lulus === "boolean" ? item.lulus : false,
    }));
}

/**
 * Menggabungkan snapshot sertifikat (KA-6, dibekukan) dengan template
 * sertifikat LIVE dari dokumen kegiatan saat ini — dipakai bersama oleh
 * GET /api/sertifikat/[id] dan GET /api/sertifikat/cetak/[kodeVerifikasi],
 * satu sumber kebenaran untuk bentuk respons keduanya.
 */
export function buildSertifikatDetail(
  sertifikatId: string,
  kegiatanId: string,
  data: DocumentData,
  kegiatanData: DocumentData
): SertifikatDetail {
  const templateRaw =
    typeof kegiatanData.templateSertifikat === "object" && kegiatanData.templateSertifikat !== null
      ? (kegiatanData.templateSertifikat as Record<string, unknown>)
      : {};

  return {
    id: sertifikatId,
    kegiatanId,
    serial: typeof data.serial === "string" ? data.serial : "",
    kodeVerifikasi: typeof data.kodeVerifikasi === "string" ? data.kodeVerifikasi : "",
    namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
    judulKegiatan: typeof data.judulKegiatan === "string" ? data.judulKegiatan : "",
    nilaiAkhir: typeof data.nilaiAkhir === "number" ? data.nilaiAkhir : 0,
    items: mapItemsSertifikat(data.items),
    status: isStatusSertifikat(data.status) ? data.status : "berlaku",
    terbitPada: typeof data.terbitPada === "string" ? data.terbitPada : "",
    template: {
      // logoUrl/kopUrl TETAP live — identitas lembaga, bukan pernyataan
      // perseorangan.
      logoUrl: typeof templateRaw.logoUrl === "string" ? templateRaw.logoUrl : "",
      kopUrl: typeof templateRaw.kopUrl === "string" ? templateRaw.kopUrl : "",
      // penandatanganNama/Jabatan/tandaTanganUrl DIBEKUKAN saat terbit —
      // beda dari logoUrl/kopUrl di atas. Field HADIR di dokumen sertifikat
      // (walau string kosong) berarti sudah dibekukan; mundur ke template
      // hidup hanya kalau field itu sama sekali tidak ada (sertifikat dari
      // sebelum fitur ini ada).
      penandatanganNama:
        typeof data.penandatanganNama === "string"
          ? data.penandatanganNama
          : typeof templateRaw.penandatanganNama === "string"
            ? templateRaw.penandatanganNama
            : "",
      penandatanganJabatan:
        typeof data.penandatanganJabatan === "string"
          ? data.penandatanganJabatan
          : typeof templateRaw.penandatanganJabatan === "string"
            ? templateRaw.penandatanganJabatan
            : "",
      tandaTanganUrl:
        typeof data.tandaTanganUrl === "string"
          ? data.tandaTanganUrl
          : typeof templateRaw.tandaTanganUrl === "string"
            ? templateRaw.tandaTanganUrl
            : "",
      teksTambahan: typeof templateRaw.teksTambahan === "string" ? templateRaw.teksTambahan : "",
    },
  };
}

function isJenisSyarat(value: unknown): value is JenisSyaratSertifikat {
  return value === "nilai_minimum" || value === "manual_admin";
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function mapModulSnapshotUntukKelayakan(value: unknown): ModulSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      modulId: typeof item.modulId === "string" ? item.modulId : "",
      judul: typeof item.judul === "string" ? item.judul : "",
      kategori: isKategoriModul(item.kategori) ? item.kategori : "evaluasi",
      wajib: typeof item.wajib === "boolean" ? item.wajib : true,
      nilaiMinimum: typeof item.nilaiMinimum === "number" ? item.nilaiMinimum : null,
    }));
}

function mapHasilModulUntukKelayakan(value: unknown): Record<string, HasilModul> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, HasilModul> = {};
  for (const [modulId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const data = entry as Record<string, unknown>;
    hasil[modulId] = {
      skorTertinggi: typeof data.skorTertinggi === "number" ? data.skorTertinggi : 0,
      lulus: typeof data.lulus === "boolean" ? data.lulus : false,
      percobaan: typeof data.percobaan === "number" ? data.percobaan : 0,
    };
  }
  return hasil;
}

export interface TerbitkanSertifikatInput {
  kegiatanId: string;
  targetUid: string;
  /**
   * true: peserta menerbitkan miliknya sendiri — hanya boleh untuk
   * syaratSertifikat.jenis 'nilai_minimum' dan hanya kalau
   * evaluasiKelayakan() bilang layak. false: admin menerbitkan (untuk diri
   * sendiri atau orang lain) — boleh untuk jenis apa pun, tidak digerbangi
   * kelayakan (§10, docs/arsitektur.md — admin yang mencoret pratinjau).
   */
  isSelfIssue: boolean;
  actingUid: string;
}

/**
 * SATU jalur penerbitan, dipakai POST /api/sertifikat/terbitkan (mandiri)
 * DAN POST /api/sertifikat/terbitkan-massal (admin) — tidak diduplikasi.
 * ID deterministik sertifikat/{kegiatanId}_{uid} (KA-3). Kalau sudah ada
 * dan 'berlaku', dikembalikan apa adanya — tidak diterbitkan ulang, tidak
 * ditimpa.
 */
export async function terbitkanSertifikatUntuk(
  db: Firestore,
  input: TerbitkanSertifikatInput
): Promise<Sertifikat> {
  const { kegiatanId, targetUid, isSelfIssue, actingUid } = input;

  const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
  const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${targetUid}`);
  const sertifikatRef = db.collection("sertifikat").doc(`${kegiatanId}_${targetUid}`);

  const [kegiatanSnap, pendaftaranSnap, sertifikatSnap] = await Promise.all([
    kegiatanRef.get(),
    pendaftaranRef.get(),
    sertifikatRef.get(),
  ]);

  if (!kegiatanSnap.exists) {
    throw new SertifikatRouteError(404, "Kegiatan tidak ditemukan.");
  }
  if (!pendaftaranSnap.exists) {
    throw new SertifikatRouteError(404, "Pendaftaran tidak ditemukan.");
  }

  if (sertifikatSnap.exists && sertifikatSnap.data()?.status === "berlaku") {
    return { id: sertifikatSnap.id, ...(sertifikatSnap.data() as Omit<Sertifikat, "id">) };
  }

  const kegiatanData = kegiatanSnap.data() ?? {};
  const kode = typeof kegiatanData.kode === "string" ? kegiatanData.kode : "";
  if (!kode) {
    throw new SertifikatRouteError(
      400,
      "Kegiatan ini belum punya kode — isi kode kegiatan dulu di /admin/kegiatan sebelum menerbitkan sertifikat."
    );
  }
  const judulKegiatan = typeof kegiatanData.judul === "string" ? kegiatanData.judul : "";
  const syaratRaw =
    typeof kegiatanData.syaratSertifikat === "object" && kegiatanData.syaratSertifikat !== null
      ? (kegiatanData.syaratSertifikat as Record<string, unknown>)
      : {};
  const jenisSyarat: JenisSyaratSertifikat = isJenisSyarat(syaratRaw.jenis)
    ? syaratRaw.jenis
    : "manual_admin";
  const nilaiMinimumSyarat = typeof syaratRaw.nilaiMinimum === "number" ? syaratRaw.nilaiMinimum : 0;

  // Penandatangan (nama, jabatan, DAN gambar tanda tangannya) DIBEKUKAN di
  // sertifikat — itu pernyataan seseorang, bukan branding. logo/kop TETAP
  // diambil live di buildSertifikatDetail(), tidak di sini.
  const templateRaw =
    typeof kegiatanData.templateSertifikat === "object" && kegiatanData.templateSertifikat !== null
      ? (kegiatanData.templateSertifikat as Record<string, unknown>)
      : {};
  const penandatanganNama =
    typeof templateRaw.penandatanganNama === "string" ? templateRaw.penandatanganNama : "";
  const penandatanganJabatan =
    typeof templateRaw.penandatanganJabatan === "string" ? templateRaw.penandatanganJabatan : "";
  const tandaTanganUrl =
    typeof templateRaw.tandaTanganUrl === "string" ? templateRaw.tandaTanganUrl : "";

  const pendaftaranData = pendaftaranSnap.data() ?? {};
  const modulSnapshot = mapModulSnapshotUntukKelayakan(pendaftaranData.modulSnapshot);
  const hasilModul = mapHasilModulUntukKelayakan(pendaftaranData.hasilModul);
  const namaLengkap =
    typeof pendaftaranData.namaLengkap === "string" ? pendaftaranData.namaLengkap : "";
  const nomorUrut = typeof pendaftaranData.nomorUrut === "number" ? pendaftaranData.nomorUrut : 0;
  const daftarPada =
    typeof pendaftaranData.daftarPada === "string"
      ? pendaftaranData.daftarPada
      : new Date().toISOString();

  const kelayakan = evaluasiKelayakan(
    { modulSnapshot, hasilModul },
    { syaratSertifikat: { jenis: jenisSyarat, nilaiMinimum: nilaiMinimumSyarat } }
  );

  if (isSelfIssue) {
    if (jenisSyarat !== "nilai_minimum") {
      throw new SertifikatRouteError(400, "Kegiatan ini memerlukan penerbitan oleh admin.");
    }
    if (!kelayakan.layak) {
      throw new SertifikatRouteError(400, kelayakan.alasan);
    }
  }

  const tahun = new Date(daftarPada).getFullYear();
  const serial = `${kode}/${tahun}/${String(nomorUrut).padStart(4, "0")}`;
  const kodeVerifikasi = await buatKodeVerifikasiUnik(db);
  const now = new Date().toISOString();

  const record: Omit<Sertifikat, "id"> = {
    kegiatanId,
    uid: targetUid,
    serial,
    kodeVerifikasi,
    namaLengkap,
    judulKegiatan,
    nilaiAkhir: kelayakan.nilaiAkhir,
    items: kelayakan.items,
    status: "berlaku",
    terbitPada: now,
    diterbitkanOleh: actingUid,
    penandatanganNama,
    penandatanganJabatan,
    tandaTanganUrl,
    dicabutPada: null,
    dicabutOleh: null,
    alasanPencabutan: null,
  };

  await db.runTransaction(async (tx) => {
    const recheck = await tx.get(sertifikatRef);
    if (recheck.exists && recheck.data()?.status === "berlaku") {
      throw new SertifikatRouteError(409, "Sertifikat ini baru saja diterbitkan.");
    }
    tx.set(sertifikatRef, record);
    // §10 (docs/arsitektur.md): nomorUrut sudah dialokasikan saat
    // pendaftaran — tidak ada penghitung yang dinaikkan di sini.
    if (kelayakan.layak) {
      tx.update(pendaftaranRef, { status: "selesai" });
    }
  });

  return { id: sertifikatRef.id, ...record };
}
