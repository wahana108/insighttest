import type { SystemParameter } from "@/types/parameter";

/**
 * Slice "daftar-tanpa-sandi" (docs/kickoff.md §R, SLICE 2) — fungsi murni
 * saja di sini (tidak ada akses Firebase). I/O sesungguhnya (createUser,
 * sendPasswordResetEmail, signOut) ada di src/lib/auth/session.ts, yang
 * memakai keputusan dari fungsi-fungsi ini.
 */

/**
 * Aktif HANYA saat modePendaftaran === 'terbuka' — mode 'persetujuan' dan
 * 'undangan' punya alur gerbangnya sendiri (lihat completeRegistration(),
 * session.ts) dan tidak disentuh slice ini, terlepas dari nilai
 * pendaftaranTanpaKataSandi. Dipakai oleh /daftar DAN /masuk supaya
 * keduanya tidak bisa diam-diam tidak sinkron soal kapan alur ini aktif.
 */
export function pendaftaranTanpaSandiAktif(parameter: SystemParameter): boolean {
  return parameter.modePendaftaran === "terbuka" && parameter.pendaftaranTanpaKataSandi === true;
}

/**
 * Pesan SATU-SATUNYA yang boleh ditampilkan setelah alur tanpa-sandi
 * selesai, baik untuk pendaftar baru maupun untuk kasus email yang sudah
 * terdaftar (disamarkan — lihat putuskanTampilanSetelahDaftarTanpaSandi()
 * di bawah). Harus PERSIS SAMA di kedua kasus, itulah intinya.
 */
export const PESAN_TANPA_SANDI_SUKSES =
  "Kami sudah mengirim tautan untuk membuat kata sandi. Periksa kotak masuk dan folder spam, lalu masuk.";

const PESAN_GALAT_AUTH: Record<string, string> = {
  "auth/invalid-email": "Format email tidak valid.",
  "auth/too-many-requests": "Terlalu banyak percobaan dari perangkat ini. Coba lagi beberapa saat lagi.",
  "auth/network-request-failed": "Gagal terhubung ke server. Periksa koneksi internet Anda.",
};

export function pesanGalatAuthIndonesia(kode: string): string {
  return PESAN_GALAT_AUTH[kode] ?? "Gagal mendaftar. Coba lagi.";
}

export interface KeputusanTampilanTanpaSandi {
  /** true → tampilkan PESAN_TANPA_SANDI_SUKSES, apa pun yang sebenarnya terjadi. */
  tampilkanSukses: boolean;
  /** Hanya terisi kalau tampilkanSukses false. */
  pesanGalat: string | null;
}

/**
 * SATU-SATUNYA tempat yang memutuskan bagaimana galat dari
 * createUserWithEmailAndPassword() ditampilkan. kodeGalat null berarti
 * pembuatan akun BERHASIL (kasus normal).
 *
 * 'auth/email-already-in-use' SENGAJA menghasilkan hasil yang TIDAK BISA
 * dibedakan dari sukses — bukan karena error itu ditelan diam-diam, tapi
 * karena pemanggil (registerWithoutPassword(), session.ts) tetap
 * mengirim sendPasswordResetEmail() ke alamat itu sebelum memanggil
 * fungsi ini. Akibatnya: orang luar tidak belajar apa pun tentang siapa
 * sudah punya akun, DAN pemilik email yang sebenarnya menerima tautan
 * untuk mengambil alih akunnya. Error lain (jaringan, format, terlalu
 * banyak percobaan) tetap tampil apa adanya — menyamarkan SEMUA error
 * akan menyembunyikan masalah nyata dari pengguna yang jujur.
 */
export function putuskanTampilanSetelahDaftarTanpaSandi(
  kodeGalat: string | null
): KeputusanTampilanTanpaSandi {
  if (kodeGalat === null || kodeGalat === "auth/email-already-in-use") {
    return { tampilkanSukses: true, pesanGalat: null };
  }
  return { tampilkanSukses: false, pesanGalat: pesanGalatAuthIndonesia(kodeGalat) };
}

const ALFABET_SANDI_ACAK =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";

/**
 * Kata sandi acak sekali pakai untuk createUserWithEmailAndPassword() pada
 * alur tanpa-sandi — DIBUANG segera setelah dipakai (lihat
 * registerWithoutPassword(), session.ts): tidak disimpan, tidak dicatat
 * log, tidak dikirim ke mana pun. Panjang 32 karakter dari alfabet campuran
 * huruf/angka/simbol jauh di atas syarat minimum Firebase Auth (6 karakter)
 * — tidak ada alasan untuk pernah menampilkannya ke siapa pun, termasuk
 * pemiliknya sendiri, karena identitas dibuktikan lewat tautan email, bukan
 * kata sandi ini.
 *
 * crypto.getRandomValues tersedia baik di browser maupun Node ≥ 19
 * (globalThis.crypto) — tidak perlu import apa pun, dan itu yang membuat
 * fungsi ini bisa diuji langsung lewat npm run uji.
 */
export function buatKataSandiAcak(panjang = 32): string {
  const acak = new Uint32Array(panjang);
  crypto.getRandomValues(acak);
  return Array.from(acak, (n) => ALFABET_SANDI_ACAK[n % ALFABET_SANDI_ACAK.length]).join("");
}
