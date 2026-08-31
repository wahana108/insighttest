export type StatusSertifikat = "berlaku" | "dicabut";

export interface ItemSertifikat {
  modulId: string;
  judul: string;
  skor: number;
  lulus: boolean;
}

/**
 * KA-6 (docs/arsitektur.md): SEMUANYA di sini adalah cuplikan (snapshot)
 * yang dibekukan saat terbit — namaLengkap dan judulKegiatan DISALIN, tidak
 * dirujuk. Menyunting profil peserta atau kegiatan setelahnya tidak boleh
 * mengubah sertifikat yang sudah terbit.
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
