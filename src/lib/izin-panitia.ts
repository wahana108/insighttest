import type { UserRole } from "@/types/user";

/**
 * Satu sumber kebenaran untuk "apa yang boleh dilakukan pengguna ini pada
 * kegiatan ini" (Slice 8.1). Dipakai di server (Route Handler, sebelum
 * menulis/membaca) DAN di klien (menyembunyikan tombol) — tapi menyembunyikan
 * tombol bukan pagar, jadi setiap pemakaian di klien HARUS punya pasangan
 * penolakan di server yang memakai fungsi yang SAMA. Jangan pernah menulis
 * ulang logika ini di tempat lain.
 *
 * `boleh` berarti "pengguna ini punya urusan sah dengan kegiatan ini sama
 * sekali" (admin/superadmin di mana pun; panitia yang ditugaskan di kegiatan
 * ini). `lihatPeserta` selalu ikut `boleh` untuk panitia — bisa melihat
 * peserta adalah minimum mutlak untuk siapa pun yang ditunjuk, tidak ada
 * saklar terpisah untuk itu. Tiga sisanya (terbitkanSertifikat,
 * suntingKegiatan, buatSoal) adalah saklar per orang per kegiatan yang
 * dipilih admin saat menunjuk.
 */
export interface KemampuanPanitia {
  boleh: boolean;
  lihatPeserta: boolean;
  terbitkanSertifikat: boolean;
  suntingKegiatan: boolean;
  buatSoal: boolean;
}

const TIDAK_PUNYA_IZIN: KemampuanPanitia = {
  boleh: false,
  lihatPeserta: false,
  terbitkanSertifikat: false,
  suntingKegiatan: false,
  buatSoal: false,
};

const SEMUA_DIIZINKAN: KemampuanPanitia = {
  boleh: true,
  lihatPeserta: true,
  terbitkanSertifikat: true,
  suntingKegiatan: true,
  buatSoal: true,
};

/**
 * Bentuk minimum profil yang dibutuhkan — cukup uid + role, supaya fungsi
 * ini bisa dipanggil baik dengan UserProfile penuh (klien) maupun
 * VerifiedUser (server, src/lib/api/auth-server.ts) tanpa konversi.
 */
export interface ProfilUntukIzin {
  uid: string;
  role: UserRole;
}

/**
 * Bentuk minimum data kegiatan yang dibutuhkan. Sengaja `unknown` longgar
 * (bukan Kegiatan yang sudah dipetakan) supaya fungsi ini bisa dipanggil
 * langsung dengan DocumentData mentah dari Admin SDK di server — tempat yang
 * paling penting untuk benar, dan tempat data paling mungkin belum melalui
 * mapKegiatan(). Dokumen lama tanpa field ini sama sekali harus aman (lihat
 * uji "kegiatan tanpa panitiaUids" di scripts/uji-peran.ts).
 */
export interface KegiatanUntukIzin {
  panitiaUids?: unknown;
  panitiaIzin?: unknown;
}

function ambilPanitiaUids(kegiatan: KegiatanUntukIzin): string[] {
  if (!Array.isArray(kegiatan.panitiaUids)) {
    return [];
  }
  return kegiatan.panitiaUids.filter((item): item is string => typeof item === "string");
}

function ambilIzinUntukUid(kegiatan: KegiatanUntukIzin, uid: string): Record<string, unknown> {
  if (typeof kegiatan.panitiaIzin !== "object" || kegiatan.panitiaIzin === null) {
    return {};
  }
  const semua = kegiatan.panitiaIzin as Record<string, unknown>;
  const milikUid = semua[uid];
  return typeof milikUid === "object" && milikUid !== null
    ? (milikUid as Record<string, unknown>)
    : {};
}

/**
 * admin/superadmin → semuanya true, di kegiatan mana pun (bahkan kalau
 * datanya tidak ada/rusak). panitia yang uid-nya ada di panitiaUids
 * kegiatan ini → boleh + lihatPeserta selalu true, tiga sisanya dari
 * panitiaIzin[uid] (default false kalau tidak ada entrinya sama sekali —
 * TIDAK melempar). Selain itu (termasuk peserta, profil kosong, atau role
 * yang tidak dikenal) → semuanya false.
 */
export function izinPanitia(
  profil: ProfilUntukIzin | null | undefined,
  kegiatan: KegiatanUntukIzin | null | undefined
): KemampuanPanitia {
  if (!profil) {
    return TIDAK_PUNYA_IZIN;
  }
  if (profil.role === "admin" || profil.role === "superadmin") {
    return SEMUA_DIIZINKAN;
  }
  if (profil.role !== "panitia" || !kegiatan) {
    return TIDAK_PUNYA_IZIN;
  }

  const uids = ambilPanitiaUids(kegiatan);
  if (!uids.includes(profil.uid)) {
    return TIDAK_PUNYA_IZIN;
  }

  const izin = ambilIzinUntukUid(kegiatan, profil.uid);
  return {
    boleh: true,
    lihatPeserta: true,
    terbitkanSertifikat: izin.terbitkanSertifikat === true,
    suntingKegiatan: izin.suntingKegiatan === true,
    buatSoal: izin.buatSoal === true,
  };
}
