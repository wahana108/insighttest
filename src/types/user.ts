export type UserRole = "superadmin" | "admin" | "panitia" | "peserta";

export type UserStatus = "pending" | "aktif" | "nonaktif";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  status: UserStatus;
  /** Nama yang akan tercetak di sertifikat (§11, docs/arsitektur.md) — beda dari displayName Google yang sering informal. */
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
  /**
   * Slice 8.2: kewenangan GLOBAL membuat/menyunting soal miliknya sendiri di
   * bank soal — bukan saklar per kegiatan seperti panitiaIzin (lihat
   * src/types/kegiatan.ts). Bank soal tidak terikat kegiatan (KA-6), dan
   * firestore.rules cuma bisa memeriksa satu dokumen (tidak bisa menelusuri
   * semua kegiatan tempat seseorang jadi panitia), jadi izinnya melekat di
   * sini, pada profil pengguna, bukan di kegiatan mana pun. default false;
   * hanya admin/superadmin yang bisa menyalakannya, di /admin/pengguna.
   */
  bolehBuatSoal: boolean;
  createdAt: string;
  updatedAt: string;
}
