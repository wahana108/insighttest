import type { UserRole } from "@/types/user";

/**
 * Satu sumber kebenaran untuk "siapa boleh membuat/menyunting soal" (Slice
 * 8.2) — terpisah dari izin-panitia.ts karena ini BUKAN kewenangan per
 * kegiatan. Bank soal global (KA-6, docs/arsitektur.md — tidak terikat
 * kegiatan mana pun), jadi kewenangannya melekat di profil pengguna
 * (users/{uid}.bolehBuatSoal), bukan di panitiaIzin kegiatan tertentu.
 * Dipakai identik di klien (menyembunyikan tombol) dan direimplementasi di
 * firestore.rules (bolehBuatSoalUser() + panitiaPemilikData()) — Rules
 * tidak bisa memanggil TS, jadi kalau salah satu berubah, ubah yang lain.
 * Menyembunyikan tombol bukan pagar.
 */
export interface ProfilUntukIzinSoal {
  uid: string;
  role: UserRole;
  bolehBuatSoal?: boolean;
}

export interface KemampuanSoal {
  /** Boleh membuat soal baru, atau menyunting soal MILIKNYA sendiri. */
  bolehBuat: boolean;
}

const TIDAK_BOLEH: KemampuanSoal = { bolehBuat: false };
const BOLEH: KemampuanSoal = { bolehBuat: true };

/**
 * admin/superadmin → selalu boleh. panitia → boleh hanya kalau
 * bolehBuatSoal true di profilnya (default false). Selain itu (peserta,
 * profil kosong, peran tidak dikenal) → tidak pernah boleh.
 */
export function izinSoal(profil: ProfilUntukIzinSoal | null | undefined): KemampuanSoal {
  if (!profil) {
    return TIDAK_BOLEH;
  }
  if (profil.role === "admin" || profil.role === "superadmin") {
    return BOLEH;
  }
  if (profil.role === "panitia" && profil.bolehBuatSoal === true) {
    return BOLEH;
  }
  return TIDAK_BOLEH;
}

/**
 * Bentuk minimum sebuah soal yang dibutuhkan untuk memeriksa kepemilikan —
 * sengaja `unknown` longgar supaya bisa dipanggil dengan DocumentData
 * mentah, bukan cuma Soal yang sudah dipetakan mapSoal().
 */
export interface SoalUntukIzin {
  dibuatOleh?: unknown;
}

/**
 * admin/superadmin → selalu boleh menyunting soal apa pun. panitia dengan
 * bolehBuatSoal → HANYA soal yang dibuatOleh dirinya sendiri. Soal lama
 * tanpa field dibuatOleh sama sekali (string kosong lewat default) →
 * dibuatOleh tidak akan pernah sama dengan uid siapa pun, jadi
 * diperlakukan sebagai milik admin — panitia tidak bisa menyuntingnya.
 */
export function bolehSuntingSoal(
  profil: ProfilUntukIzinSoal | null | undefined,
  soal: SoalUntukIzin | null | undefined
): boolean {
  if (!profil) {
    return false;
  }
  if (profil.role === "admin" || profil.role === "superadmin") {
    return true;
  }
  if (!izinSoal(profil).bolehBuat) {
    return false;
  }
  const dibuatOleh = typeof soal?.dibuatOleh === "string" ? soal.dibuatOleh : "";
  return dibuatOleh !== "" && dibuatOleh === profil.uid;
}
