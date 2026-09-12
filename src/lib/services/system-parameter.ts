import { doc, getDoc, setDoc, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ModePendaftaran, SystemParameter } from "@/types/parameter";

const PARAMETER_DOC_ID = "global";

export const DEFAULT_SYSTEM_PARAMETER: SystemParameter = {
  namaPlatform: "InsightTest",
  modePendaftaran: "terbuka",
  pesanBeranda: "",
  urlPublik: "",
  batasPendaftaranBaruPerHari: 0,
  pendaftaranTanpaKataSandi: false,
  updatedAt: null,
  updatedBy: null,
};

function isModePendaftaran(value: unknown): value is ModePendaftaran {
  return value === "terbuka" || value === "persetujuan" || value === "undangan";
}

function mapSystemParameter(data: DocumentData): SystemParameter {
  return {
    namaPlatform:
      typeof data.namaPlatform === "string" && data.namaPlatform.trim()
        ? data.namaPlatform
        : DEFAULT_SYSTEM_PARAMETER.namaPlatform,
    modePendaftaran: isModePendaftaran(data.modePendaftaran)
      ? data.modePendaftaran
      : DEFAULT_SYSTEM_PARAMETER.modePendaftaran,
    pesanBeranda: typeof data.pesanBeranda === "string" ? data.pesanBeranda : "",
    urlPublik: typeof data.urlPublik === "string" ? data.urlPublik : "",
    batasPendaftaranBaruPerHari:
      typeof data.batasPendaftaranBaruPerHari === "number" ? data.batasPendaftaranBaruPerHari : 0,
    pendaftaranTanpaKataSandi: data.pendaftaranTanpaKataSandi === true,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

/**
 * Dokumen tunggal parameter/global. Kalau belum ada, kembalikan nilai
 * default — TIDAK membuat dokumen diam-diam.
 *
 * POLA WAJIB: baca sekali di pemanggil, oper hasilnya sebagai argumen ke
 * fungsi lain yang butuh. Jangan menambah fungsi yang memanggil ulang
 * getSystemParameter() di dalam dirinya.
 */
export async function getSystemParameter(): Promise<SystemParameter> {
  const snapshot = await getDoc(doc(db, "parameter", PARAMETER_DOC_ID));
  if (!snapshot.exists()) {
    return DEFAULT_SYSTEM_PARAMETER;
  }
  return mapSystemParameter(snapshot.data());
}

/**
 * PENTING: setDoc() di bawah TIDAK memakai {merge:true} — ia menimpa
 * SELURUH dokumen parameter/global. Karena itu `next` di sini WAJIB
 * menyertakan SETIAP field yang ada di SystemParameter (kecuali
 * updatedAt/updatedBy, yang ditulis fungsi ini sendiri) — bukan opsional.
 * Field yang lupa disertakan akan lenyap setiap kali admin menyimpan
 * pengaturan lain, walau tidak pernah dimaksudkan berubah. Ini persis
 * jebakan yang sama dengan FieldValue di dalam set() non-merge (5.0c),
 * dalam bentuk berbeda: Pick<> di bawah dibuat SELALU mengikuti seluruh
 * field SystemParameter yang bisa disunting admin — kalau slice
 * berikutnya menambah field lagi, tambahkan juga di sini.
 */
export async function updateSystemParameter(
  next: Pick<
    SystemParameter,
    | "namaPlatform"
    | "modePendaftaran"
    | "pesanBeranda"
    | "urlPublik"
    | "batasPendaftaranBaruPerHari"
    | "pendaftaranTanpaKataSandi"
  >,
  updatedBy: string
): Promise<void> {
  await setDoc(doc(db, "parameter", PARAMETER_DOC_ID), {
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
}
