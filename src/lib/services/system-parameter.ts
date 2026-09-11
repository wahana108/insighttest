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
 * menyertakan batasPendaftaranBaruPerHari (bukan opsional) — kalau field
 * ini pernah lupa disertakan, ia akan lenyap setiap kali admin menyimpan
 * pengaturan lain, walau tidak pernah dimaksudkan berubah.
 */
export async function updateSystemParameter(
  next: Pick<
    SystemParameter,
    "namaPlatform" | "modePendaftaran" | "pesanBeranda" | "urlPublik" | "batasPendaftaranBaruPerHari"
  >,
  updatedBy: string
): Promise<void> {
  await setDoc(doc(db, "parameter", PARAMETER_DOC_ID), {
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
}
