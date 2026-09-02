import type { Timestamp } from "firebase-admin/firestore";

export type StatusSertifikat = "berlaku" | "dicabut";

export interface ItemSertifikat {
  modulId: string;
  judul: string;
  skor: number;
  lulus: boolean;
}

/**
 * Jejak audit — ditambah dengan FieldValue.arrayUnion() di setiap
 * penerbitan (termasuk penerbitan ulang) dan pencabutan, tidak pernah
 * ditimpa. TIDAK PERNAH dikirim ke klien mana pun (lihat SertifikatDetail
 * dan SertifikatPublik di bawah — keduanya sengaja tidak membawa field
 * ini), termasuk halaman verifikasi publik /s/[kode].
 */
export interface RiwayatSertifikat {
  aksi: "terbit" | "cabut";
  pada: Timestamp;
  olehUid: string;
}

/**
 * KA-6 (docs/arsitektur.md): SEMUANYA di sini adalah cuplikan (snapshot)
 * yang dibekukan saat terbit — namaLengkap dan judulKegiatan DISALIN, tidak
 * dirujuk. Menyunting profil peserta atau kegiatan setelahnya tidak boleh
 * mengubah sertifikat yang sudah terbit.
 *
 * penandatanganNama/penandatanganJabatan/tandaTanganUrl JUGA dibekukan di
 * sini (beda dari logoUrl/kopUrl di TemplateSertifikat yang tetap live) —
 * penandatangan (nama, jabatan, DAN gambar tanda tangannya) adalah
 * pernyataan seseorang, bukan branding lembaga. Sertifikat lama dari
 * sebelum field ini ada akan tidak memilikinya sama sekali (bukan string
 * kosong) — pembaca (buildSertifikatDetail) mundur ke template hidup hanya
 * untuk kasus itu.
 */
export interface Sertifikat {
  id: string;
  kegiatanId: string;
  uid: string;
  serial: string;
  kodeVerifikasi: string;
  namaLengkap: string;
  judulKegiatan: string;
  nilaiAkhir: number;
  items: ItemSertifikat[];
  status: StatusSertifikat;
  terbitPada: string;
  diterbitkanOleh: string;
  penandatanganNama: string;
  penandatanganJabatan: string;
  tandaTanganUrl: string;
  dicabutPada: string | null;
  dicabutOleh: string | null;
  alasanPencabutan: string | null;
  riwayat: RiwayatSertifikat[];
}

export type SertifikatRingkas = Pick<
  Sertifikat,
  | "id"
  | "kegiatanId"
  | "serial"
  | "kodeVerifikasi"
  | "judulKegiatan"
  | "nilaiAkhir"
  | "status"
  | "terbitPada"
>;

/**
 * Dipakai GET /api/sertifikat/[id] (halaman /sertifikat/[id], berlogin) —
 * gabungan snapshot sertifikat + template LIVE dari kegiatan saat ini
 * (lihat TemplateSertifikat di types/kegiatan.ts, sengaja tidak dibekukan).
 */
export interface SertifikatDetail {
  id: string;
  kegiatanId: string;
  serial: string;
  kodeVerifikasi: string;
  namaLengkap: string;
  judulKegiatan: string;
  nilaiAkhir: number;
  items: ItemSertifikat[];
  status: StatusSertifikat;
  terbitPada: string;
  template: {
    logoUrl: string;
    kopUrl: string;
    penandatanganNama: string;
    penandatanganJabatan: string;
    tandaTanganUrl: string;
    teksTambahan: string;
  };
}

/**
 * Dipakai halaman publik /s/[kode]. TIDAK PERNAH membawa email, uid, nomor
 * identitas, nomor telepon, atau institusi — lihat komentar di
 * src/app/s/[kode]/page.tsx.
 */
export interface SertifikatPublik {
  namaLengkap: string;
  judulKegiatan: string;
  serial: string;
  nilaiAkhir: number;
  items: ItemSertifikat[];
  status: StatusSertifikat;
  terbitPada: string;
}
