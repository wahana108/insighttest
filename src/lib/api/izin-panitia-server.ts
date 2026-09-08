import type { Firestore } from "firebase-admin/firestore";
import type { VerifiedUser } from "@/lib/api/auth-server";
import { izinPanitia, type KemampuanPanitia } from "@/lib/izin-panitia";

/**
 * Membaca kegiatan/{kegiatanId} dan mengembalikan izinPanitia() untuk
 * `user` di kegiatan itu — satu tempat dipakai semua Route Handler yang
 * dulu hanya menerima admin (Slice 8.1). Kegiatan yang tidak ada
 * diperlakukan sama seperti kegiatan tanpa panitiaUids (lihat
 * izinPanitia()): admin tetap lolos, siapa pun selainnya tidak.
 */
export async function ambilIzinKegiatan(
  db: Firestore,
  kegiatanId: string,
  user: VerifiedUser
): Promise<KemampuanPanitia> {
  const snap = await db.collection("kegiatan").doc(kegiatanId).get();
  const data = snap.exists ? (snap.data() ?? {}) : {};
  return izinPanitia(user, data);
}
