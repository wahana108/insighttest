import { randomInt } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

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
